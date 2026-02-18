const express = require('express');
const router = express.Router();
const { register, login, logout, requestPasswordReset } = require('../controllers/authController');

const rateLimit = require('express-rate-limit');

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per windowMs
    message: { success: false, message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', authLimiter, register);

/**
 * POST /api/auth/login
 * Authenticate and login a user
 */
// Debug middleware
// router.post('/login', authLimiter, (req, res, next) => { console.error('Debug: Hit Login Route Middleware'); next(); }, login);
router.post('/login', authLimiter, login);

/**
 * POST /api/auth/logout
 * Logout the current user
 */
router.post('/logout', logout);

/**
 * POST /api/auth/password-reset-request
 * Request a password reset email
 */
router.post('/password-reset-request', authLimiter, requestPasswordReset);

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', authLimiter, require('../controllers/authController').resetPassword);

module.exports = router;
