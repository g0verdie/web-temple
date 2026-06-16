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
                phone: '555-1234',
                household: [{ name: 'Dana', relationship: 'Spouse', birthday: '' }],
                bio: 'Hi', interests: 'choir',
                listed: true, show_phone: true
            });

            const [sql, params] = db.query.mock.calls[0];
            expect(sql).toContain('INSERT INTO member_profiles');
            // params: [userId, listed, show_phone, show_email, show_household, show_address,
            //          phone_enc, household_enc, address_enc, bio, interests]
            const storedPhone = params[6];
            const storedHousehold = params[7];
            expect(storedPhone).not.toBe('555-1234');           // not plaintext
            expect(decrypt(storedPhone)).toBe('555-1234');       // round-trips
            // Household is stored as an encrypted JSON array of {name, relationship, birthday}.
            expect(JSON.parse(decrypt(storedHousehold)))
                .toEqual([{ name: 'Dana', relationship: 'Spouse', birthday: '' }]);
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

    describe('member address', () => {
        test('encrypts address at rest, round-trips it, and stores show_address', async () => {
            db.query.mockResolvedValue({ rows: [{ user_id: 'u1' }] });

            await svc.saveMyProfile('u1', {
                address: '1 Main St, Springfield', show_address: true, listed: true
            });

            const [sql, params] = db.query.mock.calls[0];
            expect(sql).toContain('address_encrypted');
            expect(sql).toContain('show_address');
            // The encrypted address is somewhere in the params; find it by decrypting.
            const storedAddress = params.find((p) => {
                if (typeof p !== 'string') return false;
                try { return decrypt(p) === '1 Main St, Springfield'; } catch (e) { return false; }
            });
            expect(storedAddress).toBeTruthy();
            expect(storedAddress).not.toBe('1 Main St, Springfield'); // not plaintext
        });

        test('omits address from a member listing when show_address is false', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({
                    rows: [{
                        user_id: 'u2', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@x.com',
                        show_phone: false, show_email: false, show_household: false, show_address: false,
                        phone_encrypted: null, household_encrypted: null,
                        address_encrypted: encrypt('1 Main St'),
                        bio: null, interests: null
                    }]
                });

            const { profiles } = await svc.listListedProfiles({ page: 1, limit: 20 });
            expect(profiles[0]).not.toHaveProperty('address');
        });

        test('exposes decrypted address on a member listing when show_address is true', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({
                    rows: [{
                        user_id: 'u2', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@x.com',
                        show_phone: false, show_email: false, show_household: false, show_address: true,
                        phone_encrypted: null, household_encrypted: null,
                        address_encrypted: encrypt('1 Main St'),
                        bio: null, interests: null
                    }]
                });

            const { profiles } = await svc.listListedProfiles({ page: 1, limit: 20 });
            expect(profiles[0].address).toBe('1 Main St');
        });

        test('owner profile round-trips decrypted address and show_address', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    first_name: 'A', last_name: 'B', email: 'a@b.com',
                    listed: true, show_phone: false, show_email: false, show_household: false, show_address: true,
                    phone_encrypted: null, household_encrypted: null, address_encrypted: encrypt('5 Elm Ave'),
                    bio: null, interests: null
                }]
            });
            const p = await svc.getMyProfile('u1');
            expect(p.address).toBe('5 Elm Ave');
            expect(p.show_address).toBe(true);
        });
    });

    describe('member birthday', () => {
        test('encrypts the full date at rest and stores show_birthday', async () => {
            db.query.mockResolvedValue({ rows: [{ user_id: 'u1' }] });

            const result = await svc.saveMyProfile('u1', {
                birthday: '1985-06-15', show_birthday: true, listed: true
            });

            const [sql, params] = db.query.mock.calls[0];
            expect(sql).toContain('birthday_encrypted');
            expect(sql).toContain('show_birthday');
            const storedBirthday = params.find((p) => {
                if (typeof p !== 'string') return false;
                try { return decrypt(p) === '1985-06-15'; } catch (e) { return false; }
            });
            expect(storedBirthday).toBeTruthy();
            expect(storedBirthday).not.toBe('1985-06-15'); // not plaintext
            expect(result.show_birthday).toBe(true);
        });

        test('rejects a malformed or future birthday', async () => {
            await expect(svc.saveMyProfile('u1', { birthday: '2025-13-40' }))
                .rejects.toThrow(/valid date/i);
            await expect(svc.saveMyProfile('u1', { birthday: '2999-01-01' }))
                .rejects.toThrow(/future/i);
            expect(db.query).not.toHaveBeenCalled();
        });

        test('accepts a year-less MM-DD birthday (year is optional) and stores it encrypted', async () => {
            db.query.mockResolvedValue({ rows: [{ user_id: 'u1' }] });
            await svc.saveMyProfile('u1', { birthday: '02-29', show_birthday: true, listed: true });
            const [, params] = db.query.mock.calls[0];
            const stored = params.find((p) => {
                if (typeof p !== 'string') return false;
                try { return decrypt(p) === '02-29'; } catch (e) { return false; }
            });
            expect(stored).toBeTruthy(); // Feb 29 allowed (leap-year validated), year omitted
            expect(stored).not.toBe('02-29'); // not plaintext
        });

        test('rejects an invalid year-less birthday (e.g. month 13)', async () => {
            await expect(svc.saveMyProfile('u1', { birthday: '13-01' }))
                .rejects.toThrow(/valid date/i);
            expect(db.query).not.toHaveBeenCalled();
        });

        test('shows month + day for a year-less stored birthday', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({
                    rows: [{
                        user_id: 'u3', first_name: 'Bea', last_name: 'Day', email: 'bea@x.com',
                        show_phone: false, show_email: false, show_household: false, show_address: false, show_birthday: true,
                        phone_encrypted: null, household_encrypted: null, address_encrypted: null,
                        birthday_encrypted: encrypt('06-15'), bio: null, interests: null
                    }]
                });
            const { profiles } = await svc.listListedProfiles({ page: 1, limit: 20 });
            expect(profiles[0].birthday).toBe('June 15');
        });

        test('shows only month + day to members (never the year) when show_birthday is true', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({
                    rows: [{
                        user_id: 'u2', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@x.com',
                        show_phone: false, show_email: false, show_household: false, show_address: false, show_birthday: true,
                        phone_encrypted: null, household_encrypted: null, address_encrypted: null,
                        birthday_encrypted: encrypt('1985-06-15'),
                        bio: null, interests: null
                    }]
                });

            const { profiles } = await svc.listListedProfiles({ page: 1, limit: 20 });
            expect(profiles[0].birthday).toBe('June 15');
            expect(profiles[0].birthday).not.toMatch(/1985/);
        });

        test('omits birthday from a member listing when show_birthday is false', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({
                    rows: [{
                        user_id: 'u2', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@x.com',
                        show_phone: false, show_email: false, show_household: false, show_address: false, show_birthday: false,
                        phone_encrypted: null, household_encrypted: null, address_encrypted: null,
                        birthday_encrypted: encrypt('1985-06-15'),
                        bio: null, interests: null
                    }]
                });

            const { profiles } = await svc.listListedProfiles({ page: 1, limit: 20 });
            expect(profiles[0]).not.toHaveProperty('birthday');
        });

        test('owner profile round-trips the full ISO birthday and show_birthday', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    first_name: 'A', last_name: 'B', email: 'a@b.com',
                    listed: true, show_phone: false, show_email: false, show_household: false,
                    show_address: false, show_birthday: true,
                    phone_encrypted: null, household_encrypted: null, address_encrypted: null,
                    birthday_encrypted: encrypt('1990-03-09'), bio: null, interests: null
                }]
            });
            const p = await svc.getMyProfile('u1');
            expect(p.birthday).toBe('1990-03-09'); // owner sees the full date to edit
            expect(p.show_birthday).toBe(true);
        });
    });

    describe('structured household', () => {
        test('round-trips a household array (JSON-encrypted at rest) for the owner', async () => {
            const people = [
                { name: 'Dana', relationship: 'Spouse', birthday: '1980-05-01' },
                { name: 'Sam', relationship: 'Child', birthday: '' }
            ];
            db.query.mockResolvedValue({
                rows: [{
                    first_name: 'A', last_name: 'B', email: 'a@b.com',
                    listed: true, show_phone: false, show_email: false, show_household: false, show_address: false,
                    phone_encrypted: null, household_encrypted: encrypt(JSON.stringify(people)),
                    address_encrypted: null, bio: 'hi', interests: 'choir'
                }]
            });
            const p = await svc.getMyProfile('u1');
            expect(p.household).toEqual(people);
        });

        test('owner with no household gets an empty array', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    first_name: 'A', last_name: 'B', email: 'a@b.com',
                    listed: false, show_phone: false, show_email: false, show_household: false, show_address: false,
                    phone_encrypted: null, household_encrypted: null, address_encrypted: null,
                    bio: null, interests: null
                }]
            });
            const p = await svc.getMyProfile('u1');
            expect(p.household).toEqual([]);
        });

        test('legacy plain-text household decrypts to a single fallback entry (no throw)', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    first_name: 'A', last_name: 'B', email: 'a@b.com',
                    listed: true, show_phone: false, show_email: false, show_household: false, show_address: false,
                    phone_encrypted: null, household_encrypted: encrypt('Spouse: Dana, Kids: 2'),
                    address_encrypted: null, bio: null, interests: null
                }]
            });
            const p = await svc.getMyProfile('u1');
            expect(p.household).toEqual([{ name: 'Spouse: Dana, Kids: 2', relationship: '', birthday: '' }]);
        });

        test('member listing exposes household array when show_household is true', async () => {
            const people = [{ name: 'Dana', relationship: 'Spouse', birthday: '' }];
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({
                    rows: [{
                        user_id: 'u2', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@x.com',
                        show_phone: false, show_email: false, show_household: true, show_address: false,
                        phone_encrypted: null, household_encrypted: encrypt(JSON.stringify(people)),
                        address_encrypted: null, bio: null, interests: null
                    }]
                });
            const { profiles } = await svc.listListedProfiles({ page: 1, limit: 20 });
            expect(profiles[0].household).toEqual(people);
        });

        test('keeps a year-less MM-DD household birthday on save (year optional)', async () => {
            db.query.mockResolvedValue({ rows: [{ user_id: 'u1' }] });
            await svc.saveMyProfile('u1', {
                household: [{ name: 'Dana', relationship: 'Spouse', birthday: '05-01' }]
            });
            const stored = JSON.parse(decrypt(db.query.mock.calls[0][1][7]));
            expect(stored).toEqual([{ name: 'Dana', relationship: 'Spouse', birthday: '05-01' }]);
        });

        test('member listing shows household birthdays as month + day only (year hidden)', async () => {
            const people = [
                { name: 'Dana', relationship: 'Spouse', birthday: '1980-05-01' }, // full date → May 1
                { name: 'Sam', relationship: 'Child', birthday: '12-25' }         // year-less → December 25
            ];
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({
                    rows: [{
                        user_id: 'u2', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@x.com',
                        show_phone: false, show_email: false, show_household: true, show_address: false,
                        phone_encrypted: null, household_encrypted: encrypt(JSON.stringify(people)),
                        address_encrypted: null, bio: null, interests: null
                    }]
                });
            const { profiles } = await svc.listListedProfiles({ page: 1, limit: 20 });
            expect(profiles[0].household).toEqual([
                { name: 'Dana', relationship: 'Spouse', birthday: 'May 1' },
                { name: 'Sam', relationship: 'Child', birthday: 'December 25' }
            ]);
            expect(JSON.stringify(profiles[0].household)).not.toContain('1980'); // year never leaks
        });

        test('save normalizes and drops blank-name household entries', async () => {
            db.query.mockResolvedValue({ rows: [{ user_id: 'u1' }] });
            await svc.saveMyProfile('u1', {
                household: [
                    { name: ' Dana ', relationship: ' Spouse ', birthday: '1980-05-01' },
                    { name: '', relationship: 'Child', birthday: '' },          // dropped (no name)
                    { name: 'Sam', relationship: '', birthday: 'not-a-date' }    // birthday cleared
                ]
            });
            const stored = JSON.parse(decrypt(db.query.mock.calls[0][1][7]));
            expect(stored).toEqual([
                { name: 'Dana', relationship: 'Spouse', birthday: '1980-05-01' },
                { name: 'Sam', relationship: '', birthday: '' }
            ]);
        });

        test('save accepts a JSON string household (client may pre-serialize)', async () => {
            db.query.mockResolvedValue({ rows: [{ user_id: 'u1' }] });
            await svc.saveMyProfile('u1', {
                household: JSON.stringify([{ name: 'Dana', relationship: 'Spouse', birthday: '' }])
            });
            const stored = JSON.parse(decrypt(db.query.mock.calls[0][1][7]));
            expect(stored).toEqual([{ name: 'Dana', relationship: 'Spouse', birthday: '' }]);
        });

        test('save with empty household stores null (no encrypted blob)', async () => {
            db.query.mockResolvedValue({ rows: [{ user_id: 'u1' }] });
            await svc.saveMyProfile('u1', { household: [] });
            expect(db.query.mock.calls[0][1][7]).toBeNull();
        });
    });

    describe('getMyProfile', () => {
        test('round-trips decrypted phone for the owner', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    first_name: 'A', last_name: 'B', email: 'a@b.com',
                    listed: true, show_phone: false, show_email: false, show_household: false,
                    phone_encrypted: encrypt('555-9999'), household_encrypted: null,
                    bio: 'hi', interests: 'choir'
                }]
            });
            const p = await svc.getMyProfile('u1');
            expect(p.phone).toBe('555-9999');
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
            expect(await svc.getListedProfile('11111111-1111-4111-8111-111111111111')).toBeNull();
        });

        test('returns null for a malformed (non-UUID) id without querying', async () => {
            expect(await svc.getListedProfile('not-a-uuid')).toBeNull();
            expect(db.query).not.toHaveBeenCalled();
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

    describe('activation nudge (R20)', () => {
        test('shows when not listed and not dismissed', async () => {
            db.query.mockResolvedValue({ rows: [{ listed: false, dismissed: false }] });
            expect(await svc.getNudgeState('u1')).toMatchObject({ showNudge: true });
        });

        test('hidden when already listed', async () => {
            db.query.mockResolvedValue({ rows: [{ listed: true, dismissed: false }] });
            expect(await svc.getNudgeState('u1')).toMatchObject({ showNudge: false });
        });

        test('hidden when dismissed', async () => {
            db.query.mockResolvedValue({ rows: [{ listed: false, dismissed: true }] });
            expect(await svc.getNudgeState('u1')).toMatchObject({ showNudge: false });
        });

        test('dismissNudge merges the flag into notification_preferences without clobbering', async () => {
            db.query.mockResolvedValue({ rows: [] });
            await svc.dismissNudge('u1');
            const sql = db.query.mock.calls[0][0];
            expect(sql).toContain('directory_nudge_dismissed');
            expect(sql).toContain('||'); // jsonb merge, not a full overwrite
        });
    });

    describe('export (item 8)', () => {
        test('toCsv neutralizes spreadsheet-formula injection and escapes quotes', () => {
            const csv = svc.toCsv([
                { first_name: '=cmd', last_name: 'Evil', interests: '+1', bio: 'hi "there"' }
            ]);
            const [header, row] = csv.split('\n');
            expect(header).toBe(svc.EXPORT_COLUMNS.join(','));
            expect(row).toContain('"\'=cmd Evil"'); // leading = neutralized with a quote
            expect(row).toContain('"\'+1"');         // leading + neutralized
            expect(row).toContain('hi ""there""');   // embedded quotes doubled
        });

        test('listAllForExport applies the member-visible projection; hidden fields never export', async () => {
            db.query.mockResolvedValue({ rows: [{
                user_id: 'u1', first_name: 'Lin', last_name: 'Listed', email: 'lin@x.com',
                show_phone: true, show_email: false, show_household: false, show_address: false, show_birthday: false,
                phone_encrypted: encrypt('555-9999'), household_encrypted: null, address_encrypted: null, birthday_encrypted: null,
                bio: 'Bio text', interests: 'Choir'
            }] });

            const profiles = await svc.listAllForExport();
            expect(db.query.mock.calls[0][0]).toMatch(/mp\.listed = true/); // listed members only
            expect(profiles[0].email).toBeUndefined(); // show_email=false → omitted by shapeForMember
            expect(profiles[0].phone).toBe('555-9999'); // show_phone=true → included

            const csv = svc.toCsv(profiles);
            expect(csv).toContain('555-9999');   // shown field exported
            expect(csv).not.toContain('lin@x.com'); // hidden field never exported

            const json = svc.toExportJson(profiles);
            expect(json[0].Phone).toBe('555-9999');
            expect(json[0].Email).toBe(''); // hidden → empty, not the real value
        });

        test('flattens a shown household to "Name (Relationship); …" in the export', async () => {
            const household = JSON.stringify([
                { name: 'Dana', relationship: 'Spouse', birthday: '' },
                { name: 'Sam', relationship: '', birthday: '' }
            ]);
            db.query.mockResolvedValue({ rows: [{
                user_id: 'u1', first_name: 'Lin', last_name: 'Listed', email: 'lin@x.com',
                show_phone: false, show_email: false, show_household: true, show_address: false, show_birthday: false,
                phone_encrypted: null, household_encrypted: encrypt(household), address_encrypted: null, birthday_encrypted: null,
                bio: null, interests: null
            }] });

            const profiles = await svc.listAllForExport();
            expect(svc.toExportJson(profiles)[0].Household).toBe('Dana (Spouse); Sam');
            expect(svc.toCsv(profiles)).toContain('Dana (Spouse); Sam');
        });

        test('omits a hidden household from the export', async () => {
            db.query.mockResolvedValue({ rows: [{
                user_id: 'u2', first_name: 'Pat', last_name: 'Private', email: 'pat@x.com',
                show_phone: false, show_email: false, show_household: false, show_address: false, show_birthday: false,
                phone_encrypted: null,
                household_encrypted: encrypt(JSON.stringify([{ name: 'Secret', relationship: 'Spouse', birthday: '' }])),
                address_encrypted: null, birthday_encrypted: null, bio: null, interests: null
            }] });

            const json = svc.toExportJson(await svc.listAllForExport());
            expect(json[0].Household).toBe('');
        });
    });
});
