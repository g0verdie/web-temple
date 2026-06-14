const MockPaymentProvider = require('./MockPaymentProvider');

/**
 * Select the active payment provider by env. Defaults to the mock used for the
 * MVP / Board demo. A real PayPalProvider would be added here behind the same
 * PaymentProvider interface once the Board authorizes live credentials.
 * (A circuit-breaker wrapper belongs with the real provider — the mock cannot
 * fail in the ways a breaker guards against, so it is deferred with PayPal.)
 */
let provider = null;

const getProvider = () => {
    if (provider) return provider;
    const name = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
    switch (name) {
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
