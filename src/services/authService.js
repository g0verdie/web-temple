const db = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/authHelper');
const { logAudit, AUDIT_ACTIONS } = require('./auditService');

const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Authentication service
 * Handles user registration, login, and password management
 */

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
    const { email, password, first_name, last_name, ip_address } = userData;
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
        `INSERT INTO users (email, password_hash, first_name, last_name, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id, email, first_name, last_name, role, created_at`,
        [email, password_hash, first_name || null, last_name || null, 'member']
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
    }).catch(err => console.error('Audit log error:', err));

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
        throw new Error('Email and password are required');
    }

    // Find user by email
    const result = await db.query(
        'SELECT id, email, password_hash, role, first_name, last_name, failed_login_attempts, lockout_until FROM users WHERE email = $1',
        [email]
    );

    if (result.rows.length === 0) {
        // Log failed login attempt
        logAudit({
            action: AUDIT_ACTIONS.USER_LOGIN,
            description: `Failed login attempt: user not found (${email})`,
            ip_address,
        }).catch(err => console.error('Audit log error:', err));
        throw new Error('Invalid email or password');
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
        }).catch(err => console.error('Audit log error:', err));

        throw new Error(`Account is temporarily locked. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} (until ${resetTime}).`);
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
            }).catch(err => console.error('Audit log error:', err));
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
        }).catch(err => console.error('Audit log error:', err));
        throw new Error('Invalid email or password');
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
    }).catch(err => console.error('Audit log error:', err));

    // Return user without password hash
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
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
        throw new Error('User ID, current password, and new password are required');
    }

    const validator = require('validator');
    if (!validator.isStrongPassword(new_password, {
        minLength: 12,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
    })) {
        throw new Error('New password must be at least 12 characters and include uppercase, lowercase, number, and symbol');
    }

    if (current_password === new_password) {
        throw new Error('New password cannot be the same as current password');
    }

    // Fetch user
    const userResult = await db.query(
        'SELECT id, email, password_hash FROM users WHERE id = $1',
        [user_id]
    );

    if (userResult.rows.length === 0) {
        throw new Error('User not found');
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
        }).catch(err => console.error('Audit log error:', err));
        throw new Error('Current password is incorrect');
    }

    // Hash new password
    const new_password_hash = await hashPassword(new_password);

    // Update password in database
    await db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [new_password_hash, user_id]
    );

    // Log password change
    logAudit({
        user_id,
        action: AUDIT_ACTIONS.PASSWORD_CHANGED,
        entity_type: 'user',
        entity_id: user_id,
        description: `Password changed for user: ${user.email}`,
        ip_address,
    }).catch(err => console.error('Audit log error:', err));
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
        }).catch(err => console.error('Audit log error:', err));
        return { message: 'If an account exists with this email, a reset link will be sent' };
    }

    const user = result.rows[0];

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
    }).catch(err => console.error('Audit log error:', err));

    return {
        message: 'If an account exists with this email, a reset link will be sent',
        // In production, token would be sent via email service here
    };
};

module.exports = {
    registerUser,
    authenticateUser,
    changePassword,
    requestPasswordReset,
};
