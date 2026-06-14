const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/DonationService');
jest.mock('../../src/services/payments');

const app = require('../../src/server');
const db = require('../../src/config/db');
const DonationService = require('../../src/services/DonationService');

const memberToken = jwt.sign({ user_id: 'member-1', role: 'member', email: 'm@x.com', token_version: 1 }, process.env.JWT_SECRET || 'test-jwt-secret');

describe('Donation route protection + anonymity matrix', () => {
    afterEach(() => jest.clearAllMocks());
    beforeEach(() => {
        db.query.mockResolvedValue({ rows: [{ id: 'member-1', token_version: 1, role: 'member', email: 'm@x.com' }] });
    });

    describe('public donations surface needs no auth', () => {
        test('GET /donations is public', async () => {
            const res = await request(app).get('/donations');
            expect(res.status).toBe(200);
        });
        test('GET /donations/thank-you is public', async () => {
            const res = await request(app).get('/donations/thank-you');
            expect(res.status).toBe(200);
        });
    });

    describe('admin dashboard is gated to VIEW_DONATIONS', () => {
        test('member → 403', async () => {
            const res = await request(app).get('/admin/donations').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(403);
        });
    });

    describe('checkout completion is ownership-bound (no forge)', () => {
        test('completing without the checkout cookie → 403', async () => {
            DonationService.getById.mockResolvedValue({ id: 'd1', status: 'pending', amountCents: 3600, isAnonymous: false, donationType: 'one-time', checkoutToken: 'secret' });
            const res = await request(app)
                .post('/donations/checkout/d1/complete')
                .type('form')
                .send({ outcome: 'success' });
            expect(res.status).toBe(403);
        });
    });

    describe('anonymity invariant', () => {
        test('an anonymous donation never shows PII in the dashboard payload', async () => {
            const treasurerToken = jwt.sign({ user_id: 'treasurer-1', role: 'treasurer', email: 't@x.com', token_version: 1 }, process.env.JWT_SECRET || 'test-jwt-secret');
            db.query.mockResolvedValue({ rows: [{ id: 'treasurer-1', token_version: 1, role: 'treasurer', email: 't@x.com' }] });
            DonationService.getDashboardMetrics.mockResolvedValue({ totalAllTimeCents: 3600, totalYtdCents: 3600, totalMtdCents: 3600, donorCount: 1, recurringDonorCount: 0, monthlyRecurringRevenueCents: 0 });
            DonationService.listDonations.mockResolvedValue({ donations: [{ id: 'd1', amountCents: 3600, donor: 'Anonymous', donationType: 'one-time', recurringFrequency: null, createdAt: new Date() }], totalCount: 1, totalPages: 1, currentPage: 1 });

            const res = await request(app).get('/admin/donations').set('Cookie', [`auth_token=${treasurerToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).toContain('Anonymous');
            expect(res.text).not.toMatch(/donor[^<]*@/i); // no donor email rendered
        });
    });
});
