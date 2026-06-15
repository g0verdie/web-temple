process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-0123456789abcdef';

// U9 — dashboard metrics cache. Both aggregate paths cache scalar totals under
// distinct keys (TTL 90s); finalize busts both. Invariant: aggregates only,
// never decrypted donor rows.
jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn().mockResolvedValue(undefined),
    AUDIT_ACTIONS: { DONATION_RECEIVED: 'DONATION_RECEIVED', DONATION_FAILED: 'DONATION_FAILED' }
}));
jest.mock('../../src/services/CacheService', () => ({
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true)
}));

const db = require('../../src/config/db');
const CacheService = require('../../src/services/CacheService');
const { encrypt } = require('../../src/utils/encryptionHelper');
const svc = require('../../src/services/DonationService');

const MTD_KEY = 'donations:metrics:mtd';
const DASHBOARD_KEY = 'donations:metrics:dashboard';
const TTL = 90;

describe('DonationService metrics cache (U9)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        CacheService.get.mockResolvedValue(null); // default: cache miss
        db.pool.connect.mockResolvedValue({ query: jest.fn(), release: jest.fn() });
    });

    describe('getMtdTotalCents', () => {
        test('caches the scalar total under the mtd key with a 90s TTL on a miss', async () => {
            db.query.mockResolvedValue({ rows: [{ encrypted_amount_cents: encrypt('1800') }, { encrypted_amount_cents: encrypt('3600') }] });
            const total = await svc.getMtdTotalCents();
            expect(total).toBe(5400);
            expect(CacheService.get).toHaveBeenCalledWith(MTD_KEY);
            expect(CacheService.set).toHaveBeenCalledWith(MTD_KEY, 5400, TTL);
        });

        test('a cache hit returns without querying/decrypting the DB', async () => {
            CacheService.get.mockResolvedValue(5400);
            const total = await svc.getMtdTotalCents();
            expect(total).toBe(5400);
            expect(db.query).not.toHaveBeenCalled();
            expect(CacheService.set).not.toHaveBeenCalled();
        });

        test('a cached 0 is honored (not re-treated as a miss)', async () => {
            CacheService.get.mockResolvedValue(0);
            expect(await svc.getMtdTotalCents()).toBe(0);
            expect(db.query).not.toHaveBeenCalled();
        });

        test('a cache error degrades to a live DB read (CacheService.get returns null)', async () => {
            CacheService.get.mockResolvedValue(null); // get swallows errors → null
            db.query.mockResolvedValue({ rows: [{ encrypted_amount_cents: encrypt('1800') }] });
            expect(await svc.getMtdTotalCents()).toBe(1800);
        });
    });

    describe('getDashboardMetrics', () => {
        test('caches the aggregate object under the dashboard key on a miss', async () => {
            const now = new Date();
            db.query.mockResolvedValue({ rows: [
                { encrypted_amount_cents: encrypt('1800'), encrypted_donor_email: encrypt('a@b.com'), donation_type: 'one-time', is_anonymous: false, created_at: now }
            ] });
            const m = await svc.getDashboardMetrics();
            expect(m.totalAllTimeCents).toBe(1800);
            expect(CacheService.get).toHaveBeenCalledWith(DASHBOARD_KEY);
            expect(CacheService.set).toHaveBeenCalledWith(DASHBOARD_KEY, expect.objectContaining({ totalAllTimeCents: 1800 }), TTL);
        });

        test('a cache hit returns cached metrics without a second DB decrypt', async () => {
            const cached = { totalAllTimeCents: 9999, identifiedDonorCount: 2 };
            CacheService.get.mockResolvedValue(cached);
            const m = await svc.getDashboardMetrics();
            expect(m).toEqual(cached);
            expect(db.query).not.toHaveBeenCalled();
        });

        test('a cache error degrades to a live DB read', async () => {
            CacheService.get.mockResolvedValue(null);
            db.query.mockResolvedValue({ rows: [] });
            const m = await svc.getDashboardMetrics();
            expect(m.totalAllTimeCents).toBe(0);
        });

        test('INVARIANT: the cached dashboard object contains no email-shaped / @-bearing PII', async () => {
            const now = new Date();
            db.query.mockResolvedValue({ rows: [
                { encrypted_amount_cents: encrypt('1800'), encrypted_donor_email: encrypt('donor@example.com'), donation_type: 'recurring', is_anonymous: false, created_at: now }
            ] });
            await svc.getDashboardMetrics();
            const cachedValue = CacheService.set.mock.calls.find((c) => c[0] === DASHBOARD_KEY)[1];
            expect(JSON.stringify(cachedValue)).not.toContain('@');
            expect(JSON.stringify(cachedValue)).not.toContain('donor@example.com');
        });
    });

    describe('finalize busts both metric keys', () => {
        test('a completed donation dels both donations:metrics:* keys', async () => {
            db.query.mockResolvedValueOnce({ rows: [{
                id: 'd1', is_anonymous: false, donation_type: 'one-time',
                encrypted_amount_cents: encrypt('3600'), encrypted_donor_email: encrypt('a@b.com')
            }] });
            await svc.finalize('d1', { transactionId: 'TXN-1' });
            expect(CacheService.del).toHaveBeenCalledWith(MTD_KEY);
            expect(CacheService.del).toHaveBeenCalledWith(DASHBOARD_KEY);
        });

        test('a replay (no pending row) does NOT bust the cache', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            expect(await svc.finalize('d1', { transactionId: 'TXN-1' })).toBeNull();
            expect(CacheService.del).not.toHaveBeenCalled();
        });
    });

    describe('INVARIANT: listDonations never caches rows', () => {
        test('listDonations does not write to CacheService', async () => {
            const client = {
                query: jest.fn()
                    .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                    .mockResolvedValueOnce({ rows: [{ id: 'd1', encrypted_amount_cents: encrypt('1800'), encrypted_donor_email: null, donation_type: 'one-time', recurring_frequency: null, is_anonymous: true, status: 'completed', created_at: new Date() }] }),
                release: jest.fn()
            };
            db.pool.connect.mockResolvedValue(client);
            await svc.listDonations({ page: 1, limit: 20 });
            expect(CacheService.set).not.toHaveBeenCalled();
            expect(CacheService.get).not.toHaveBeenCalled();
        });

        test('toCsv preserves spreadsheet formula-injection escaping through the refactor', () => {
            const csv = svc.toCsv([{ id: 'd1', createdAt: new Date(), amountCents: 1800, donor: '=HYPERLINK("evil")', donationType: 'one-time', recurringFrequency: null, status: 'completed' }]);
            expect(csv).toContain("'=HYPERLINK"); // leading apostrophe neutralizes the formula
        });
    });
});
