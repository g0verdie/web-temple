/**
 * services/DonationService.js
 * Donation persistence + business logic. Privacy/integrity invariants (plan KTD6/8/9/10/11):
 *  - amount + donor email encrypted at rest (non-deterministic AES) → totals/donor-count
 *    are computed in app after decrypt, never via SQL SUM/COUNT(DISTINCT).
 *  - anonymous donations persist no donor email.
 *  - finalize is idempotent (only a PENDING row → completed) so replays don't duplicate.
 *  - audit entries carry no plaintext amount or donor PII.
 *  - amounts are validated server-side (the posted amount is untrusted).
 */
const db = require('../config/db');
const logger = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryptionHelper');
const { logAudit, AUDIT_ACTIONS } = require('./auditService');

const VALID_TYPES = new Set(['one-time', 'recurring']);
const VALID_CURRENCIES = new Set(['USD']);
const MIN_AMOUNT_CENTS = 100;          // $1.00 floor (KTD11)
const MAX_AMOUNT_CENTS = 1000000000;   // $10,000,000 ceiling (matches the prior stub)
const MAJOR_THRESHOLD_CENTS = 10000;   // strictly greater than $100 (Story 8.7)

const validateAmount = (amountCents) => {
    const n = Number(amountCents);
    if (!Number.isInteger(n) || n < MIN_AMOUNT_CENTS) {
        throw new Error('Invalid amount: minimum donation is $1.00');
    }
    if (n > MAX_AMOUNT_CENTS) {
        throw new Error('Invalid amount: exceeds maximum');
    }
    return n;
};

const safeDecrypt = (value) => {
    if (!value) return null;
    try {
        return decrypt(value);
    } catch (err) {
        logger.warn(`Donation field decrypt failed, omitting (${err.message})`);
        return null;
    }
};

const isMajor = (amountCents) => Number(amountCents) > MAJOR_THRESHOLD_CENTS;

/** Create a PENDING donation before the (mock) checkout. */
const createPending = async ({ amountCents, donationType, recurringFrequency = null, isAnonymous = false, donorEmail = null, currency = 'USD' }) => {
    const amount = validateAmount(amountCents);
    if (!VALID_TYPES.has(donationType)) throw new Error('Invalid donation type');
    if (!VALID_CURRENCIES.has(currency)) throw new Error('Invalid currency');
    const recurring = donationType === 'recurring' ? (recurringFrequency || 'monthly') : null;
    const encryptedAmount = encrypt(String(amount));
    const encryptedEmail = (!isAnonymous && donorEmail) ? encrypt(String(donorEmail)) : null;

    const result = await db.query(
        `INSERT INTO donations
            (encrypted_amount_cents, encrypted_donor_email, currency, donation_type, recurring_frequency, is_anonymous, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING id, created_at`,
        [encryptedAmount, encryptedEmail, currency, donationType, recurring, !!isAnonymous]
    );
    return result.rows[0];
};

/** Idempotently finalize a pending donation. Returns null if already finalized/not found. */
const finalize = async (id, { transactionId } = {}) => {
    const result = await db.query(
        `UPDATE donations
         SET status = 'completed', payment_id = $2, payment_method = 'mock', updated_at = NOW()
         WHERE id = $1 AND status = 'pending'
         RETURNING id, is_anonymous, donation_type, encrypted_amount_cents, encrypted_donor_email`,
        [id, transactionId || null]
    );
    if (result.rows.length === 0) return null; // already finalized or unknown — caller skips side-effects
    const row = result.rows[0];
    // Audit carries id + status only — no plaintext amount or donor PII (KTD10).
    logAudit({
        action: AUDIT_ACTIONS.DONATION_RECEIVED,
        entity_type: 'donation',
        entity_id: id,
        description: `Donation ${id} completed`
    }).catch(err => logger.error('Audit log error:', err));
    return {
        id: row.id,
        isAnonymous: row.is_anonymous,
        donationType: row.donation_type,
        amountCents: Number(safeDecrypt(row.encrypted_amount_cents)) || 0,
        donorEmail: safeDecrypt(row.encrypted_donor_email)
    };
};

/** Log a failed attempt (no PII in the audit). */
const recordFailure = async ({ amountCents, donationType = 'one-time', isAnonymous = false, errorCode = null } = {}) => {
    let encryptedAmount = null;
    try {
        encryptedAmount = encrypt(String(validateAmount(amountCents)));
    } catch (err) {
        encryptedAmount = null; // still log the failure even if the amount was invalid
    }
    const result = await db.query(
        `INSERT INTO donations (encrypted_amount_cents, currency, donation_type, is_anonymous, status, metadata)
         VALUES ($1, 'USD', $2, $3, 'failed', $4)
         RETURNING id`,
        [encryptedAmount, donationType, !!isAnonymous, JSON.stringify({ errorCode })]
    );
    logAudit({
        action: AUDIT_ACTIONS.DONATION_FAILED,
        entity_type: 'donation',
        entity_id: result.rows[0].id,
        description: `Donation attempt failed (${errorCode || 'unknown'})`
    }).catch(err => logger.error('Audit log error:', err));
    return result.rows[0];
};

/** Dashboard metrics — decrypt + aggregate in app (KTD6). */
const getDashboardMetrics = async () => {
    const { rows } = await db.query(
        `SELECT encrypted_amount_cents, encrypted_donor_email, donation_type, is_anonymous, created_at
         FROM donations WHERE status = 'completed'`
    );
    const now = new Date();
    const startOfMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 1);

    let allTime = 0, ytd = 0, mtd = 0, anonymousDonorCount = 0;
    const identifiedDonors = new Set();
    const recurringByDonor = new Map(); // donor key → latest recurring amount (dedupe per donor)
    let anonymousRecurring = 0;

    for (const r of rows) {
        const amt = Number(safeDecrypt(r.encrypted_amount_cents)) || 0;
        allTime += amt;
        const created = new Date(r.created_at).getTime();
        if (created >= startOfYear) ytd += amt;
        if (created >= startOfMonth) mtd += amt;

        const email = r.is_anonymous ? null : safeDecrypt(r.encrypted_donor_email);
        if (email) identifiedDonors.add(email.toLowerCase());
        else anonymousDonorCount += 1;

        if (r.donation_type === 'recurring') {
            if (email) recurringByDonor.set(email.toLowerCase(), amt); // latest per donor
            else anonymousRecurring += amt;
        }
    }

    const mrr = Array.from(recurringByDonor.values()).reduce((s, v) => s + v, 0) + anonymousRecurring;
    return {
        totalAllTimeCents: allTime,
        totalYtdCents: ytd,
        totalMtdCents: mtd,
        donorCount: identifiedDonors.size + anonymousDonorCount,
        recurringDonorCount: recurringByDonor.size + (anonymousRecurring > 0 ? 1 : 0),
        monthlyRecurringRevenueCents: mrr
    };
};

/** Filterable, paginated list for the dashboard. Decrypts per row (KTD6). */
const listDonations = async ({ status = 'completed', donationType, isAnonymous, startDate, endDate, page = 1, limit = 20 } = {}) => {
    const where = ['status = $1'];
    const values = [status];
    let i = 2;
    if (donationType) { where.push(`donation_type = $${i++}`); values.push(donationType); }
    if (typeof isAnonymous === 'boolean') { where.push(`is_anonymous = $${i++}`); values.push(isAnonymous); }
    if (startDate) { where.push(`created_at >= $${i++}`); values.push(startDate); }
    if (endDate) { where.push(`created_at <= $${i++}`); values.push(`${endDate} 23:59:59.999`); }
    const whereStr = `WHERE ${where.join(' AND ')}`;
    const offset = (page - 1) * limit;

    const client = await db.pool.connect();
    try {
        const countRes = await client.query(`SELECT COUNT(*) FROM donations ${whereStr}`, values);
        const totalCount = parseInt(countRes.rows[0].count, 10) || 0;
        const dataRes = await client.query(
            `SELECT id, encrypted_amount_cents, encrypted_donor_email, donation_type, recurring_frequency,
                    is_anonymous, status, created_at
             FROM donations ${whereStr}
             ORDER BY created_at DESC
             LIMIT $${i} OFFSET $${i + 1}`,
            [...values, limit, offset]
        );
        const donations = dataRes.rows.map((r) => ({
            id: r.id,
            amountCents: Number(safeDecrypt(r.encrypted_amount_cents)) || 0,
            donor: r.is_anonymous ? 'Anonymous' : (safeDecrypt(r.encrypted_donor_email) || 'Unknown'),
            donationType: r.donation_type,
            recurringFrequency: r.recurring_frequency,
            isAnonymous: r.is_anonymous,
            status: r.status,
            createdAt: r.created_at
        }));
        return { donations, totalCount, totalPages: Math.ceil(totalCount / limit), currentPage: page };
    } finally {
        client.release();
    }
};

/** CSV for accounting export. */
const toCsv = (donations) => {
    const header = 'id,date,amount_usd,donor,type,recurring_frequency,status';
    const escape = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = donations.map((d) => [
        d.id,
        new Date(d.createdAt).toISOString(),
        (d.amountCents / 100).toFixed(2),
        d.donor,
        d.donationType,
        d.recurringFrequency || '',
        d.status
    ].map(escape).join(','));
    return [header, ...lines].join('\n');
};

module.exports = {
    createPending,
    finalize,
    recordFailure,
    isMajor,
    getDashboardMetrics,
    listDonations,
    toCsv,
    validateAmount,
    MAJOR_THRESHOLD_CENTS,
    MIN_AMOUNT_CENTS
};
