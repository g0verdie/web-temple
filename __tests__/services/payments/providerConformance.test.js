/**
 * Provider conformance suite (R12–R14).
 *
 * Encodes the OWASP third-party-gateway rules as executable assertions —
 * server-side amount recompute, provider-authoritative status, idempotent
 * finalize, signature-verified callbacks — written to the OWASP CONTRACT rather
 * than to the mock's current shape (R13). MockPaymentProvider passes today;
 * PayPalProvider is referenced as the future implementation that MUST pass the
 * same assertions once wired, without requiring it to be wired here (R14).
 *
 * The receiver (paymentWebhook) is provider-agnostic, so the callback/finalize
 * assertions are the same for every provider; the provider-specific rule is that
 * capture() derives status from provider/server authority, never client input.
 */

jest.mock('../../../src/services/DonationService');
jest.mock('../../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));

const DonationService = require('../../../src/services/DonationService');
const paymentWebhook = require('../../../src/services/payments/paymentWebhook');
const MockPaymentProvider = require('../../../src/services/payments/MockPaymentProvider');
const PayPalProvider = require('../../../src/services/payments/PayPalProvider');
const { ProviderError } = require('../../../src/errors');

function conformance(label, makeProvider, { wired }) {
  describe(`Provider conformance (OWASP third-party gateway): ${label}`, () => {
    if (!wired) {
      // R14/R15: the stub exists behind the interface and is selectable, but is
      // NOT wired to any SDK/credentials — a provider-path call raises ProviderError.
      test(`${label} is a selectable PaymentProvider stub, not wired to any SDK/credentials`, async () => {
        const p = makeProvider();
        expect(p.isMock()).toBe(false);
        await expect(p.capture('x', { amountCents: 3600 })).rejects.toBeInstanceOf(ProviderError);
        await expect(p.createCheckout({ donationId: 'x' })).rejects.toBeInstanceOf(ProviderError);
      });
      // The behavioral OWASP assertions are the SAME contract this future provider
      // must satisfy once wired (documented, not silently skipped).
      test.todo(`${label} MUST pass the same OWASP conformance assertions once wired`);
      return;
    }

    beforeEach(() => jest.clearAllMocks());

    test('provider-authoritative status — capture ignores any client-supplied outcome/amount', async () => {
      const p = makeProvider();
      // Client tries to force a success on an amount whose server-side rule declines,
      // and to inject a different amount; both are ignored.
      const declined = await p.capture('don-1', { amountCents: 5001, outcome: 'success', amount: 999999 });
      expect(declined.status).toBe('failed');
      // And a normal amount completes even if the client asked to fail.
      const accepted = await p.capture('don-1', { amountCents: 3600, outcome: 'failure' });
      expect(accepted.status).toBe('completed');
      expect(accepted.amountCents).toBe(3600);
    });

    test('server-side amount recompute — a mismatched callback amount is rejected, not finalized', async () => {
      DonationService.getById.mockResolvedValue({ id: 'don-1', status: 'pending', amountCents: 5000 });
      const { rawBody, signature } = paymentWebhook.signCallback({ donationId: 'don-1', amountCents: 500, status: 'completed', transactionId: 'T1' });
      const res = await paymentWebhook.processSignedCallback({ rawBody, signature });
      expect(res.finalized).toBe(false);
      expect(res.reason).toBe('amount_mismatch');
      expect(DonationService.finalize).not.toHaveBeenCalled();
    });

    test('signature-verified callbacks — a bad or absent signature is rejected, not finalized', async () => {
      DonationService.getById.mockResolvedValue({ id: 'don-1', status: 'pending', amountCents: 5000 });
      const { rawBody } = paymentWebhook.signCallback({ donationId: 'don-1', amountCents: 5000, status: 'completed', transactionId: 'T1' });
      expect((await paymentWebhook.processSignedCallback({ rawBody, signature: 'forged' })).finalized).toBe(false);
      expect((await paymentWebhook.processSignedCallback({ rawBody, signature: undefined })).finalized).toBe(false);
      expect(DonationService.finalize).not.toHaveBeenCalled();
    });

    test('idempotent finalize — a replayed valid callback finalizes at most once', async () => {
      DonationService.getById
        .mockResolvedValueOnce({ id: 'don-1', status: 'pending', amountCents: 5000 })
        .mockResolvedValue({ id: 'don-1', status: 'completed', amountCents: 5000 });
      DonationService.finalize.mockResolvedValueOnce({ id: 'don-1', isAnonymous: true, donationType: 'one-time', amountCents: 5000, donorEmail: null });
      const { rawBody, signature } = paymentWebhook.signCallback({ donationId: 'don-1', amountCents: 5000, status: 'completed', transactionId: 'T1' });

      const first = await paymentWebhook.processSignedCallback({ rawBody, signature });
      const second = await paymentWebhook.processSignedCallback({ rawBody, signature });

      expect(first.finalized).toBe(true);
      expect(second.finalized).toBe(false);
      expect(DonationService.finalize).toHaveBeenCalledTimes(1);
    });
  });
}

conformance('MockPaymentProvider', () => new MockPaymentProvider(), { wired: true });
conformance('PayPalProvider', () => new PayPalProvider(), { wired: false });
