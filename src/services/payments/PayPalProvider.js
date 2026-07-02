const PaymentProvider = require('./PaymentProvider');
const { ProviderError } = require('../../errors');

/**
 * PayPalProvider — a STUB behind the PaymentProvider interface (plan R15).
 *
 * Selectable via PAYMENT_PROVIDER=paypal, but deliberately NOT wired to any
 * PayPal SDK or credentials: go-live is a credential swap, not a from-scratch
 * security build (the signature-verified receiver + amount recompute + idempotent
 * finalize already exist and are frozen by the conformance suite). Until it is
 * implemented, any provider-path call raises ProviderError (→ 502 via mapError,
 * plan R17), never a silent success.
 *
 * The mock stays the ACTIVE provider (PAYMENT_PROVIDER defaults to "mock").
 */
class PayPalProvider extends PaymentProvider {
    // eslint-disable-next-line no-unused-vars
    async createCheckout(params) {
        throw new ProviderError('PayPalProvider is not yet wired (no SDK or credentials).', {
            clientMessage: 'The payment provider is temporarily unavailable.'
        });
    }

    // eslint-disable-next-line no-unused-vars
    async capture(checkoutId, context) {
        throw new ProviderError('PayPalProvider is not yet wired (no SDK or credentials).', {
            clientMessage: 'The payment provider is temporarily unavailable.'
        });
    }
}

module.exports = PayPalProvider;
