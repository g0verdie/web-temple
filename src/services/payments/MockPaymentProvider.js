const PaymentProvider = require('./PaymentProvider');

/**
 * MockPaymentProvider — a no-charge demo provider for the MVP Board presentation.
 *
 * Stateless: the DB PENDING donation row is the source of truth. capture() is
 * PROVIDER-AUTHORITATIVE (plan R1/R3): it derives the terminal outcome from the
 * SERVER-SIDE amount ONLY — never from a client-supplied outcome/amount — so a
 * hand-crafted POST cannot fabricate a completed donation. The result is then
 * delivered to the receiver through the same signed webhook a real provider would
 * call (see services/payments/paymentWebhook.js), so this mock exercises the real
 * signature-verification + amount-recompute + idempotent-finalize code.
 *
 * Sentinel-amount rule (R3) — lets the Board demo exercise all three terminal
 * paths deterministically by choosing the amount, with no trusted client input:
 *   - cents ending in 01  → declined (failed)
 *   - cents ending in 02  → cancelled
 *   - any other valid amount → completed (success)
 * An invalid/absent amount fails closed (never an accidental success).
 */
const DECLINE_SENTINEL = 1; // amountCents % 100 === 1
const CANCEL_SENTINEL = 2;  // amountCents % 100 === 2

class MockPaymentProvider extends PaymentProvider {
    isMock() {
        return true;
    }

    async createCheckout({ donationId }) {
        // No real session needed — the donation row IS the checkout state.
        return { checkoutId: String(donationId), providerRef: `MOCK-${donationId}` };
    }

    async capture(checkoutId, { amountCents } = {}) {
        const cents = Number(amountCents);
        // Fail closed on an invalid/absent authoritative amount: the outcome must
        // come from server state, and a missing amount must never mean success.
        if (!Number.isInteger(cents) || cents <= 0) {
            return { status: 'failed', transactionId: null, amountCents: cents || 0, errorCode: 'MOCK_INVALID_AMOUNT' };
        }
        const sentinel = cents % 100;
        if (sentinel === DECLINE_SENTINEL) {
            return { status: 'failed', transactionId: null, amountCents: cents, errorCode: 'MOCK_DECLINED' };
        }
        if (sentinel === CANCEL_SENTINEL) {
            return { status: 'cancelled', transactionId: null, amountCents: cents };
        }
        return { status: 'completed', transactionId: `MOCK-TXN-${checkoutId}`, amountCents: cents };
    }
}

module.exports = MockPaymentProvider;
