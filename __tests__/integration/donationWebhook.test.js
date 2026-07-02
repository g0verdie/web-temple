/**
 * Signed donation webhook receiver + provider-authoritative capture — the
 * security/idempotency integration lane (R18–R22, Acceptance Examples AE1–AE5).
 *
 * Drives the REAL app (src/server.js) so the raw-body capture hook, the CSRF
 * exemption, the real paymentWebhook receiver, and the real MockPaymentProvider
 * all run end-to-end. Only DonationService + the finalize side-effect services
 * are mocked (no live Postgres/Redis), per the integration convention. The
 * provider selector (src/services/payments) is intentionally NOT mocked so AE4
 * exercises the mock's actual server-side rule.
 */

const request = require('supertest');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/DonationService');
jest.mock('../../src/services/receiptPdfService');
jest.mock('../../src/services/emailQueueService');
jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn().mockResolvedValue(undefined),
    AUDIT_ACTIONS: { TAX_RECEIPT_SENT: 'TAX_RECEIPT_SENT', DONATION_RECEIVED: 'DONATION_RECEIVED', DONATION_FAILED: 'DONATION_FAILED' }
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
const paymentWebhook = require('../../src/services/payments/paymentWebhook');
const { enqueueEmail } = require('../../src/services/emailQueueService');
const receiptPdfService = require('../../src/services/receiptPdfService');

const WEBHOOK = '/donations/webhook';
const HEADER = paymentWebhook.SIGNATURE_HEADER;

const postSigned = (rawBody, signature) => {
    const req = request(app).post(WEBHOOK).set('Content-Type', 'application/json');
    if (signature !== undefined) req.set(HEADER, signature);
    return req.send(rawBody);
};

describe('Signed donation webhook receiver', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        receiptPdfService.generate.mockResolvedValue(Buffer.from('%PDF-1.4'));
        DonationService.isMajor.mockReturnValue(false);
    });

    // AE2 / R4 / R5 / R19
    test('a callback whose HMAC does not match the raw body is rejected; donation stays PENDING', async () => {
        DonationService.getById.mockResolvedValue({ id: 'd1', status: 'pending', amountCents: 5000 });
        const { rawBody } = paymentWebhook.signCallback({ donationId: 'd1', amountCents: 5000, status: 'completed', transactionId: 'T1' });

        const res = await postSigned(rawBody, 'not-a-valid-signature-of-the-right-length-or-not');

        expect(res.status).toBe(401);
        expect(DonationService.finalize).not.toHaveBeenCalled();
    });

    // R5 / R19 — absent signature
    test('a callback with NO signature header is rejected; donation stays PENDING', async () => {
        DonationService.getById.mockResolvedValue({ id: 'd1', status: 'pending', amountCents: 5000 });
        const { rawBody } = paymentWebhook.signCallback({ donationId: 'd1', amountCents: 5000, status: 'completed', transactionId: 'T1' });

        const res = await postSigned(rawBody, undefined);

        expect(res.status).toBe(401);
        expect(DonationService.finalize).not.toHaveBeenCalled();
    });

    // AE3 / R7 / R20
    test('a validly-signed callback claiming the WRONG amount is rejected; donation stays PENDING', async () => {
        DonationService.getById.mockResolvedValue({ id: 'd1', status: 'pending', amountCents: 5000 }); // $50 authoritative
        const { rawBody, signature } = paymentWebhook.signCallback({ donationId: 'd1', amountCents: 500, status: 'completed', transactionId: 'T1' }); // claims $5

        const res = await postSigned(rawBody, signature);

        expect(res.status).toBe(409);
        expect(DonationService.finalize).not.toHaveBeenCalled();
    });

    // AE1 / R6 / R18 — replay finalizes exactly once
    test('a replayed valid callback finalizes exactly once — no second receipt/alert', async () => {
        DonationService.getById
            .mockResolvedValueOnce({ id: 'd1', status: 'pending', amountCents: 5000 })
            .mockResolvedValue({ id: 'd1', status: 'completed', amountCents: 5000 });
        DonationService.finalize
            .mockResolvedValueOnce({ id: 'd1', isAnonymous: false, donationType: 'one-time', amountCents: 5000, donorEmail: 'a@b.com' })
            .mockResolvedValue(null);
        const { rawBody, signature } = paymentWebhook.signCallback({ donationId: 'd1', amountCents: 5000, status: 'completed', transactionId: 'T1' });

        const first = await postSigned(rawBody, signature);
        const second = await postSigned(rawBody, signature);

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(DonationService.finalize).toHaveBeenCalledTimes(1);
        expect(enqueueEmail).toHaveBeenCalledTimes(1); // one receipt, not two
    });

    // AE5 / R6 — concurrent callbacks: exactly one finalize wins the transition
    test('two concurrent valid callbacks finalize exactly once (conditional UPDATE admits one transition)', async () => {
        DonationService.getById.mockResolvedValue({ id: 'd1', status: 'pending', amountCents: 5000 });
        DonationService.finalize
            .mockResolvedValueOnce({ id: 'd1', isAnonymous: false, donationType: 'one-time', amountCents: 5000, donorEmail: 'a@b.com' })
            .mockResolvedValue(null); // the losers of the race get null back
        const { rawBody, signature } = paymentWebhook.signCallback({ donationId: 'd1', amountCents: 5000, status: 'completed', transactionId: 'T1' });

        const [a, b] = await Promise.all([postSigned(rawBody, signature), postSigned(rawBody, signature)]);

        expect([a.status, b.status]).toEqual([200, 200]);
        // Side-effects run only for the single call that won the pending→completed
        // transition (returned a row); the other is a no-op.
        expect(enqueueEmail).toHaveBeenCalledTimes(1);
    });

    // R17 — a valid completed callback returns 200 and finalizes
    test('a valid completed callback finalizes and returns 200', async () => {
        DonationService.getById.mockResolvedValue({ id: 'd2', status: 'pending', amountCents: 7500 });
        DonationService.finalize.mockResolvedValue({ id: 'd2', isAnonymous: true, donationType: 'one-time', amountCents: 7500, donorEmail: null });
        const { rawBody, signature } = paymentWebhook.signCallback({ donationId: 'd2', amountCents: 7500, status: 'completed', transactionId: 'T2' });

        const res = await postSigned(rawBody, signature);

        expect(res.status).toBe(200);
        expect(DonationService.finalize).toHaveBeenCalledWith('d2', { transactionId: 'T2' });
    });
});

describe('Provider-authoritative capture (client outcome is ignored)', () => {
    const OWN = 'owntoken';

    beforeEach(() => {
        jest.clearAllMocks();
        receiptPdfService.generate.mockResolvedValue(Buffer.from('%PDF-1.4'));
        DonationService.isMajor.mockReturnValue(false);
    });

    // AE4 / R1 / R2 / R21
    test('POST /complete with outcome=success is DECLINED when the server-side amount rule declines', async () => {
        // Authoritative amount is the exact 1-cent sentinel ($0.01) → the mock's
        // server-side rule declines, regardless of the client-supplied outcome=success.
        DonationService.getById.mockResolvedValue({ id: 'd9', status: 'pending', amountCents: 1, isAnonymous: false, donationType: 'one-time', checkoutToken: OWN });
        DonationService.recordFailure.mockResolvedValue({ id: 'f1' });

        const res = await request(app)
            .post('/donations/checkout/d9/complete')
            .set('Cookie', [`dc_d9=${OWN}`])
            .type('form')
            .send({ outcome: 'success' });

        expect(res.status).toBe(402); // the failed page — NOT completed
        expect(DonationService.finalize).not.toHaveBeenCalled();
        expect(DonationService.recordFailure).toHaveBeenCalled();
    });

    // R21 — a normal amount completes even when the client says failure, and finalize
    // is driven through the signed internal callback (not the client report).
    test('POST /complete with outcome=failure still COMPLETES when the server-side amount rule accepts', async () => {
        DonationService.getById.mockResolvedValue({ id: 'd8', status: 'pending', amountCents: 4000, isAnonymous: true, donationType: 'one-time', checkoutToken: OWN });
        DonationService.finalize.mockResolvedValue({ id: 'd8', isAnonymous: true, donationType: 'one-time', amountCents: 4000, donorEmail: null });

        const res = await request(app)
            .post('/donations/checkout/d8/complete')
            .set('Cookie', [`dc_d8=${OWN}`])
            .type('form')
            .send({ outcome: 'failure' });

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/donations/thank-you');
        expect(DonationService.finalize).toHaveBeenCalledWith('d8', { transactionId: expect.stringMatching(/^MOCK-TXN-/) });
    });
});
