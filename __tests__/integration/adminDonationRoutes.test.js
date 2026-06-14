const request = require('supertest');
const app = require('../../src/server');
const db = require('../../src/config/db');
const DonationService = require('../../src/services/DonationService');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/DonationService');

const mkToken = (role) => jwt.sign(
    { user_id: `${role}-1`, role, email: `${role}@x.com`, token_version: 1 },
    process.env.JWT_SECRET || 'test-jwt-secret'
);

describe('Admin donation dashboard', () => {
    let adminToken, treasurerToken, memberToken;

    beforeAll(() => {
        adminToken = mkToken('admin');
        treasurerToken = mkToken('treasurer');
        memberToken = mkToken('member');
    });

    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        db.query.mockImplementation((sql, params) => {
            const id = params && params[0];
            const role = String(id || '').split('-')[0] || 'member';
            return Promise.resolve({ rows: [{ id, token_version: 1, role, email: `${role}@x.com` }] });
        });
        DonationService.getDashboardMetrics.mockResolvedValue({
            totalAllTimeCents: 54000, totalYtdCents: 54000, totalMtdCents: 3600,
            donorCount: 3, recurringDonorCount: 1, monthlyRecurringRevenueCents: 3600
        });
        DonationService.listDonations.mockResolvedValue({
            donations: [{ id: 'd1', amountCents: 3600, donor: 'Anonymous', donationType: 'one-time', recurringFrequency: null, createdAt: new Date('2026-06-14') }],
            totalCount: 1, totalPages: 1, currentPage: 1
        });
        DonationService.toCsv.mockReturnValue('id,date,amount_usd,donor,type,recurring_frequency,status\n"d1","2026-06-14","36.00","Anonymous","one-time","","completed"');
    });

    test('member is denied (403)', async () => {
        const res = await request(app).get('/admin/donations').set('Cookie', [`auth_token=${memberToken}`]);
        expect(res.status).toBe(403);
        expect(DonationService.getDashboardMetrics).not.toHaveBeenCalled();
    });

    test('treasurer sees the dashboard with totals', async () => {
        const res = await request(app).get('/admin/donations').set('Cookie', [`auth_token=${treasurerToken}`]);
        expect(res.status).toBe(200);
        expect(res.text).toContain('All-time');
        expect(res.text).toContain('540.00');
        expect(res.text).toContain('Anonymous'); // anonymous masking in the list
        expect(DonationService.getDashboardMetrics).toHaveBeenCalled();
    });

    test('admin can export CSV', async () => {
        const res = await request(app).get('/admin/donations/export.csv').set('Cookie', [`auth_token=${adminToken}`]);
        expect(res.status).toBe(200);
        expect(res.header['content-type']).toMatch(/text\/csv/);
        expect(res.header['content-disposition']).toMatch(/attachment/);
        expect(res.text.split('\n')[0]).toContain('amount_usd');
    });

    test('member cannot export CSV (403)', async () => {
        const res = await request(app).get('/admin/donations/export.csv').set('Cookie', [`auth_token=${memberToken}`]);
        expect(res.status).toBe(403);
        expect(DonationService.toCsv).not.toHaveBeenCalled();
    });
});
