// Set the encryption key before requiring anything that reads it at module load.
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-0123456789abcdef';

jest.mock('../../src/config/db', () => ({
    query: jest.fn(),
    pool: { connect: jest.fn() }
}));
jest.mock('../../src/utils/logger', () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
}));
jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn().mockResolvedValue(undefined),
    AUDIT_ACTIONS: {
        DIRECTORY_LISTING_UPDATED: 'DIRECTORY_LISTING_UPDATED',
        DIRECTORY_MODERATED: 'DIRECTORY_MODERATED'
    }
}));

const db = require('../../src/config/db');
const { logAudit } = require('../../src/services/auditService');
const { encrypt, decrypt } = require('../../src/utils/encryptionHelper');
const svc = require('../../src/services/MemberDirectoryService');

describe('MemberDirectoryService', () => {
    let mockClient;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient = { query: jest.fn(), release: jest.fn() };
        db.pool.connect.mockResolvedValue(mockClient);
    });

    describe('saveMyProfile', () => {
        test('encrypts phone/household at rest and audits the change', async () => {
            db.query.mockResolvedValue({ rows: [{ user_id: 'u1' }] });

            await svc.saveMyProfile('u1', {
                phone: '555-1234', household: 'Spouse: Dana', bio: 'Hi', interests: 'choir',
                listed: true, show_phone: true
            });

            const [sql, params] = db.query.mock.calls[0];
            expect(sql).toContain('INSERT INTO member_profiles');
            // params: [userId, listed, show_phone, show_email, show_household, phone_enc, household_enc, bio, interests]
            const storedPhone = params[5];
            const storedHousehold = params[6];
            expect(storedPhone).not.toBe('555-1234');           // not plaintext
            expect(decrypt(storedPhone)).toBe('555-1234');       // round-trips
            expect(decrypt(storedHousehold)).toBe('Spouse: Dana');
            expect(logAudit).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'DIRECTORY_LISTING_UPDATED', user_id: 'u1' })
            );
        });

        test('rejects over-length free text', async () => {
            await expect(
                svc.saveMyProfile('u1', { bio: 'x'.repeat(501) })
            ).rejects.toThrow(/Bio must be 500/);
            expect(db.query).not.toHaveBeenCalled();
        });

        test('requires household consent to enable show_household', async () => {
            await expect(
                svc.saveMyProfile('u1', { show_household: true })
            ).rejects.toThrow(/consent/i);

            db.query.mockResolvedValue({ rows: [{ user_id: 'u1' }] });
            await expect(
                svc.saveMyProfile('u1', { show_household: true, household_consent: true })
            ).resolves.toMatchObject({ show_household: true });
        });

        test('drops unknown/non-boolean flags', async () => {
            db.query.mockResolvedValue({ rows: [{ user_id: 'u1' }] });
            const result = await svc.saveMyProfile('u1', { listed: 'yes', evil: true });
            expect(result.listed).toBe(false); // 'yes' is not boolean → default false
            expect(result).not.toHaveProperty('evil');
        });
    });

    describe('getMyProfile', () => {
        test('round-trips decrypted phone/household for the owner', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    first_name: 'A', last_name: 'B', email: 'a@b.com',
                    listed: true, show_phone: false, show_email: false, show_household: false,
                    phone_encrypted: encrypt('555-9999'), household_encrypted: encrypt('Kids: 2'),
                    bio: 'hi', interests: 'choir'
                }]
            });
            const p = await svc.getMyProfile('u1');
            expect(p.phone).toBe('555-9999');
            expect(p.household).toBe('Kids: 2');
            expect(p.listed).toBe(true);
        });

        test('throws when the user does not exist', async () => {
            db.query.mockResolvedValue({ rows: [] });
            await expect(svc.getMyProfile('nope')).rejects.toThrow('User not found');
        });
    });

    describe('listListedProfiles (server-side visibility)', () => {
        const dataRow = (overrides = {}) => ({
            user_id: 'u2', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@x.com',
            show_phone: false, show_email: true, show_household: false,
            phone_encrypted: encrypt('555-0000'), household_encrypted: encrypt('Fam'),
            bio: 'math', interests: 'Youth Committee',
            ...overrides
        });

        test('omits hidden fields entirely from the payload (AE2)', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({ rows: [dataRow()] });

            const { profiles } = await svc.listListedProfiles({ page: 1, limit: 20 });
            const p = profiles[0];
            expect(p).not.toHaveProperty('phone');     // show_phone false → no key at all
            expect(p).not.toHaveProperty('household');  // show_household false → no key
            expect(p.email).toBe('ada@x.com');          // show_email true → present
            expect(p.initials).toBe('AL');
        });

        test('only lists members where listed = true, and never searches encrypted columns', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await svc.listListedProfiles({ search: 'ada', page: 1, limit: 20 });

            const dataSql = mockClient.query.mock.calls[1][0];
            expect(dataSql).toContain('mp.listed = true');
            // The WHERE + ORDER tail must not reference any encrypted column.
            const tail = dataSql.split('WHERE')[1];
            expect(tail).not.toMatch(/encrypted/);
            expect(dataSql).toMatch(/ORDER BY u\.last_name/);
        });

        test('tolerates an undecryptable shown field without crashing the listing', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({ rows: [dataRow({ show_phone: true, phone_encrypted: 'not-valid-ciphertext' })] });

            const { profiles } = await svc.listListedProfiles({ page: 1, limit: 20 });
            expect(profiles).toHaveLength(1);
            expect(profiles[0].phone).toBeNull(); // decrypt failed → omitted value, no throw
        });
    });

    describe('getListedProfile', () => {
        test('returns null for a member who is not listed', async () => {
            db.query.mockResolvedValue({ rows: [] });
            expect(await svc.getListedProfile('u9')).toBeNull();
        });
    });

    describe('getProfileForAdmin (admin-only, no member-facing bypass)', () => {
        test('returns an unlisted profile with decrypted fields', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    user_id: 'u3', first_name: 'C', last_name: 'D', email: 'c@d.com',
                    listed: false, show_phone: false, show_email: false, show_household: false,
                    phone_encrypted: encrypt('555-7777'), household_encrypted: null,
                    bio: null, interests: null
                }]
            });
            const p = await svc.getProfileForAdmin('u3');
            expect(p.listed).toBe(false);
            expect(p.phone).toBe('555-7777');
        });

        test('member-facing methods expose no asAdmin parameter', () => {
            expect(svc.getListedProfile.length).toBe(1); // (userId) only
        });
    });

    describe('moderateProfile', () => {
        test('clears only allow-listed fields and unlists, audited', async () => {
            db.query.mockResolvedValue({ rows: [] });
            await svc.moderateProfile('u4', { unlist: true, clearFields: ['bio', 'listed', 'evil_col'] });

            const sql = db.query.mock.calls[0][0];
            expect(sql).toContain('listed = false');   // from unlist
            expect(sql).toContain('bio = NULL');        // allow-listed
            expect(sql).not.toContain('evil_col');      // dropped
            expect(sql).not.toMatch(/listed = NULL/);   // 'listed' not a clearable field
            expect(logAudit).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'DIRECTORY_MODERATED', entity_id: 'u4' })
            );
        });

        test('no-ops when nothing to moderate', async () => {
            const result = await svc.moderateProfile('u4', { unlist: false, clearFields: ['evil'] });
            expect(result).toEqual({ moderated: false });
            expect(db.query).not.toHaveBeenCalled();
        });
    });
});
