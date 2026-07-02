const crypto = require('crypto');
const validator = require('validator');
const logger = require('../utils/logger');
const DonationService = require('../services/DonationService');
const { getProvider } = require('../services/payments');
const paymentWebhook = require('../services/payments/paymentWebhook');
const receiptPdfService = require('../services/receiptPdfService');
const { enqueueEmail } = require('../services/emailQueueService');
const { logAudit, AUDIT_ACTIONS } = require('../services/auditService');
const CacheService = require('../services/CacheService');

const MAX_FAILURES_BEFORE_ALERT = 3;

const str = (v) => (typeof v === 'string' ? v : '');

// GET /donations — public donations page.
exports.getDonationsPage = (req, res) => {
    res.render('layout', {
        title: "Donate - Temple B'nai Israel",
        description: 'Support Temple B\'nai Israel with a donation. Your generosity sustains our services, programs, and community in Florence, AL.',
        bodyView: 'donations/index',
        stylesheets: ['/css/donations.css'],
        viewData: { csrfToken: req.csrfToken ? req.csrfToken() : null }
    });
};

// POST /donations/checkout — create a PENDING donation + start the (mock) checkout.
exports.startCheckout = async (req, res) => {
    try {
        const body = req.body || {};
        const amountCents = parseInt(body.amount_cents, 10);
        const donationType = body.donation_type === 'recurring' ? 'recurring' : 'one-time';
        const isAnonymous = body.is_anonymous === 'on' || body.is_anonymous === 'true' || body.is_anonymous === true;
        const donorEmail = isAnonymous ? null : (str(body.donor_email).trim() || null);
        const designation = str(body.designation).trim() || null;

        // A non-anonymous donation must carry a valid email (receipt destination + correct
        // donor counting); otherwise the donor would be miscounted as anonymous.
        if (!isAnonymous && (!donorEmail || !validator.isEmail(donorEmail))) {
            return res.status(400).render('error', {
                title: '400 - Invalid Donation',
                message: 'A valid email is required for a non-anonymous donation, or choose to give anonymously.'
            });
        }

        const checkoutToken = crypto.randomBytes(16).toString('hex');
        let pending;
        try {
            pending = await DonationService.createPending({ amountCents, donationType, isAnonymous, donorEmail, checkoutToken, designation });
        } catch (validationErr) {
            return res.status(400).render('error', { title: '400 - Invalid Donation', message: validationErr.message });
        }

        await getProvider().createCheckout({ donationId: pending.id, amountCents, donationType, isAnonymous });

        // Bind this checkout to the creator (cookieParser has no secret here, so an opaque token is used).
        res.cookie(`dc_${pending.id}`, checkoutToken, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 60 * 1000 });
        return res.redirect(`/donations/checkout/${pending.id}`);
    } catch (error) {
        logger.error('Error starting donation checkout:', error);
        return res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to start your donation.' });
    }
};

// GET /donations/checkout/:id — the simulated (DEMO) checkout step.
exports.getCheckout = async (req, res) => {
    try {
        const donation = await DonationService.getById(req.params.id);
        if (!donation || donation.status !== 'pending') {
            return res.status(404).render('404', { title: '404 - Page Not Found' });
        }
        return res.render('layout', {
            title: 'Complete your donation',
            bodyView: 'donations/checkout',
            stylesheets: ['/css/donations.css'],
            viewData: {
                donation: { id: donation.id, amountCents: donation.amountCents, donationType: donation.donationType },
                csrfToken: req.csrfToken ? req.csrfToken() : null
            }
        });
    } catch (error) {
        logger.error('Error loading donation checkout:', error);
        return res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load checkout.' });
    }
};

// POST /donations/checkout/:id/complete — resolve the checkout. The browser
// request signals only INTENT to finalize (R2): the terminal outcome, amount, and
// transaction id are decided provider/server-side and finalized only through a
// signature-verified callback — any client-supplied `outcome` is ignored.
exports.completeCheckout = async (req, res, next) => {
    try {
        const id = req.params.id;
        const donation = await DonationService.getById(id);
        if (!donation) return res.status(404).render('404', { title: '404 - Page Not Found' });

        // Ownership: only the device that started the checkout (holds the cookie) may complete it.
        const cookieToken = req.cookies ? req.cookies[`dc_${id}`] : null;
        if (!donation.checkoutToken || cookieToken !== donation.checkoutToken) {
            return res.status(403).render('error', { title: '403 - Forbidden', message: 'This checkout can only be completed from the device that started it.' });
        }
        if (donation.status !== 'pending') {
            return res.redirect('/donations/thank-you'); // already resolved — idempotent
        }

        // Provider-authoritative capture (R1/R21): the outcome is derived from the
        // authoritative SERVER-SIDE amount only, never from req.body.
        let result;
        try {
            result = await getProvider().capture(id, { amountCents: donation.amountCents });
        } catch (err) {
            // A genuine provider failure (ProviderError → 502) is surfaced through
            // the central error handler, not swallowed as a generic 500 (R17).
            return next(err);
        }

        if (result.status === 'cancelled') {
            return res.redirect('/donations');
        }

        if (result.status === 'completed') {
            // Finalize ONLY through the signed webhook the receiver verifies: the
            // mock runs the same signature-verify + amount-recompute + idempotent
            // finalize code a real provider webhook triggers (R10/R11).
            const callback = await paymentWebhook.deliverInternalCallback({
                donationId: id,
                amountCents: result.amountCents,
                status: 'completed',
                transactionId: result.transactionId
            });
            if (callback.finalized) {
                res.clearCookie(`dc_${id}`);
                // Side-effects run once — the callback finalizes at most once.
                await sendReceiptAndAlerts(callback.donation).catch((err) => logger.error('Donation side-effects error:', err));
            }
            return res.redirect('/donations/thank-you');
        }

        // failure
        await DonationService.recordFailure({
            amountCents: donation.amountCents,
            donationType: donation.donationType,
            isAnonymous: donation.isAnonymous,
            errorCode: result.errorCode
        });
        // Server-side 3-strike counter (Redis-backed so it can't be reset by clearing a cookie — KTD9/U8).
        try {
            const failKey = `donation:fail:${id}`;
            const count = (Number(await CacheService.get(failKey)) || 0) + 1;
            await CacheService.set(failKey, count, 3600);
            if (count === MAX_FAILURES_BEFORE_ALERT) { // fire exactly once at the threshold
                const adminEmail = process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL;
                if (adminEmail) {
                    await enqueueEmail({
                        to: adminEmail,
                        subject: 'Repeated donation failures',
                        html: `<p>${count} failed donation attempts on checkout ${id} (amount $${(donation.amountCents / 100).toFixed(2)}).</p>`,
                        text: `${count} failed donation attempts on checkout ${id} (amount $${(donation.amountCents / 100).toFixed(2)}).`
                    });
                }
            }
        } catch (counterErr) {
            logger.error('Donation failure-counter error:', counterErr);
        }
        return res.status(402).render('layout', {
            title: 'Payment could not be completed',
            bodyView: 'donations/failed',
            stylesheets: ['/css/donations.css'],
            viewData: { donationId: id }
        });
    } catch (error) {
        logger.error('Error completing donation checkout:', error);
        return res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to complete your donation.' });
    }
};

// POST /donations/webhook — the signature-verified provider webhook receiver
// (R4). Carries no browser session or CSRF token, so it is CSRF-exempt the same
// way one-click unsubscribe is (see conditionalCsrf in src/server.js) and is
// authenticated solely by the raw-body HMAC. Delegates verify + amount recompute
// + idempotent finalize to the shared receiver core; runs the receipt/alert
// side-effects only on the single finalize that wins the pending→completed
// transition. Rejections are non-finalizing (donation stays PENDING) and never
// surface as success (R17).
exports.handleWebhook = async (req, res) => {
    try {
        const signature = req.get(paymentWebhook.SIGNATURE_HEADER);
        // Raw body captured by the express.json verify hook (R9); fail closed to an
        // empty buffer (signature will not match) if it was not captured.
        const rawBody = req.rawBody || Buffer.alloc(0);
        const result = await paymentWebhook.processSignedCallback({ rawBody, signature });

        if (result.finalized) {
            await sendReceiptAndAlerts(result.donation).catch((err) => logger.error('Donation side-effects error:', err));
        }

        if (result.reason && result.statusCode >= 400) {
            // Non-finalizing rejection (bad/absent signature, amount mismatch,
            // unknown/malformed callback). Logged without PII or secrets.
            logger.warn('Donation webhook rejected (non-finalizing)', { reason: result.reason });
            return res.status(result.statusCode).json({ received: false, reason: result.reason });
        }
        return res.status(200).json({ received: true, finalized: result.finalized });
    } catch (error) {
        logger.error('Error handling donation webhook:', error);
        return res.status(500).json({ received: false });
    }
};

// GET /donations/thank-you
exports.thankYou = (req, res) => {
    res.render('layout', {
        title: 'Thank you',
        bodyView: 'donations/thank-you',
        stylesheets: ['/css/donations.css'],
        viewData: {}
    });
};

// On a completed donation: queue the PDF receipt (named donors only) + a major-donation alert.
const sendReceiptAndAlerts = async (finalized) => {
    const amountUsd = `$${(finalized.amountCents / 100).toFixed(2)}`;
    const receiptId = `RCPT-${String(finalized.id).slice(0, 8)}`;
    const date = new Date().toISOString().slice(0, 10);

    if (!finalized.isAnonymous && finalized.donorEmail) {
        const pdf = await receiptPdfService.generate({
            amountCents: finalized.amountCents, date,
            donorName: finalized.donorEmail, receiptId, isAnonymous: false
        });
        await enqueueEmail({
            to: finalized.donorEmail,
            template: 'receipt',
            data: { amount: amountUsd, receiptId },
            // base64 so the Buffer survives bull's JSON serialization of the job (nodemailer decodes it).
            attachments: [{ filename: 'tax-receipt.pdf', content: pdf.toString('base64'), encoding: 'base64' }]
        });
        logAudit({ action: AUDIT_ACTIONS.TAX_RECEIPT_SENT, entity_type: 'donation', entity_id: finalized.id, description: `Receipt sent for donation ${finalized.id}` })
            .catch((err) => logger.error('Audit log error:', err));
    }

    if (!finalized.isAnonymous && DonationService.isMajor(finalized.amountCents)) {
        const rabbiEmail = process.env.RABBI_EMAIL || process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL;
        if (rabbiEmail) {
            await enqueueEmail({
                to: rabbiEmail,
                subject: `Major Donation Received: ${amountUsd}`,
                html: `<p>A major donation of <strong>${amountUsd}</strong> was received on ${date}.</p>`,
                text: `A major donation of ${amountUsd} was received on ${date}.`
            });
        }
    }
};
