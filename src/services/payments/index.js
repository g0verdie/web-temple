const MockPaymentProvider = require('./MockPaymentProvider');
const PayPalProvider = require('./PayPalProvider');

/**
 * Select the active payment provider by env. Defaults to the mock used for the
 * MVP / Board demo. PayPalProvider is a STUB behind the same PaymentProvider
 * interface, selectable via PAYMENT_PROVIDER=paypal but not wired to any SDK or
 * credentials (plan R15/R16) — go-live is a credential swap once the Board
 * authorizes it. (A circuit-breaker wrapper belongs with the real provider — the
 * mock cannot fail in the ways a breaker guards against, so it is deferred with
 * PayPal.)
 */
let provider = null;

const getProvider = () => {
    if (provider) return provider;
    const name = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
    switch (name) {
        case 'paypal':
            provider = new PayPalProvider();
            break;
        case 'mock':
        default:
            provider = new MockPaymentProvider();
            break;
    }
    return provider;
};

// Test helper to reset the memoized provider between cases.
const _reset = () => { provider = null; };

module.exports = { getProvider, _reset };
