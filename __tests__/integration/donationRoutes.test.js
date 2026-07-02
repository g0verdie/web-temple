const request = require('supertest');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/DonationService');
jest.mock('../../src/services/payments');
jest.mock('../../src/services/receiptPdfService');
jest.mock('../../src/services/emailQueueService');
jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn().mockResolvedValue(undefined),
    AUDIT_ACTIONS: { TAX_RECEIPT_SENT: 'TAX_RECEIPT_SENT' }
}));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));
jest.mock('../../src/services/CacheService', () => {
    const store = {};
    return {
        get: jest.fn(async (k) => (k in store ? store[k] : null)),
        set: jest.fn(async (k, v) => { store[k] = v; }),
        del: jest.fn(async () => {}),
        invalidatePattern: jest.fn(async () => {})
    };
});

const app = require('../../src/server');
const DonationService = require('../../src/services/DonationService');
const payments = require('../../src/services/payments');
const receiptPdfService = require('../../src/services/receiptPdfService');
const { enqueueEmail } = require('../../src/services/emailQueueService');

const TOKEN = 'cookietoken123';
const ID = 'don-1';

describe('Donation routes (public, mock provider)', () => {
    let capture;

    beforeEach(() => {
        jest.clearAllMocks();
        capture = jest.fn();
        payments.getProvider.mockReturnValue({
            createCheckout: jest.fn().mockResolvedValue({ checkoutId: ID, providerRef: 'MOCK-1' }),
            capture
        });
        DonationService.isMajor.mockReturnValue(false);
        receiptPdfService.generate.mockResolvedValue(Buffer.from('%PDF-1.4'));
    });

    test('GET /donations renders the public page (no auth)', async () => {
        const res = await request(app).get('/donations');
        expect(res.status).toBe(200);
        expect(res.text).toContain('id="donationForm"');
        expect(res.text).toContain('Chai');
    });

    test('POST /donations/checkout creates a pending donation, sets cookie, redirects', async () => {
        DonationService.createPending.mockResolvedValue({ id: ID, created_at: new Date() });
        const res = await request(app)
            .post('/donations/checkout')
            .type('form')
            .send({ amount_cents: '3600', donation_type: 'one-time', donor_email: 'a@b.com' });
        expect(res.status).toBe(302);
        expect(res.header.location).toBe(`/donations/checkout/${ID}`);
        expect(res.header['set-cookie'].join(';')).toMatch(new RegExp(`dc_${ID}=`));
        expect(DonationService.createPending).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 3600, donationType: 'one-time' }));
    });

    test('POST /donations/checkout with an invalid amount → 400', async () => {
        DonationService.createPending.mockRejectedValue(new Error('Invalid amount: minimum donation is $1.00'));
        const res = await request(app)
            .post('/donations/checkout')
            .type('form')
            .send({ amount_cents: '5', donation_type: 'one-time' });
        expect(res.status).toBe(400);
    });

    test('GET /donations/checkout/:id renders the DEMO step for a pending donation', async () => {
        DonationService.getById.mockResolvedValue({ id: ID, status: 'pending', amountCents: 3600, donationType: 'one-time', checkoutToken: TOKEN });
        const res = await request(app).get(`/donations/checkout/${ID}`);
        expect(res.status).toBe(200);
        expect(res.text).toMatch(/DEMO/);
        expect(res.text).toContain('Simulate Success');
    });

    test('complete without the ownership cookie → 403', async () => {
        DonationService.getById.mockResolvedValue({ id: ID, status: 'pending', amountCents: 3600, isAnonymous: false, donationType: 'one-time', checkoutToken: TOKEN });
        const res = await request(app)
            .post(`/donations/checkout/${ID}/complete`)
            .type('form')
            .send({ outcome: 'success' });
        expect(res.status).toBe(403);
        expect(capture).not.toHaveBeenCalled();
    });

    test('complete with cookie + success → finalize + receipt enqueued + redirect to thank-you', async () => {
        DonationService.getById.mockResolvedValue({ id: ID, status: 'pending', amountCents: 3600, isAnonymous: false, donationType: 'one-time', checkoutToken: TOKEN });
        // capture is provider-authoritative: it reports the server-side amount, which
        // the signed callback receiver recomputes against the authoritative row.
        capture.mockResolvedValue({ status: 'completed', transactionId: 'MOCK-TXN-1', amountCents: 3600 });
        DonationService.finalize.mockResolvedValue({ id: ID, isAnonymous: false, donationType: 'one-time', amountCents: 3600, donorEmail: 'a@b.com' });

        const res = await request(app)
            .post(`/donations/checkout/${ID}/complete`)
            .set('Cookie', [`dc_${ID}=${TOKEN}`])
            .type('form')
            .send({ outcome: 'success' });

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/donations/thank-you');
        expect(DonationService.finalize).toHaveBeenCalledWith(ID, { transactionId: 'MOCK-TXN-1' });
        expect(enqueueEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'a@b.com',
            attachments: expect.arrayContaining([expect.objectContaining({ filename: 'tax-receipt.pdf' })])
        }));
    });

    test('complete with cookie + failure → records failure + 402 retry page, no receipt', async () => {
        DonationService.getById.mockResolvedValue({ id: ID, status: 'pending', amountCents: 3600, isAnonymous: false, donationType: 'one-time', checkoutToken: TOKEN });
        capture.mockResolvedValue({ status: 'failed', errorCode: 'MOCK_DECLINED' });
        DonationService.recordFailure.mockResolvedValue({ id: 'fail-1' });

        const res = await request(app)
            .post(`/donations/checkout/${ID}/complete`)
            .set('Cookie', [`dc_${ID}=${TOKEN}`])
            .type('form')
            .send({ outcome: 'failure' });

        expect(res.status).toBe(402);
        expect(res.text).toMatch(/Retry Payment/);
        expect(DonationService.recordFailure).toHaveBeenCalled();
        expect(enqueueEmail).not.toHaveBeenCalled();
    });

    test('alerts the admin after 3 failed attempts (server-side counter)', async () => {
        process.env.ADMIN_EMAIL = 'admin@temple.org';
        const failId = 'don-fail-3strike';
        DonationService.getById.mockResolvedValue({ id: failId, status: 'pending', amountCents: 3600, isAnonymous: false, donationType: 'one-time', checkoutToken: TOKEN });
        capture.mockResolvedValue({ status: 'failed', errorCode: 'MOCK_DECLINED' });
        DonationService.recordFailure.mockResolvedValue({ id: 'f' });

        const post = () => request(app)
            .post(`/donations/checkout/${failId}/complete`)
            .set('Cookie', [`dc_${failId}=${TOKEN}`])
            .type('form')
            .send({ outcome: 'failure' });

        await post();
        await post();
        expect(enqueueEmail).not.toHaveBeenCalled(); // below the threshold
        await post();
        expect(enqueueEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'admin@temple.org',
            subject: expect.stringMatching(/Repeated donation failures/)
        }));
    });

    test('anonymous success does not enqueue a donor receipt email', async () => {
        DonationService.getById.mockResolvedValue({ id: ID, status: 'pending', amountCents: 3600, isAnonymous: true, donationType: 'one-time', checkoutToken: TOKEN });
        capture.mockResolvedValue({ status: 'completed', transactionId: 'MOCK-TXN-2', amountCents: 3600 });
        DonationService.finalize.mockResolvedValue({ id: ID, isAnonymous: true, donationType: 'one-time', amountCents: 3600, donorEmail: null });

        const res = await request(app)
            .post(`/donations/checkout/${ID}/complete`)
            .set('Cookie', [`dc_${ID}=${TOKEN}`])
            .type('form')
            .send({ outcome: 'success' });

        expect(res.status).toBe(302);
        expect(enqueueEmail).not.toHaveBeenCalled();
    });
});
