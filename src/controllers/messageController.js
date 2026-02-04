const { validationResult } = require('express-validator');
const axios = require('axios');
const pool = require('../config/db');
// We will implement emailService later, but requiring it now to structure usage
const emailService = require('../services/emailService');

const verifyCaptcha = async (token) => {
    if (!token) return false;
    // If no secret is configured (dev mode), accept any non-empty token
    if (!process.env.CAPTCHA_SECRET) return true;

    try {
        const response = await axios.post('https://hcaptcha.com/siteverify', new URLSearchParams({
            response: token,
            secret: process.env.CAPTCHA_SECRET
        }));
        return response.data.success;
    } catch (error) {
        console.error('CAPTCHA verification failed:', error);
        return false;
    }
};

exports.submitMessage = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(400).json({ errors: errors.array() });
        }
        // For non-AJAX, render back with errors (if we were doing full page reload submissions)
        // But we'll assume AJAX for the form or handle it in the view.
        // Let's support AJAX primarily for the form.
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, subject, message, captchaToken } = req.body;

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
        emailService.sendContactNotification({ name, email, subject, message }).catch(err => console.error('Email failed:', err));

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: newMessage
        });

    } catch (error) {
        console.error('Error submitting message:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
