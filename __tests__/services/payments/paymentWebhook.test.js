/**
 * paymentWebhook — the signature-verified webhook receiver CORE (R4–R7, R10, R11).
 *
 * Unit-level coverage of every branch of the receiver: raw-body HMAC verify
 * (constant-time, length-guarded), server-side amount recompute, and idempotent
 * finalize. DonationService is mocked (no live Postgres) per the integration
 * convention. The secret resolves the same way for signing and verifying, so a
 * self-signed callback runs the identical verification path a real provider would
 * trigger (R11).
 */

jest.mock('../../../src/services/DonationService');
jest.mock('../../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));

const DonationService = require('../../../src/services/DonationService');
const paymentWebhook = require('../../../src/services/payments/paymentWebhook');

const validPayload = { donationId: 'd1', amountCents: 5000, status: 'completed', transactionId: 'T1' };

describe('paymentWebhook — signed callback receiver core', () => {
  beforeEach(() => jest.clearAllMocks());

  test('signCallback + verifySignature round-trip over the RAW body', () => {
    const { rawBody, signature } = paymentWebhook.signCallback(validPayload);
    expect(typeof rawBody).toBe('string');
    expect(paymentWebhook.verifySignature(rawBody, signature)).toBe(true);
    // Any raw-body tamper invalidates the signature (HMAC is over the exact bytes).
    expect(paymentWebhook.verifySignature(`${rawBody} `, signature)).toBe(false);
  });

  test('verifySignature is length-guarded — a short/empty signature never throws', () => {
    const { rawBody } = paymentWebhook.signCallback(validPayload);
    expect(paymentWebhook.verifySignature(rawBody, '')).toBe(false);
    expect(paymentWebhook.verifySignature(rawBody, 'abc')).toBe(false);
    expect(paymentWebhook.verifySignature(rawBody, undefined)).toBe(false);
  });

  test('a missing/empty signature is rejected (non-finalizing)', async () => {
    DonationService.getById.mockResolvedValue({ id: 'd1', status: 'pending', amountCents: 5000 });
    const { rawBody } = paymentWebhook.signCallback(validPayload);
    const res = await paymentWebhook.processSignedCallback({ rawBody, signature: '' });
    expect(res).toMatchObject({ finalized: false, reason: 'missing_signature' });
    expect(DonationService.finalize).not.toHaveBeenCalled();
  });

  test('a bad signature is rejected (non-finalizing)', async () => {
    DonationService.getById.mockResolvedValue({ id: 'd1', status: 'pending', amountCents: 5000 });
    const { rawBody } = paymentWebhook.signCallback(validPayload);
    const res = await paymentWebhook.processSignedCallback({ rawBody, signature: 'not-the-real-signature-value' });
    expect(res).toMatchObject({ finalized: false, reason: 'bad_signature' });
    expect(DonationService.finalize).not.toHaveBeenCalled();
  });

  test('a malformed body (valid signature) is rejected', async () => {
    const rawBody = '{not json';
    const signature = paymentWebhook.computeSignature(rawBody);
    const res = await paymentWebhook.processSignedCallback({ rawBody, signature });
    expect(res).toMatchObject({ finalized: false, reason: 'malformed' });
  });

  test('an unknown donation id is a non-finalizing unknown_transaction', async () => {
    DonationService.getById.mockResolvedValue(null);
    const { rawBody, signature } = paymentWebhook.signCallback(validPayload);
    const res = await paymentWebhook.processSignedCallback({ rawBody, signature });
    expect(res).toMatchObject({ finalized: false, reason: 'unknown_transaction' });
  });

  test('an amount mismatch is rejected without finalizing (R7)', async () => {
    DonationService.getById.mockResolvedValue({ id: 'd1', status: 'pending', amountCents: 9999 });
    const { rawBody, signature } = paymentWebhook.signCallback(validPayload); // claims 5000
    const res = await paymentWebhook.processSignedCallback({ rawBody, signature });
    expect(res).toMatchObject({ finalized: false, reason: 'amount_mismatch' });
    expect(DonationService.finalize).not.toHaveBeenCalled();
  });

  test('a non-completed status is not finalized', async () => {
    DonationService.getById.mockResolvedValue({ id: 'd1', status: 'pending', amountCents: 5000 });
    const { rawBody, signature } = paymentWebhook.signCallback({ ...validPayload, status: 'failed' });
    const res = await paymentWebhook.processSignedCallback({ rawBody, signature });
    expect(res).toMatchObject({ finalized: false, reason: 'not_completed' });
    expect(DonationService.finalize).not.toHaveBeenCalled();
  });

  test('a valid completed callback finalizes once and returns the donation', async () => {
    DonationService.getById.mockResolvedValue({ id: 'd1', status: 'pending', amountCents: 5000 });
    DonationService.finalize.mockResolvedValue({ id: 'd1', isAnonymous: true, donationType: 'one-time', amountCents: 5000, donorEmail: null });
    const { rawBody, signature } = paymentWebhook.signCallback(validPayload);
    const res = await paymentWebhook.processSignedCallback({ rawBody, signature });
    expect(res.finalized).toBe(true);
    expect(res.donation).toMatchObject({ id: 'd1' });
    expect(DonationService.finalize).toHaveBeenCalledWith('d1', { transactionId: 'T1' });
  });

  test('a replay of an already-finalized row is an idempotent no-op (no second finalize)', async () => {
    DonationService.getById.mockResolvedValue({ id: 'd1', status: 'completed', amountCents: 5000 });
    const { rawBody, signature } = paymentWebhook.signCallback(validPayload);
    const res = await paymentWebhook.processSignedCallback({ rawBody, signature });
    expect(res.finalized).toBe(false);
    expect(DonationService.finalize).not.toHaveBeenCalled();
  });

  test('deliverInternalCallback runs the SAME verification code (self-signed) and finalizes', async () => {
    DonationService.getById.mockResolvedValue({ id: 'd1', status: 'pending', amountCents: 5000 });
    DonationService.finalize.mockResolvedValue({ id: 'd1', isAnonymous: true, donationType: 'one-time', amountCents: 5000, donorEmail: null });
    const res = await paymentWebhook.deliverInternalCallback(validPayload);
    expect(res.finalized).toBe(true);
    expect(DonationService.finalize).toHaveBeenCalledTimes(1);
  });
});
