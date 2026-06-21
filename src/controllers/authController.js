const { registerUser, authenticateUser, requestPasswordReset: requestResetService, resetPassword: resetPasswordService, verifyEmailToken: verifyEmailService, resendVerification: resendVerificationService } = require('../services/authService');
const { createSession, invalidateSession } = require('../services/sessionService');
const { logAudit, AUDIT_ACTIONS } = require('../services/auditService');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret' : null);
const JWT_EXPIRES_IN = '30d'; // 30 days for members

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
}

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res) => {
    let email = null;

    try {
        const body = req.body || {};
        ({ email } = body);
        const { password, first_name, last_name, directory_listed } = body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Register user via authService (creates a pending_verification account and
        // queues the verification email internally)
        await registerUser({
            email,
            password,
            first_name,
            last_name,
            directory_listed: directory_listed === true,
            ip_address: req.ip || req.connection.remoteAddress
        });

        // Two-gate registration: NO auto-login. The account is created as
        // pending_verification and the verification email was queued inside
        // registerUser. The welcome email is deferred to admin approval.
        res.status(201).json({
            success: true,
            message: 'Registration received. Please check your email to verify your address. After you verify, a temple administrator will review your membership.'
        });

    } catch (error) {
        logger.error('Registration error', { error });

        // Handle specific error messages
        if (error.message === 'Email already registered') {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }

        if (error.message.includes('Password must be') || error.message.includes('Valid email')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        // Log failed registration attempt
        logAudit({
            action: AUDIT_ACTIONS.USER_REGISTRATION_FAILED,
            description: `Failed registration attempt: ${error.message} (${email})`,
            ip_address: req.ip || req.connection.remoteAddress,
        }).catch(err => logger.error('Audit log error', { error: err }));

        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.'
        });
    }
};

/**
 * Login a user
 * POST /api/auth/login
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Authenticate user
        const user = await authenticateUser({
            email,
            password,
            ip_address: req.ip || req.connection.remoteAddress
        });

        // Generate UUID-like token ID
        const jti = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

        // Generate JWT token
        const token = jwt.sign(
            {
                user_id: user.id,
                email: user.email,
                role: user.role,
                onboarding_complete: user.onboarding_complete || false,
                token_version: user.token_version,
                jti: jti
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Create Redis session
        await createSession(user);

        // Set secure HTTP-only cookie
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role,
                onboarding_complete: user.onboarding_complete
            }
        });

    } catch (error) {
        logger.error('Login error', { error });

        if (error.message.includes('Account is temporarily locked')) {
            return res.status(403).json({
                success: false,
                message: error.message
            });
        }

        // Two-gate registration states (verify email / awaiting approval / rejected):
        // surface the specific guidance with 403 rather than the generic 401, so the UI
        // can tell the user what to do next.
        if (error.message.includes('verify your email') ||
            error.message.includes('awaiting approval') ||
            error.message.includes('was not approved')) {
            return res.status(403).json({
                success: false,
                message: error.message
            });
        }

        res.status(401).json({
            success: false,
            message: 'Invalid email or password'
        });
    }
};

/**
 * Logout a user
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
    // Try to get user from request (if requireAuth used) or decode token
    let user = req.user;
    let jti = null;
    let exp = null;
    if (!user && req.cookies && req.cookies.auth_token) {
        try {
            // Decode without verification just to identify the session to kill
            const decoded = jwt.decode(req.cookies.auth_token);
            if (decoded) {
                user = { id: decoded.user_id, role: decoded.role };
                jti = decoded.jti;
                exp = decoded.exp;
            }
        } catch (e) {
            logger.warn('Failed to decode token during logout', { error: e });
        }
    } else if (req.cookies && req.cookies.auth_token) {
        // If user was populated by middleware, we still need jti and exp
        try {
            const decoded = jwt.decode(req.cookies.auth_token);
            if (decoded) {
                jti = decoded.jti;
                exp = decoded.exp;
            }
        } catch (e) {
            logger.warn('Failed to decode token during logout', { error: e });
        }
    }

    if (user) {
        await invalidateSession(user, { jti, exp });
    }

    res.clearCookie('auth_token');
    res.json({
        success: true,
        message: 'Logout successful'
    });
};

/**
 * Request password reset
 * POST /api/auth/password-reset-request
 */
const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Use authService to process password reset request
        const result = await requestResetService({
            email,
            ip_address: req.ip || req.connection.remoteAddress
        });

        // Always return success message (security: don't reveal if email exists)
        res.json({
            success: true,
            message: result.message
        });

    } catch (error) {
        logger.error('Password reset request error', { error });
        res.status(500).json({
            success: false,
            message: 'An error occurred. Please try again later.'
        });
    }
};

/**
 * Reset password
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
    try {
        const { token, new_password } = req.body;

        if (!token || !new_password) {
            return res.status(400).json({
                success: false,
                message: 'Token and new password are required'
            });
        }

        await resetPasswordService({
            token,
            new_password,
            ip_address: req.ip || req.connection.remoteAddress
        });

        res.json({
            success: true,
            message: 'Password reset successful'
        });

    } catch (error) {
        logger.error('Password reset error', { error });

        // Return 400 for known errors to help frontend
        if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('Password') || error.message.includes('password')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'An error occurred. Please try again later.'
        });
    }
};

/**
 * Verify an email address from the link in the verification email (Gate 1).
 * GET /auth/verify-email?token=...
 * Renders a result page. The token is the credential, so verification happens on GET
 * (idempotent: a re-click of an already-used link shows "already verified").
 */
const verifyEmailPage = async (req, res) => {
    const token = req.query.token || '';
    try {
        const result = await verifyEmailService({
            token,
            ip_address: req.ip || req.connection.remoteAddress
        });
        return res.render('layout', {
            title: 'Email Verified - Temple B\'nai Israel',
            bodyView: 'auth/verify-email-result',
            viewData: { ok: true, already: result.status === 'already' },
            noindex: true,
            stylesheets: ['/css/auth.css']
        });
    } catch (error) {
        logger.warn('Email verification failed', { error: error.message });
        return res.status(400).render('layout', {
            title: 'Verification Failed - Temple B\'nai Israel',
            bodyView: 'auth/verify-email-result',
            viewData: { ok: false, message: error.message },
            noindex: true,
            stylesheets: ['/css/auth.css']
        });
    }
};

/**
 * Resend a verification email.
 * POST /api/auth/resend-verification
 * Always returns the same opaque message (no account-existence disclosure).
 */
const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await resendVerificationService({
            email,
            ip_address: req.ip || req.connection.remoteAddress
        });
        res.json({ success: true, message: result.message });
    } catch (error) {
        logger.error('Resend verification error', { error });
        res.status(500).json({
            success: false,
            message: 'An error occurred. Please try again later.'
        });
    }
};

module.exports = {
    register,
    login,
    logout,
    requestPasswordReset,
    resetPassword,
    verifyEmailPage,
    resendVerification
};
