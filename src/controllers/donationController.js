const crypto = require('crypto');
const logger = require('../utils/logger');
const DonationService = require('../services/DonationService');
const { getProvider } = require('../services/payments');
const receiptPdfService = require('../services/receiptPdfService');
const { enqueueEmail } = require('../services/emailQueueService');
const { logAudit, AUDIT_ACTIONS } = require('../services/auditService');
const CacheService = require('../services/CacheService');

const MAX_FAILURES_BEFORE_ALERT = 3;

const DEMO_OUTCOMES = new Set(['success', 'failure', 'cancel']);
const str = (v) => (typeof v === 'string' ? v : '');

// GET /donations — public donations page.
exports.getDonationsPage = (req, res) => {
    res.render('layout', {
        title: "Donate - Temple B'nai Israel",
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

        const checkoutToken = crypto.randomBytes(16).toString('hex');
        let pending;
        try {
            pending = await DonationService.createPending({ amountCents, donationType, isAnonymous, donorEmail, checkoutToken });
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

// POST /donations/checkout/:id/complete — resolve the (mock) checkout.
exports.completeCheckout = async (req, res) => {
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

        const outcome = (req.body && DEMO_OUTCOMES.has(req.body.outcome)) ? req.body.outcome : 'failure';
        const result = await getProvider().capture(id, { outcome });

        if (result.status === 'cancelled') {
            return res.redirect('/donations');
        }

        if (result.status === 'completed') {
            const finalized = await DonationService.finalize(id, { transactionId: result.transactionId });
            res.clearCookie(`dc_${id}`);
            if (finalized) {
                // Side-effects run once (finalize is idempotent).
                await sendReceiptAndAlerts(finalized).catch((err) => logger.error('Donation side-effects error:', err));
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
            if (count >= MAX_FAILURES_BEFORE_ALERT) {
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
            attachments: [{ filename: 'tax-receipt.pdf', content: pdf }]
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
