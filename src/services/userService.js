const db = require('../config/db');
const crypto = require('crypto');
const validator = require('validator');
const { enqueueEmail } = require('./emailQueueService');
const { renderTemplate } = require('./emailTemplateService');

const DEFAULT_NOTIFICATION_PREFERENCES = {
    announcements: true,
    calendar_events: true,
    messages: true,
    recordings: true
};

const normalizePreferences = (preferences) => {
    if (!preferences || typeof preferences !== 'object') {
        return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }

    const merged = { ...DEFAULT_NOTIFICATION_PREFERENCES };
    for (const [key, value] of Object.entries(preferences)) {
        if (Object.prototype.hasOwnProperty.call(DEFAULT_NOTIFICATION_PREFERENCES, key) && typeof value === 'boolean') {
            merged[key] = value;
        }
    }

    return merged;
};

const completeOnboarding = async (userId) => {
    const result = await db.query(
        'UPDATE users SET onboarding_complete = true, updated_at = NOW() WHERE id = $1 RETURNING id',
        [userId]
    );
    if (result.rows.length === 0) {
        throw new Error('User not found');
    }
    return true;
};

const getAccountSettings = async (userId) => {
    const result = await db.query(
        'SELECT id, email, first_name, last_name, notification_preferences FROM users WHERE id = $1',
        [userId]
    );

    if (result.rows.length === 0) {
        throw new Error('User not found');
    }

    const user = result.rows[0];
    return {
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        notification_preferences: normalizePreferences(user.notification_preferences)
    };
};

const updateProfile = async (userId, { first_name, last_name }) => {
    const result = await db.query(
        'UPDATE users SET first_name = $1, last_name = $2, updated_at = NOW() WHERE id = $3 RETURNING id',
        [first_name || null, last_name || null, userId]
    );

    if (result.rows.length === 0) {
        throw new Error('User not found');
    }

    return true;
};

const updatePreferences = async (userId, preferences) => {
    if (!preferences || typeof preferences !== 'object') {
        throw new Error('Invalid preference value');
    }

    for (const [key, value] of Object.entries(preferences)) {
        if (!Object.prototype.hasOwnProperty.call(DEFAULT_NOTIFICATION_PREFERENCES, key)) {
            throw new Error('Invalid preference key');
        }
        if (typeof value !== 'boolean') {
            throw new Error('Invalid preference value');
        }
    }

    const currentResult = await db.query(
        'SELECT notification_preferences FROM users WHERE id = $1',
        [userId]
    );

    if (currentResult.rows.length === 0) {
        throw new Error('User not found');
    }

    const current = normalizePreferences(currentResult.rows[0].notification_preferences);
    const merged = { ...current, ...preferences };

    await db.query(
        'UPDATE users SET notification_preferences = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
        [merged, userId]
    );

    return merged;
};

const requestEmailChange = async (userId, newEmail) => {
    if (!newEmail || !validator.isEmail(newEmail)) {
        throw new Error('Valid email is required');
    }

    const userResult = await db.query(
        'SELECT id, email FROM users WHERE id = $1',
        [userId]
    );

    if (userResult.rows.length === 0) {
        throw new Error('User not found');
    }

    const currentEmail = userResult.rows[0].email;
    if (currentEmail.toLowerCase() === newEmail.toLowerCase()) {
        throw new Error('Email is unchanged');
    }

    const existingEmail = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [newEmail]
    );

    if (existingEmail.rows.length > 0) {
        throw new Error('Email already in use');
    }

    await db.query(
        'UPDATE email_change_requests SET used = true WHERE user_id = $1 AND used = false',
        [userId]
    );

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.query(
        'INSERT INTO email_change_requests (user_id, new_email, token, expires_at) VALUES ($1, $2, $3, $4)',
        [userId, newEmail, token, expiresAt]
    );

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const confirmLink = `${baseUrl}/account/confirm-email?token=${token}`;
    const emailContent = renderTemplate('email-change-confirmation', {
        confirmLink,
        newEmail
    });

    enqueueEmail({
        to: newEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        priority: 1
    }).catch((err) => console.error('Failed to queue email change confirmation:', err));

    return true;
};

const confirmEmailChange = async (token) => {
    if (!token) {
        throw new Error('Token is required');
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        const requestResult = await client.query(
            'SELECT id, user_id, new_email, expires_at, used FROM email_change_requests WHERE token = $1',
            [token]
        );

        if (requestResult.rows.length === 0) {
            throw new Error('Invalid or expired email change token');
        }

        const request = requestResult.rows[0];

        if (request.used) {
            throw new Error('Invalid or expired email change token');
        }

        if (new Date(request.expires_at) < new Date()) {
            throw new Error('Invalid or expired email change token');
        }

        const existingEmail = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [request.new_email]
        );

        if (existingEmail.rows.length > 0) {
            throw new Error('Email already in use');
        }

        await client.query(
            'UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2',
            [request.new_email, request.user_id]
        );

        await client.query(
            'UPDATE email_change_requests SET used = true WHERE id = $1',
            [request.id]
        );

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    completeOnboarding,
    getAccountSettings,
    updateProfile,
    updatePreferences,
    requestEmailChange,
    confirmEmailChange
};
