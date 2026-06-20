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

    describe('content seeding (B2)', () => {
        const OWNER_ID = 'owner-uuid';

        const eventInserts = () =>
            db.query.mock.calls.filter((c) => /INSERT INTO events/.test(c[0]));
        const eventDeletes = () =>
            db.query.mock.calls.filter((c) => /DELETE FROM events/.test(c[0]));
        const announcementInserts = () =>
            db.query.mock.calls.filter((c) => /INSERT INTO announcements/.test(c[0]));

        test('seeds 6-8 events including >=1 future service, idempotent via delete-by-owner', async () => {
            await seed.seedContent(db, OWNER_ID);

            const deletes = eventDeletes();
            expect(deletes.length).toBe(1);
            // The delete is scoped to the content owner only.
            expect(deletes[0][1]).toContain(OWNER_ID);

            const inserts = eventInserts();
            expect(inserts.length).toBeGreaterThanOrEqual(6);
            expect(inserts.length).toBeLessThanOrEqual(8);

            // starts_at passed as a JS Date; created_by = owner.
            inserts.forEach((call) => {
                expect(call[1].find((p) => p instanceof Date)).toBeInstanceOf(Date);
                expect(call[1]).toContain(OWNER_ID);
            });

            // At least one future service event drives the homepage countdown.
            const now = Date.now();
            const futureService = inserts.some((call) => {
                const params = call[1];
                const isService = params.includes('service');
                const hasFutureStart = params.some(
                    (p) => p instanceof Date && p.getTime() > now
                );
                return isService && hasFutureStart;
            });
            expect(futureService).toBe(true);
        });

        test('seeds >=3 announcements with exactly one featured, idempotent on fixed id', async () => {
            await seed.seedContent(db, OWNER_ID);

            const inserts = announcementInserts();
            expect(inserts.length).toBeGreaterThanOrEqual(3);

            let featuredCount = 0;
            inserts.forEach((call) => {
                expect(call[0]).toMatch(/ON CONFLICT \(id\)/i);
                const params = call[1];
                // created_by/updated_by FK = owner
                expect(params).toContain(OWNER_ID);
                if (params.includes(true)) {
                    featuredCount += 1;
                }
            });
            expect(featuredCount).toBe(1);
        });

        test('never enqueues member email', async () => {
            // The script must not import/trigger the fan-out services. Spy on the
            // shared email queue module: if seed-demo touched it, this would fire.
            const emailQueueService = require('../../src/services/emailQueueService');
            const spy = jest
                .spyOn(emailQueueService, 'enqueueEmail')
                .mockResolvedValue({ id: 'should-never-be-called' });

            await seed.seedContent(db, OWNER_ID);

            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });
    });
});
