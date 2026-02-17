const { registerUser, authenticateUser } = require('../services/authService');
const { enqueueEmail } = require('../services/emailQueueService');
const { renderTemplate } = require('../services/emailTemplateService');
const jwt = require('jsonwebtoken');

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
    try {
        const { email, password, first_name, last_name } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Register user via authService
        const user = await registerUser({
            email,
            password,
            first_name,
            last_name,
            ip_address: req.ip || req.connection.remoteAddress
        });

        // Generate JWT token
        const token = jwt.sign(
            {
                user_id: user.id,
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Set secure HTTP-only cookie
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
        });

        // Send welcome email (fire and forget)
        const emailContent = renderTemplate('welcome', {
            name: first_name || email
        });

        enqueueEmail({
            to: email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
            priority: 2 // Medium priority
        }).catch(err => {
            console.error('Failed to queue welcome email:', err);
            // Don't fail registration if email fails
        });

        // Return success with user data (without password)
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Registration error:', error);

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

        const { logAudit, AUDIT_ACTIONS } = require('../services/auditService');
        // Log failed registration attempt
        logAudit({
            action: AUDIT_ACTIONS.USER_REGISTERED, // Using USER_REGISTERED with error description to denote failure attempt? Or create new action type. 
            // Ideally we should have USER_REGISTRATION_FAILED.
            description: `Failed registration attempt: ${error.message} (${email})`,
            ip_address: req.ip || req.connection.remoteAddress,
        }).catch(err => console.error('Audit log error:', err));

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

        // Generate JWT token
        const token = jwt.sign(
            {
                user_id: user.id,
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

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
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);

        if (error.message.includes('Account is temporarily locked')) {
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
const logout = (req, res) => {
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
        const { requestPasswordReset: requestResetService } = require('../services/authService');
        
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
        console.error('Password reset request error:', error);
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
    requestPasswordReset
};
