/**
 * services/payments/paymentWebhook.js
 *
 * The signature-verified webhook RECEIVER and its internal signed-callback
 * delivery (I1 / plan R4–R11). This is the security-critical seam that finalizes
 * a donation only from provider authority — never from a client report.
 *
 * A real provider POSTs a webhook to /donations/webhook; the hardened mock
 * delivers its server-decided result through deliverInternalCallback(). BOTH
 * paths funnel into processSignedCallback(), so the mock exercises the exact
 * verification code a real provider triggers (R11):
 *
 *   1. verify an internal HMAC-SHA256 over the RAW, unparsed body, using a
 *      constant-time compare with a length guard (mirrors utils/unsubscribeToken);
 *   2. recompute + revalidate the amount against the authoritative PENDING row
 *      (DonationService.getById returns the decrypted amountCents);
 *   3. idempotently finalize via DonationService.finalize's atomic conditional
 *      UPDATE (a duplicate/replayed/concurrent callback finalizes at most once).
 *
 * Rejections here (bad/absent signature, amount mismatch, unknown/parsed-badly
 * callback) are NON-finalizing: the donation stays PENDING and no side-effects
 * run. They are distinct from a genuine ProviderError (provider unavailable),
 * which the provider path raises instead.
 */

const crypto = require('crypto');
const logger = require('../../utils/logger');
const DonationService = require('../DonationService');

// The header a provider (and the internal callback) carries the signature in.
const SIGNATURE_HEADER = 'x-payment-signature';

/**
 * Signing secret for the internal callback. Mirrors utils/unsubscribeToken's
 * pattern: a dedicated env var falling back to JWT_SECRET so the key is never
 * empty in a configured environment. This signs the INTERNAL callback the mock
 * delivers (and a real provider webhook would carry) — it is NOT a PayPal secret.
 */
const getSecret = () => process.env.PAYMENT_WEBHOOK_SECRET || process.env.JWT_SECRET || '';

const computeSignature = (rawBody) => {
    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
    return crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
};

/**
 * Constant-time signature verification with a length guard first, so
 * timingSafeEqual never throws on mismatched buffer lengths (mirrors
 * utils/unsubscribeToken.js).
 */
const verifySignature = (rawBody, signature) => {
    if (typeof signature !== 'string' || signature.length === 0) return false;
    const expected = computeSignature(rawBody);
    const providedBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (providedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
};

/**
 * Build the signed callback the receiver verifies (R10/R11). Returns the exact
 * raw-body STRING that was signed so an internal caller feeds identical bytes to
 * processSignedCallback — the HMAC must cover the same bytes on both sides.
 */
const signCallback = (payload) => {
    const rawBody = JSON.stringify(payload);
    return { rawBody, signature: computeSignature(rawBody) };
};

// Non-finalizing rejection reasons → HTTP status for the webhook route. None of
// these finalize a donation; the row stays PENDING. A replay of an already-final
// row is an idempotent 200 no-op (so a provider stops retrying).
const REJECT_STATUS = {
    missing_signature: 401,
    bad_signature: 401,
    malformed: 400,
    unknown_transaction: 404,
    amount_mismatch: 409,
    not_completed: 400
};

/**
 * The receiver core. Pure of HTTP and side-effects: it verifies, recomputes the
 * amount, and idempotently finalizes, returning a result the caller (the HTTP
 * route or the internal mock callback) acts on. Side-effects (receipt/alert) run
 * ONLY when { finalized: true } is returned, guaranteeing they fire at most once.
 *
 * @param {{ rawBody: (string|Buffer), signature: string }} input
 * @returns {Promise<{ finalized: boolean, donation?: object, reason?: string, statusCode: number }>}
 */
const processSignedCallback = async ({ rawBody, signature } = {}) => {
    if (typeof signature !== 'string' || signature.length === 0) {
        return { finalized: false, reason: 'missing_signature', statusCode: REJECT_STATUS.missing_signature };
    }
    if (!verifySignature(rawBody, signature)) {
        return { finalized: false, reason: 'bad_signature', statusCode: REJECT_STATUS.bad_signature };
    }

    let payload;
    try {
        payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
    } catch (err) {
        return { finalized: false, reason: 'malformed', statusCode: REJECT_STATUS.malformed };
    }
    const donationId = payload && payload.donationId;
    if (!donationId) {
        return { finalized: false, reason: 'malformed', statusCode: REJECT_STATUS.malformed };
    }

    const donation = await DonationService.getById(donationId);
    if (!donation) {
        return { finalized: false, reason: 'unknown_transaction', statusCode: REJECT_STATUS.unknown_transaction };
    }

    // Replay of an already-finalized donation: idempotent no-op, no side-effects
    // (R6/R18/AE1). Short-circuit BEFORE the amount recompute so a valid replay is
    // never mis-rejected as a mismatch.
    if (donation.status !== 'pending') {
        return { finalized: false, reason: 'already_final', statusCode: 200 };
    }

    // Server-side amount recompute (R7/AE3): the callback amount must equal the
    // authoritative decrypted PENDING amount. Any mismatch is rejected; the
    // donation stays PENDING.
    if (Number(payload.amountCents) !== Number(donation.amountCents)) {
        logger.warn('Payment webhook amount mismatch; rejecting without finalizing', { donationId });
        return { finalized: false, reason: 'amount_mismatch', statusCode: REJECT_STATUS.amount_mismatch };
    }

    if (payload.status !== 'completed') {
        return { finalized: false, reason: 'not_completed', statusCode: REJECT_STATUS.not_completed };
    }

    // Idempotent finalize: the conditional UPDATE admits a single pending→completed
    // transition (AE5), so a concurrent/duplicate callback that loses the race gets
    // null back here and runs no side-effects.
    const finalized = await DonationService.finalize(donationId, { transactionId: payload.transactionId });
    if (!finalized) {
        return { finalized: false, reason: 'already_final', statusCode: 200 };
    }
    return { finalized: true, donation: finalized, statusCode: 200 };
};

/**
 * Sign + deliver the mock's server-decided result THROUGH the same verification
 * code a real provider webhook triggers (R10/R11). Not an HTTP hop — the raw
 * bytes signed here are the exact bytes verified in processSignedCallback.
 */
const deliverInternalCallback = async (payload) => {
    const { rawBody, signature } = signCallback(payload);
    return processSignedCallback({ rawBody, signature });
};

module.exports = {
    SIGNATURE_HEADER,
    getSecret,
    computeSignature,
    verifySignature,
    signCallback,
    processSignedCallback,
    deliverInternalCallback
};
