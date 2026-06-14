process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-0123456789abcdef';

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn().mockResolvedValue(undefined),
    AUDIT_ACTIONS: { DONATION_RECEIVED: 'DONATION_RECEIVED', DONATION_FAILED: 'DONATION_FAILED' }
}));

const db = require('../../src/config/db');
const { logAudit } = require('../../src/services/auditService');
const { encrypt, decrypt } = require('../../src/utils/encryptionHelper');
const svc = require('../../src/services/DonationService');

describe('DonationService', () => {
    let mockClient;
    beforeEach(() => {
        jest.clearAllMocks();
        mockClient = { query: jest.fn(), release: jest.fn() };
        db.pool.connect.mockResolvedValue(mockClient);
    });

    describe('createPending', () => {
        test('encrypts amount, omits email when anonymous, inserts pending', async () => {
            db.query.mockResolvedValue({ rows: [{ id: 'd1', created_at: new Date() }] });
            await svc.createPending({ amountCents: 3600, donationType: 'one-time', isAnonymous: true, donorEmail: 'x@y.com' });
            const [sql, params] = db.query.mock.calls[0];
            expect(sql).toContain("'pending'");
            expect(params[0]).not.toBe('3600');
            expect(decrypt(params[0])).toBe('3600');
            expect(params[1]).toBeNull(); // no donor email persisted for anonymous (8.4)
        });

        test('encrypts donor email for a non-anonymous donation', async () => {
            db.query.mockResolvedValue({ rows: [{ id: 'd1', created_at: new Date() }] });
            await svc.createPending({ amountCents: 1800, donationType: 'one-time', donorEmail: 'a@b.com' });
            expect(decrypt(db.query.mock.calls[0][1][1])).toBe('a@b.com');
        });

        test('rejects amounts below the floor, non-integers, and over the ceiling (KTD11)', async () => {
            await expect(svc.createPending({ amountCents: 50, donationType: 'one-time' })).rejects.toThrow(/minimum/);
            await expect(svc.createPending({ amountCents: 18.5, donationType: 'one-time' })).rejects.toThrow(/Invalid amount/);
            await expect(svc.createPending({ amountCents: 2000000000, donationType: 'one-time' })).rejects.toThrow(/maximum/);
            expect(db.query).not.toHaveBeenCalled();
        });

        test('rejects an invalid donation type', async () => {
            await expect(svc.createPending({ amountCents: 1800, donationType: 'bogus' })).rejects.toThrow(/type/);
        });
    });

    describe('finalize (idempotent)', () => {
        test('completes a pending donation once and audits without plaintext amount', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 'd1', is_anonymous: false, donation_type: 'one-time', encrypted_amount_cents: encrypt('3600'), encrypted_donor_email: encrypt('a@b.com') }] });
            const res = await svc.finalize('d1', { transactionId: 'TXN-1' });
            expect(res).toMatchObject({ id: 'd1', amountCents: 3600, donorEmail: 'a@b.com' });
            const [sql] = db.query.mock.calls[0];
            expect(sql).toMatch(/WHERE id = \$1 AND status = 'pending'/);
            const auditCall = logAudit.mock.calls[0][0];
            expect(auditCall.action).toBe('DONATION_RECEIVED');
            expect(JSON.stringify(auditCall)).not.toContain('3600'); // no plaintext amount in audit (KTD10)
            expect(JSON.stringify(auditCall)).not.toContain('a@b.com');
        });

        test('returns null on replay (no pending row) — no duplicate side-effects', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            expect(await svc.finalize('d1', { transactionId: 'TXN-1' })).toBeNull();
            expect(logAudit).not.toHaveBeenCalled();
        });
    });

    describe('isMajor', () => {
        test('is strictly greater than $100', () => {
            expect(svc.isMajor(10000)).toBe(false);
            expect(svc.isMajor(10001)).toBe(true);
        });
    });

    describe('getDashboardMetrics', () => {
        test('sums decrypted amounts and dedupes donors', async () => {
            const now = new Date();
            db.query.mockResolvedValue({ rows: [
                { encrypted_amount_cents: encrypt('1800'), encrypted_donor_email: encrypt('a@b.com'), donation_type: 'one-time', is_anonymous: false, created_at: now },
                { encrypted_amount_cents: encrypt('3600'), encrypted_donor_email: encrypt('a@b.com'), donation_type: 'recurring', is_anonymous: false, created_at: now },
                { encrypted_amount_cents: encrypt('5000'), encrypted_donor_email: null, donation_type: 'one-time', is_anonymous: true, created_at: now }
            ] });
            const m = await svc.getDashboardMetrics();
            expect(m.totalAllTimeCents).toBe(1800 + 3600 + 5000);
            expect(m.donorCount).toBe(2); // a@b.com (deduped) + 1 anonymous
            expect(m.monthlyRecurringRevenueCents).toBe(3600);
        });
    });

    describe('listDonations + toCsv', () => {
        test('lists with anonymous masking and exports CSV', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'd1', encrypted_amount_cents: encrypt('1800'), encrypted_donor_email: null, donation_type: 'one-time', recurring_frequency: null, is_anonymous: true, status: 'completed', created_at: new Date('2026-06-14T00:00:00Z') }] });
            const { donations } = await svc.listDonations({ page: 1, limit: 20 });
            expect(donations[0]).toMatchObject({ donor: 'Anonymous', amountCents: 1800 });
            const csv = svc.toCsv(donations);
            expect(csv.split('\n')[0]).toContain('amount_usd');
            expect(csv).toContain('18.00');
            expect(csv).toContain('Anonymous');
        });
    });
});
