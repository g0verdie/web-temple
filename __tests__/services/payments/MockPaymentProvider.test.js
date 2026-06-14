const MockPaymentProvider = require('../../../src/services/payments/MockPaymentProvider');
const { getProvider, _reset } = require('../../../src/services/payments');

describe('MockPaymentProvider', () => {
    const mock = new MockPaymentProvider();

    test('createCheckout ties the checkout to the donation row (no in-memory state)', async () => {
        const res = await mock.createCheckout({ donationId: 'don-1' });
        expect(res.checkoutId).toBe('don-1');
        expect(res.providerRef).toMatch(/^MOCK-/);
    });

    test('capture(success) -> completed with a transaction id', async () => {
        const res = await mock.capture('don-1', { outcome: 'success' });
        expect(res).toMatchObject({ status: 'completed' });
        expect(res.transactionId).toBeTruthy();
    });

    test('capture(failure) -> failed with an error code, no transaction id', async () => {
        const res = await mock.capture('don-1', { outcome: 'failure' });
        expect(res).toMatchObject({ status: 'failed', transactionId: null, errorCode: 'MOCK_DECLINED' });
    });

    test('capture(cancel) -> cancelled', async () => {
        const res = await mock.capture('don-1', { outcome: 'cancel' });
        expect(res.status).toBe('cancelled');
    });

    test('capture defaults to failed for an unknown/missing outcome (no accidental success)', async () => {
        expect((await mock.capture('don-1', {})).status).toBe('failed');
        expect((await mock.capture('don-1')).status).toBe('failed');
    });
});

describe('payments provider selector', () => {
    afterEach(() => _reset());

    test('defaults to the mock provider', () => {
        _reset();
        expect(getProvider().isMock()).toBe(true);
    });
});
