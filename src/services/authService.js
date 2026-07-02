const db = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/authHelper');
const { logAudit, AUDIT_ACTIONS } = require('./auditService');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError, AuthError } = require('../errors');

const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Authentication service
 * Handles user registration, login, and password management
 */

/**
 * Issue an email-verification token (Gate 1) and queue the verification email.
 * Mirrors requestPasswordReset's token mechanism (opaque random token, 24h expiry,
 * single-use, prior tokens invalidated). Shared by registerUser and resendVerification.
 */
const sendVerificationEmail = async (userId, email, firstName) => {
    await db.query(
        'UPDATE email_verifications SET used = true WHERE user_id = $1 AND used = false',
        [userId]
    );

    const token = require('crypto').randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.query(
        'INSERT INTO email_verifications (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [userId, token, tokenExpiry]
    );

    const { enqueueEmail } = require('./emailQueueService');
    const { renderTemplate } = require('./emailTemplateService');
    const verifyLink = `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`;
    const emailContent = renderTemplate('verify-email', {
        name: firstName || 'Member',
        verifyLink
    });

    enqueueEmail({
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        priority: 1
    }).catch(err => logger.error('Failed to queue verification email', { error: err }));
};

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @param {string} userData.email - User email
 * @param {string} userData.password - Plain text password (will be hashed)
 * @param {string} userData.first_name - First name
 * @param {string} userData.last_name - Last name
 * @param {string} userData.ip_address - IP address for audit logging
 * @returns {Promise<Object>} Newly created user (without password_hash)
 * @throws {Error} if email already exists or validation fails
 */
const registerUser = async (userData) => {
    const { email, password, first_name, last_name, ip_address, directory_listed } = userData;
    const validator = require('validator');

    // Validate input
    if (!email || !password) {
        throw new Error('Email and password are required');
    }

    if (!validator.isEmail(email)) {
        throw new Error('Valid email is required');
    }

    if (!validator.isStrongPassword(password, {
        minLength: 12,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
    })) {
        throw new Error('Password must be at least 12 characters and include uppercase, lowercase, number, and symbol');
    }

    // Verify email is not already registered
    const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
    );

    if (existingUser.rows.length > 0) {
        throw new Error('Email already registered');
    }

    // Hash password with Bcrypt
    const password_hash = await hashPassword(password);

    // Insert user into database
    const result = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id, email, first_name, last_name, role, status, onboarding_complete, token_version, created_at`,
        [email, password_hash, first_name || null, last_name || null, 'member', 'pending_verification']
    );

    const user = result.rows[0];

    // Log audit event (fire-and-forget)
    logAudit({
        user_id: user.id,
        action: AUDIT_ACTIONS.USER_REGISTERED,
        entity_type: 'user',
        entity_id: user.id,
        description: `User registered: ${email}`,
        ip_address,
    }).catch(err => logger.error('Audit log error', { error: err }));

    // Gate 1: issue an email-verification token and send the link. Best-effort — a
    // token/email failure must not undo the already-created account; the user can use
    // "resend verification" to get a fresh link.
    try {
        await sendVerificationEmail(user.id, email, user.first_name);
    } catch (err) {
        logger.error('Failed to issue verification token at registration (user can resend)', { error: err, user_id: user.id });
    }

    // Item 6: opt into the member directory at registration. A bare {listed:true}
    // creates the profile row; per-field "show my…" prefs stay on the account page.
    // Best-effort — awaited so the user lands listed, but a failure must NOT undo the
    // already-created account (mirrors the fire-and-forget welcome email).
    if (directory_listed === true) {
        try {
            await require('./MemberDirectoryService').saveMyProfile(user.id, { listed: true });
        } catch (err) {
            logger.error('Directory opt-in at registration failed (account still created)', { error: err, user_id: user.id });
        }
    }

    return user;
};

/**
 * Authenticate user with email and password
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.email - User email
 * @param {string} credentials.password - Plain text password
 * @param {string} credentials.ip_address - IP address for audit logging
 * @returns {Promise<Object>} Authenticated user (without password_hash)
 * @throws {Error} if credentials are invalid
 */
const authenticateUser = async (credentials) => {
    const { email, password, ip_address } = credentials;

    if (!email || !password) {
        throw new ValidationError('Email and password are required');
    }

    // Find user by email
    const result = await db.query(
        'SELECT id, email, password_hash, role, first_name, last_name, token_version, onboarding_complete, failed_login_attempts, lockout_until, status FROM users WHERE email = $1',
        [email]
    );

    if (result.rows.length === 0) {
        // Log failed login attempt
        logAudit({
            action: AUDIT_ACTIONS.USER_LOGIN,
            description: `Failed login attempt: user not found (${email})`,
            ip_address,
        }).catch(err => logger.error('Audit log error', { error: err }));
        throw new AuthError('Invalid email or password');
    }

    const user = result.rows[0];

    // Check if account is locked
    if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
        const lockoutTime = new Date(user.lockout_until);
        const now = new Date();
        const minutesRemaining = Math.ceil((lockoutTime - now) / (1000 * 60));
        const resetTime = lockoutTime.toLocaleTimeString();

        logAudit({
            user_id: user.id,
            action: AUDIT_ACTIONS.USER_LOGIN,
            description: `Locked account login attempt: ${email} (locked for ${minutesRemaining} more minutes)`,
            ip_address,
        }).catch(err => logger.error('Audit log error', { error: err }));

        throw new AuthError(`Account is temporarily locked. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} (until ${resetTime}).`, { statusCode: 403 });
    }

    // Compare password with stored hash using Bcrypt
    const passwordMatch = await comparePassword(password, user.password_hash);

    if (!passwordMatch) {
        // Increment failed attempts
        const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
        let updateQuery = 'UPDATE users SET failed_login_attempts = $1, updated_at = NOW()';
        const queryParams = [newFailedAttempts];

        // Lock account if 5th failure
        if (newFailedAttempts >= 5) {
            updateQuery += `, lockout_until = NOW() + INTERVAL '${LOCKOUT_DURATION_MINUTES} minutes'`;

            logAudit({
                user_id: user.id,
                action: AUDIT_ACTIONS.USER_LOGIN,
                description: `Account locked after 5 failed attempts: ${email}`,
                ip_address,
            }).catch(err => logger.error('Audit log error', { error: err }));
        }

        updateQuery += ' WHERE id = $' + (queryParams.length + 1);
        queryParams.push(user.id);

        await db.query(updateQuery, queryParams);

        // Log failed login attempt
        logAudit({
            user_id: user.id,
            action: AUDIT_ACTIONS.USER_LOGIN,
            description: `Failed login attempt: incorrect password`,
            ip_address,
        }).catch(err => logger.error('Audit log error', { error: err }));
        throw new AuthError('Invalid email or password');
    }

    // Two-gate registration: only an 'active' account may obtain a session. Legacy rows
    // predating the status column (null) are treated as active. Checked AFTER the password
    // match so account state never leaks to an unauthenticated guesser.
    const status = user.status || 'active';
    if (status !== 'active') {
        logAudit({
            user_id: user.id,
            action: AUDIT_ACTIONS.USER_LOGIN,
            description: `Login blocked (status=${status}): ${email}`,
            ip_address,
        }).catch(err => logger.error('Audit log error', { error: err }));

        if (status === 'pending_verification') {
            throw new AuthError('Please verify your email address before logging in. Check your inbox for the verification link.', { statusCode: 403 });
        }
        if (status === 'pending_approval') {
            throw new AuthError('Your account is awaiting approval by a temple administrator. You will receive an email once approved.', { statusCode: 403 });
        }
        throw new AuthError('Your registration was not approved. Please contact the temple office.', { statusCode: 403 });
    }

    // Reset failed attempts and update last login time
    await db.query(
        'UPDATE users SET failed_login_attempts = 0, lockout_until = NULL, last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
        [user.id]
    );

    // Log successful login
    logAudit({
        user_id: user.id,
        action: AUDIT_ACTIONS.USER_LOGIN,
        description: `User logged in: ${email}`,
        ip_address,
    }).catch(err => logger.error('Audit log error', { error: err }));

    // Return user without password hash
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        token_version: user.token_version,
        onboarding_complete: user.onboarding_complete || false
    };
};

/**
 * Change user password
 * @param {Object} options - Password change options
 * @param {string} options.user_id - User ID
 * @param {string} options.current_password - Current password (plain text)
 * @param {string} options.new_password - New password (plain text)
 * @param {string} options.ip_address - IP address for audit logging
 * @returns {Promise<void>}
 * @throws {Error} if current password is invalid or new password fails validation
 */
const changePassword = async (options) => {
    const { user_id, current_password, new_password, ip_address } = options;

    if (!user_id || !current_password || !new_password) {
        throw new ValidationError('User ID, current password, and new password are required');
    }

    const validator = require('validator');
    if (!validator.isStrongPassword(new_password, {
        minLength: 12,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
    })) {
        throw new ValidationError('New password must be at least 12 characters and include uppercase, lowercase, number, and symbol');
    }

    if (current_password === new_password) {
        throw new ValidationError('New password cannot be the same as current password');
    }

    // Fetch user
    const userResult = await db.query(
        'SELECT id, email, password_hash FROM users WHERE id = $1',
        [user_id]
    );

    if (userResult.rows.length === 0) {
        throw new NotFoundError('User not found');
    }

    const user = userResult.rows[0];

    // Verify current password
    const passwordMatch = await comparePassword(current_password, user.password_hash);

    if (!passwordMatch) {
        logAudit({
            user_id,
            action: AUDIT_ACTIONS.PASSWORD_CHANGED,
            description: 'Failed password change: current password incorrect',
            ip_address,
        }).catch(err => logger.error('Audit log error', { error: err }));
        throw new ValidationError('Current password is incorrect');
    }

    // Check password history (last 5 passwords) to prevent reuse
    const historyResult = await db.query(
        'SELECT password_hash FROM password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
        [user_id]
    );
    for (const row of historyResult.rows) {
        // eslint-disable-next-line no-await-in-loop
        const reused = await comparePassword(new_password, row.password_hash);
        if (reused) {
            throw new ValidationError('Password was recently used. Please choose a different password');
        }
    }

    // Hash new password
    const new_password_hash = await hashPassword(new_password);

    // Perform updates in transaction
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Archive current password
        await client.query(
            'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
            [user_id, user.password_hash]
        );

        // 2. Update user password and increment token_version (invalidating sessions)
        await client.query(
            'UPDATE users SET password_hash = $1, token_version = COALESCE(token_version, 0) + 1, updated_at = NOW() WHERE id = $2',
            [new_password_hash, user_id]
        );

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    // Log password change
    logAudit({
        user_id,
        action: AUDIT_ACTIONS.PASSWORD_CHANGED,
        entity_type: 'user',
        entity_id: user_id,
        description: `Password changed for user: ${user.email}`,
        ip_address,
    }).catch(err => logger.error('Audit log error', { error: err }));
};

/**
 * Request password reset
 * @param {Object} options - Password reset options
 * @param {string} options.email - User email
 * @param {string} options.ip_address - IP address for audit logging
 * @returns {Promise<Object>} Reset token and expiry (token should be sent via email)
 */
const requestPasswordReset = async (options) => {
    const { email, ip_address } = options;

    if (!email) {
        throw new Error('Email is required');
    }

    const result = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
    );

    // Always return success even if email not found (security: don't reveal if email exists)
    if (result.rows.length === 0) {
        logAudit({
            action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
            description: `Password reset requested for non-existent email: ${email}`,
            ip_address,
        }).catch(err => logger.error('Audit log error', { error: err }));
        return { message: 'If an account exists with this email, a reset link will be sent' };
    }

    const user = result.rows[0];

    // Invalidate any previously issued, unused reset tokens for this user
    await db.query(
        'UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false',
        [user.id]
    );

    // Generate reset token
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Insert token into database
    await db.query(
        'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, resetToken, tokenExpiry]
    );

    logAudit({
        user_id: user.id,
        action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
        entity_type: 'user',
        entity_id: user.id,
        description: `Password reset requested for: ${email}`,
        ip_address,
    }).catch(err => logger.error('Audit log error', { error: err }));

    // Send reset email via queue
    const { enqueueEmail } = require('./emailQueueService');
    const { renderTemplate } = require('./emailTemplateService');

    const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;

    const emailContent = renderTemplate('password-reset', {
        name: user.first_name || 'Member',
        resetLink
    });

    enqueueEmail({
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        priority: 1 // High priority
    }).catch(err => logger.error('Failed to queue reset email', { error: err }));

    return {
        message: 'If an account exists with this email, a reset link will be sent'
    };
};

/**
 * Reset user password with token
 * @param {Object} options - Reset options
 * @param {string} options.token - Reset token
 * @param {string} options.new_password - New password
 * @param {string} options.ip_address - IP address
 * @returns {Promise<Object>} Success message
 */
const resetPassword = async (options) => {
    const { token, new_password, ip_address } = options;

    if (!token || !new_password) {
        throw new Error('Token and new password are required');
    }

    // Verify token
    const tokenResult = await db.query(
        `SELECT pr.id, pr.user_id, pr.expires_at, pr.used, pr.token, u.password_hash, u.email
         FROM password_resets pr
         JOIN users u ON pr.user_id = u.id
         WHERE pr.token = $1`,
        [token]
    );

    if (tokenResult.rows.length === 0) {
        logAudit({
            action: AUDIT_ACTIONS.PASSWORD_RESET,
            description: 'Password reset failed: invalid token',
            ip_address,
        }).catch(err => logger.error('Audit log error', { error: err }));
        throw new Error('Invalid or expired password reset token');
    }

    const resetRequest = tokenResult.rows[0];

    // Check if used
    if (resetRequest.used) {
        logAudit({
            user_id: resetRequest.user_id,
            action: AUDIT_ACTIONS.PASSWORD_RESET,
            description: 'Password reset failed: token already used',
            ip_address,
        }).catch(err => logger.error('Audit log error', { error: err }));
        throw new Error('Invalid or expired password reset token');
    }

    // Check expiry
    if (new Date(resetRequest.expires_at) < new Date()) {
        logAudit({
            user_id: resetRequest.user_id,
            action: AUDIT_ACTIONS.PASSWORD_RESET,
            description: 'Password reset failed: token expired',
            ip_address,
        }).catch(err => logger.error('Audit log error', { error: err }));
        throw new Error('Invalid or expired password reset token');
    }

    // Validate new password strength
    const validator = require('validator');
    if (!validator.isStrongPassword(new_password, {
        minLength: 12,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
    })) {
        throw new Error('Password must be at least 12 characters and include uppercase, lowercase, number, and symbol');
    }

    // Check against current password
    if (await comparePassword(new_password, resetRequest.password_hash)) {
        throw new Error('New password cannot be the same as your current password');
    }

    // Check password history (last 5)
    // Note: This requires password_history table which we created in migration 007
    const historyResult = await db.query(
        'SELECT password_hash FROM password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
        [resetRequest.user_id]
    );

    for (const record of historyResult.rows) {
        if (await comparePassword(new_password, record.password_hash)) {
            throw new Error('New password cannot be one of your last 5 passwords');
        }
    }

    // Hash new password
    const new_password_hash = await hashPassword(new_password);

    // Perform updates in transaction
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Archive current password
        await client.query(
            'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
            [resetRequest.user_id, resetRequest.password_hash]
        );

        // 2. Update user password and increment token_version (invalidating sessions)
        await client.query(
            'UPDATE users SET password_hash = $1, token_version = COALESCE(token_version, 0) + 1, updated_at = NOW() WHERE id = $2',
            [new_password_hash, resetRequest.user_id]
        );

        // 3. Mark token as used
        await client.query(
            'UPDATE password_resets SET used = true WHERE id = $1',
            [resetRequest.id]
        );

        await client.query('COMMIT');

        // Log success
        logAudit({
            user_id: resetRequest.user_id,
            action: AUDIT_ACTIONS.PASSWORD_RESET,
            entity_type: 'user',
            entity_id: resetRequest.user_id,
            description: `Password reset successful for: ${resetRequest.email}`,
            ip_address,
        }).catch(err => logger.error('Audit log error', { error: err }));

        // Send confirmation email
        const { enqueueEmail } = require('./emailQueueService');
        const { renderTemplate } = require('./emailTemplateService');
        const emailContent = renderTemplate('password-changed-notification', {
            name: 'Member' // We could fetch name if needed
        });

        enqueueEmail({
            to: resetRequest.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
            priority: 1
        }).catch(err => logger.error('Failed to queue confirmation email', { error: err }));

        return { success: true };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Verify an email-verification token (Gate 1). Flips the account from
 * pending_verification to pending_approval (hand-off to the admin approval gate).
 * Mirrors resetPassword's token lookup; idempotent for an already-verified account.
 * @param {Object} options
 * @param {string} options.token
 * @param {string} options.ip_address
 * @returns {Promise<Object>} { status: 'verified' | 'already' }
 */
const verifyEmailToken = async (options) => {
    const { token, ip_address } = options;
    if (!token) {
        throw new Error('Invalid or expired verification link');
    }

    const result = await db.query(
        `SELECT ev.id, ev.user_id, ev.expires_at, ev.used, u.status
         FROM email_verifications ev
         JOIN users u ON ev.user_id = u.id
         WHERE ev.token = $1`,
        [token]
    );

    if (result.rows.length === 0) {
        throw new Error('Invalid or expired verification link');
    }

    const record = result.rows[0];

    // Idempotency: if the account already moved past pending_verification, treat a
    // re-click of the (now used) link as success rather than an error.
    if (record.status !== 'pending_verification') {
        return { status: 'already' };
    }

    if (record.used) {
        throw new Error('Invalid or expired verification link');
    }
    if (new Date(record.expires_at) < new Date()) {
        throw new Error('Invalid or expired verification link');
    }

    const client = await db.pool.connect();
    let transitioned = false;
    try {
        await client.query('BEGIN');
        const upd = await client.query(
            "UPDATE users SET status = 'pending_approval', updated_at = NOW() WHERE id = $1 AND status = 'pending_verification'",
            [record.user_id]
        );
        transitioned = !!(upd && upd.rowCount > 0);
        await client.query(
            'UPDATE email_verifications SET used = true WHERE id = $1',
            [record.id]
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    // If the row was concurrently consumed between the SELECT and the UPDATE, treat
    // this as an idempotent re-verification rather than logging a duplicate event.
    if (!transitioned) {
        return { status: 'already' };
    }

    logAudit({
        user_id: record.user_id,
        action: AUDIT_ACTIONS.EMAIL_VERIFIED,
        entity_type: 'user',
        entity_id: record.user_id,
        description: 'Email verified; awaiting admin approval',
        ip_address,
    }).catch(err => logger.error('Audit log error', { error: err }));

    return { status: 'verified' };
};

/**
 * Resend a verification email. Mirrors requestPasswordReset's opaque response: always
 * returns the same message and only issues a token when the email maps to a still-
 * unverified account (no account-existence or status disclosure).
 * @param {Object} options
 * @param {string} options.email
 * @param {string} options.ip_address
 * @returns {Promise<Object>} { message }
 */
const resendVerification = async (options) => {
    const { email, ip_address } = options;
    const opaque = { message: 'If an unverified account exists for this email, a new verification link has been sent.' };

    if (!email) {
        return opaque;
    }

    const result = await db.query(
        'SELECT id, first_name, status FROM users WHERE email = $1',
        [email]
    );

    if (result.rows.length === 0 || result.rows[0].status !== 'pending_verification') {
        return opaque;
    }

    const user = result.rows[0];
    try {
        await sendVerificationEmail(user.id, email, user.first_name);
        logAudit({
            user_id: user.id,
            action: AUDIT_ACTIONS.VERIFICATION_RESENT,
            entity_type: 'user',
            entity_id: user.id,
            description: `Verification email resent: ${email}`,
            ip_address,
        }).catch(err => logger.error('Audit log error', { error: err }));
    } catch (err) {
        logger.error('Failed to resend verification email', { error: err });
    }

    return opaque;
};

module.exports = {
    registerUser,
    authenticateUser,
    changePassword,
    requestPasswordReset,
    resetPassword,
    verifyEmailToken,
    resendVerification,
};
