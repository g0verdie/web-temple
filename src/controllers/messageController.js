const { validationResult } = require('express-validator');
const axios = require('axios');
const pool = require('../config/db');
const { logAudit, AUDIT_ACTIONS } = require('../services/auditService');
// We will implement emailService later, but requiring it now to structure usage
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

const verifyCaptcha = async (token) => {
    if (!token) return false;
    // No secret configured: accept in dev for convenience, but FAIL CLOSED in
    // production so a missing CAPTCHA_SECRET can't silently disable spam protection.
    if (!process.env.CAPTCHA_SECRET) return process.env.NODE_ENV !== 'production';

    try {
        const response = await axios.post('https://hcaptcha.com/siteverify', new URLSearchParams({
            response: token,
            secret: process.env.CAPTCHA_SECRET
        }));
        return response.data.success;
    } catch (error) {
        logger.error('CAPTCHA verification failed', { error });
        return false;
    }
};

exports.submitMessage = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const acceptsJson = req.xhr || (req.headers && req.headers.accept && req.headers.accept.indexOf('json') > -1);
        if (acceptsJson) {
            return res.status(400).json({ errors: errors.array() });
        }
        // For non-AJAX, render back with errors (if we were doing full page reload submissions)
        // But we'll assume AJAX for the form or handle it in the view.
        // Let's support AJAX primarily for the form.
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, subject, message } = req.body;
    const captchaToken = req.body.captchaToken || req.body['h-captcha-response'];

    // Verify CAPTCHA
    const isCaptchaValid = await verifyCaptcha(captchaToken);
    if (!isCaptchaValid) {
        return res.status(400).json({ error: 'Invalid CAPTCHA' });
    }

    try {
        const query = `
            INSERT INTO messages (name, email, subject, message, status)
            VALUES ($1, $2, $3, $4, 'new')
            RETURNING id, created_at
        `;
        const values = [name, email, subject, message];
        const result = await pool.query(query, values);
        const newMessage = result.rows[0];

        // Trigger Email Notification (Async)
        Promise.resolve(emailService.sendContactNotification({ name, email, subject, message }))
            .catch(err => logger.error('Email failed', { error: err }));

        // Audit Log
        logAudit({
            action: AUDIT_ACTIONS.MESSAGE_RECEIVED,
            entity_type: 'message',
            entity_id: newMessage.id,
            description: `Message from ${name} (${email})`,
            ip_address: req.ip
        });

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: newMessage,
            id: newMessage.id // Ensure ID is returned for confirmation if needed
        });

    } catch (error) {
        logger.error('Error submitting message', { error });
        res.status(500).json({ error: 'Server error' });
    }
};
