/**
 * PaymentProvider — the interface donation processing is written against.
 *
 * Implementations: MockPaymentProvider (MVP / Board demo), and a future
 * PayPalProvider that drops in behind this same seam once the Board authorizes
 * real credentials.
 *
 * Integrity contract (see plan KTD9): a real provider MUST derive the capture
 * outcome from the provider's own authority (e.g. a verified PayPal callback),
 * never from client-supplied data. The controller is responsible for ownership
 * (signed checkout cookie) and idempotency (finalize only from a pending row)
 * regardless of provider.
 */
class PaymentProvider {
    /**
     * Begin a checkout for an already-created PENDING donation row.
     * @returns {Promise<{ checkoutId: string, providerRef: string }>}
     */
    // eslint-disable-next-line no-unused-vars
    async createCheckout(params) {
        throw new Error('PaymentProvider.createCheckout not implemented');
    }

    /**
     * Resolve the checkout to a terminal outcome.
     * @returns {Promise<{ status: 'completed'|'failed'|'cancelled', transactionId: ?string, errorCode?: string }>}
     */
    // eslint-disable-next-line no-unused-vars
    async capture(checkoutId, context) {
        throw new Error('PaymentProvider.capture not implemented');
    }
}

module.exports = PaymentProvider;
