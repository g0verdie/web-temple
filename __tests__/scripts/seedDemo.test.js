const bcrypt = require('bcrypt');

jest.mock('../../src/config/db');

const db = require('../../src/config/db');
const seed = require('../../scripts/seed-demo');

describe('seed-demo script', () => {
    const ORIGINAL_ENV = process.env.NODE_ENV;

    beforeEach(() => {
        jest.clearAllMocks();
        db.query.mockResolvedValue({ rows: [] });
    });

    afterEach(() => {
        process.env.NODE_ENV = ORIGINAL_ENV;
    });

    describe('production guard (B1)', () => {
        test('blocks in production without --force', () => {
            process.env.NODE_ENV = 'production';
            expect(seed.assertSafeToRun([])).toBe(false);
        });

        test('allows in production with --force', () => {
            process.env.NODE_ENV = 'production';
            expect(seed.assertSafeToRun(['--force'])).toBe(true);
        });

        test('allows outside production without --force', () => {
            process.env.NODE_ENV = 'development';
            expect(seed.assertSafeToRun([])).toBe(true);
        });
    });

    describe('demo accounts (B1)', () => {
        test('builds one account per distinct role', () => {
            const accounts = seed.buildDemoAccounts();
            const roles = accounts.map((a) => a.role).sort();
            expect(roles).toEqual(['admin', 'member', 'rabbi', 'social_chair', 'treasurer']);
            // Exactly one content-owner admin is designated.
            const owners = accounts.filter((a) => a.isContentOwner);
            expect(owners).toHaveLength(1);
            expect(owners[0].role).toBe('admin');
        });

        test('upserts accounts with bcrypt-hashed passwords (not plaintext)', async () => {
            // Resolve the content-owner id on its upsert call.
            db.query.mockImplementation((sql) => {
                if (/INSERT INTO users/.test(sql)) {
                    return Promise.resolve({ rows: [{ id: 'owner-uuid' }] });
                }
                return Promise.resolve({ rows: [] });
            });

            const ownerId = await seed.seedDemoAccounts(db);

            // One upsert per account.
            const accounts = seed.buildDemoAccounts();
            const userInserts = db.query.mock.calls.filter((c) => /INSERT INTO users/.test(c[0]));
            expect(userInserts).toHaveLength(accounts.length);

            // Every insert uses ON CONFLICT (email) for idempotency.
            userInserts.forEach((call) => {
                expect(call[0]).toMatch(/ON CONFLICT \(email\)/i);
            });

            // The password parameter is a bcrypt hash, never the plaintext.
            const ownerAccount = accounts.find((a) => a.isContentOwner);
            const ownerInsert = userInserts.find((c) => c[1].includes(ownerAccount.email));
            const hashParam = ownerInsert[1].find(
                (p) => typeof p === 'string' && p.startsWith('$2')
            );
            expect(hashParam).toBeDefined();
            expect(hashParam).not.toBe(ownerAccount.password);
            expect(await bcrypt.compare(ownerAccount.password, hashParam)).toBe(true);

            // Content-owner id is resolved and returned for B2 FKs.
            expect(ownerId).toBe('owner-uuid');
        });

        test('resolves the content-owner id even when the upsert does not RETURNING a row', async () => {
            // ON CONFLICT DO NOTHING returns no row on a second run; fall back to a SELECT.
            db.query.mockImplementation((sql) => {
                if (/SELECT id FROM users WHERE email/.test(sql)) {
                    return Promise.resolve({ rows: [{ id: 'existing-owner-uuid' }] });
                }
                return Promise.resolve({ rows: [] });
            });

            const ownerId = await seed.seedDemoAccounts(db);
            expect(ownerId).toBe('existing-owner-uuid');
        });
    });
});
