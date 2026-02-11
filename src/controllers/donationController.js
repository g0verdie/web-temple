const db = require('../config/db');
const { encrypt } = require('../utils/encryptionHelper');
const { logAudit, AUDIT_ACTIONS } = require('../services/auditService');
const logger = require('../utils/logger');

const VALID_DONATION_TYPES = new Set(['one-time', 'recurring']);
const MAX_DONATION_AMOUNT = 1000000000; // $10,000,000.00

const createDonation = async (req, res) => {
    const {
        amount_cents,
        donor_email,
        donation_type,
        currency = 'USD',
        recurring_frequency = null,
        is_anonymous = false,
        payment_method = null,
        payment_id = null,
        metadata = null
    } = req.body || {};

    if (amount_cents === undefined || amount_cents === null || !donation_type) {
        return res.status(400).json({ error: 'amount_cents and donation_type are required' });
    }

    const amountNumber = Number(amount_cents);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0 || !Number.isInteger(amountNumber)) {
        return res.status(400).json({ error: 'amount_cents must be a positive integer' });
    }

    if (amountNumber > MAX_DONATION_AMOUNT) {
        return res.status(400).json({ error: 'amount_cents exceeds maximum limit' });
    }

    if (!VALID_DONATION_TYPES.has(donation_type)) {
        return res.status(400).json({ error: 'donation_type must be one-time or recurring' });
    }

    try {
        const encryptedAmount = encrypt(String(amountNumber));
        const encryptedEmail = donor_email ? encrypt(String(donor_email)) : null;

        const result = await db.query(
            `INSERT INTO donations (
                encrypted_amount_cents,
                encrypted_donor_email,
                currency,
                donation_type,
                recurring_frequency,
                is_anonymous,
                payment_method,
                payment_id,
                metadata,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed')
            RETURNING id, status, created_at`,
            [
                encryptedAmount,
                encryptedEmail,
                currency,
                donation_type,
                recurring_frequency,
                is_anonymous,
                payment_method,
                payment_id,
                metadata
            ]
        );

        const donation = result.rows[0];

        logAudit({
            action: AUDIT_ACTIONS.DONATION_RECEIVED,
            entity_type: 'donation',
            entity_id: donation.id,
            description: `Donation received (${currency} ${amountNumber})`,
            ip_address: req.ip
        }).catch(err => logger.error('Audit log error:', err));

        return res.status(201).json({
            success: true,
            data: donation
        });
    } catch (error) {
        logger.error('Error creating donation:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    createDonation
};
