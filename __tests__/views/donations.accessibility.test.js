/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.setImmediate = global.setImmediate || process.nextTick;

const request = require('supertest');
const { axe, toHaveNoViolations } = require('jest-axe');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/DonationService');

const app = require('../../src/server');
const DonationService = require('../../src/services/DonationService');

expect.extend(toHaveNoViolations);
const AXE = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } };

describe('Donations public pages accessibility (WCAG AA)', () => {
    afterEach(() => jest.clearAllMocks());

    test('donations page has no violations', async () => {
        const res = await request(app).get('/donations');
        expect(res.status).toBe(200);
        expect(await axe(res.text, AXE)).toHaveNoViolations();
    });

    test('simulated checkout step has no violations', async () => {
        DonationService.getById.mockResolvedValue({ id: 'd1', status: 'pending', amountCents: 3600, donationType: 'one-time', checkoutToken: 't' });
        const res = await request(app).get('/donations/checkout/d1');
        expect(res.status).toBe(200);
        expect(await axe(res.text, AXE)).toHaveNoViolations();
    });

    test('thank-you page has no violations', async () => {
        const res = await request(app).get('/donations/thank-you');
        expect(res.status).toBe(200);
        expect(await axe(res.text, AXE)).toHaveNoViolations();
    });
});
