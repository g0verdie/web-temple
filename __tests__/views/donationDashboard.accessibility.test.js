/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.setImmediate = global.setImmediate || process.nextTick;

const request = require('supertest');
const { axe, toHaveNoViolations } = require('jest-axe');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/DonationService');

const app = require('../../src/server');
const db = require('../../src/config/db');
const DonationService = require('../../src/services/DonationService');

expect.extend(toHaveNoViolations);
const AXE = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } };

describe('Donation dashboard accessibility (WCAG AA)', () => {
    let treasurerToken;
    beforeAll(() => {
        treasurerToken = jwt.sign({ user_id: 'treasurer-1', role: 'treasurer', email: 't@x.com', token_version: 1 }, process.env.JWT_SECRET || 'test-jwt-secret');
    });
    afterEach(() => jest.clearAllMocks());
    beforeEach(() => {
        db.query.mockResolvedValue({ rows: [{ id: 'treasurer-1', token_version: 1, role: 'treasurer', email: 't@x.com' }] });
        DonationService.getDashboardMetrics.mockResolvedValue({ totalAllTimeCents: 54000, totalYtdCents: 54000, totalMtdCents: 3600, identifiedDonorCount: 3, anonymousGiftCount: 1, recurringDonorCount: 1, monthlyRecurringRevenueCents: 3600 });
        DonationService.listDonations.mockResolvedValue({ donations: [{ id: 'd1', amountCents: 3600, donor: 'Anonymous', donationType: 'one-time', recurringFrequency: null, createdAt: new Date('2026-06-14') }], totalCount: 1, totalPages: 1, currentPage: 1 });
    });

    test('admin donation dashboard has no violations', async () => {
        const res = await request(app).get('/admin/donations').set('Cookie', [`auth_token=${treasurerToken}`]);
        expect(res.status).toBe(200);
        expect(await axe(res.text, AXE)).toHaveNoViolations();
    });
});
