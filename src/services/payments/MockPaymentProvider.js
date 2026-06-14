const PaymentProvider = require('./PaymentProvider');

/**
 * MockPaymentProvider — a no-charge demo provider for the MVP Board presentation.
 *
 * Stateless: the DB PENDING donation row is the source of truth (the controller
 * verifies the row is pending and that the request carries the matching signed
 * checkout cookie before calling capture). The demo outcome (success/failure/
 * cancel) is honored ONLY because this is the mock; a real provider would ignore
 * any client-supplied outcome and read the payment processor's authority instead.
 */
class MockPaymentProvider extends PaymentProvider {
    isMock() {
        return true;
    }

    async createCheckout({ donationId }) {
        // No real session needed — the donation row IS the checkout state.
        return { checkoutId: String(donationId), providerRef: `MOCK-${donationId}` };
    }

    async capture(checkoutId, { outcome } = {}) {
        switch (outcome) {
            case 'success':
                return { status: 'completed', transactionId: `MOCK-TXN-${checkoutId}` };
            case 'cancel':
                return { status: 'cancelled', transactionId: null };
            case 'failure':
            default:
                return { status: 'failed', transactionId: null, errorCode: 'MOCK_DECLINED' };
        }
    }
}

module.exports = MockPaymentProvider;
