const MockPaymentProvider = require('../../../src/services/payments/MockPaymentProvider');
const { getProvider, _reset } = require('../../../src/services/payments');

describe('MockPaymentProvider (provider-authoritative, server-side rule)', () => {
    const mock = new MockPaymentProvider();

    test('createCheckout ties the checkout to the donation row (no in-memory state)', async () => {
        const res = await mock.createCheckout({ donationId: 'don-1' });
        expect(res.checkoutId).toBe('don-1');
        expect(res.providerRef).toMatch(/^MOCK-/);
    });

    test('capture decides the outcome from the server-side amount (a normal amount completes)', async () => {
        const res = await mock.capture('don-1', { amountCents: 3600 });
        expect(res).toMatchObject({ status: 'completed', amountCents: 3600 });
        expect(res.transactionId).toBeTruthy();
    });

    test('capture IGNORES any client-supplied outcome (provider-authoritative, R1/R21)', async () => {
        // Client says success, but the exact sentinel amount declines → declined wins.
        expect((await mock.capture('don-1', { amountCents: 1, outcome: 'success' })).status).toBe('failed');
        // Client says failure, but a normal amount → still completes.
        expect((await mock.capture('don-1', { amountCents: 4000, outcome: 'failure' })).status).toBe('completed');
    });

    test('the exact 1-cent sentinel ($0.01) → declined (failed) with an error code, no transaction id', async () => {
        const res = await mock.capture('don-1', { amountCents: 1 });
        expect(res).toMatchObject({ status: 'failed', transactionId: null, errorCode: 'MOCK_DECLINED' });
    });

    test('the exact 2-cent sentinel ($0.02) → cancelled', async () => {
        const res = await mock.capture('don-1', { amountCents: 2 });
        expect(res.status).toBe('cancelled');
    });

    test('realistic amounts ending in 01/02 complete — no false sentinel match (exact-amount rule)', async () => {
        expect((await mock.capture('don-1', { amountCents: 5001 })).status).toBe('completed');  // $50.01
        expect((await mock.capture('don-1', { amountCents: 10002 })).status).toBe('completed'); // $100.02
    });

    test('an invalid/absent amount never yields an accidental success', async () => {
        expect((await mock.capture('don-1', {})).status).toBe('failed');
        expect((await mock.capture('don-1')).status).toBe('failed');
        expect((await mock.capture('don-1', { amountCents: 0 })).status).toBe('failed');
    });
});

describe('payments provider selector', () => {
    afterEach(() => _reset());

    test('defaults to the mock provider', () => {
        _reset();
        expect(getProvider().isMock()).toBe(true);
    });

    test('PAYMENT_PROVIDER=paypal selects the (unwired) PayPal stub', () => {
        _reset();
        const prev = process.env.PAYMENT_PROVIDER;
        process.env.PAYMENT_PROVIDER = 'paypal';
        try {
            const p = getProvider();
            expect(p.isMock()).toBe(false);
            expect(p.constructor.name).toBe('PayPalProvider');
        } finally {
            if (prev === undefined) delete process.env.PAYMENT_PROVIDER;
            else process.env.PAYMENT_PROVIDER = prev;
            _reset();
        }
    });
});
