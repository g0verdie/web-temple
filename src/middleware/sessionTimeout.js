/**
 * Session Timeout Middleware
 * 
 * Enforces role-based automatic logout:
 * - Admin/Rabbi: 30 minutes of inactivity (FR104)
 * - Members: 30 days of inactivity (FR28)
 * 
 * Features:
 * - Tracks last activity timestamp in Redis with appropriate TTL
 * - Checks session validity on each request/page load
 * - Refreshes session timeout on each request
 * - Returns 401 and clears cookie if session expired
 * - Session keys use role-based format: session:{role}:{userId}
 */

const redis = require('../config/redis');
const { Roles } = require('../config/roles-permissions');
const sessionService = require('../services/sessionService');
const jwt = require('jsonwebtoken');

const ADMIN_TIMEOUT_MINUTES = 30;
const MEMBER_TIMEOUT_MINUTES = 30 * 24 * 60; // 30 days in minutes
const DEFAULT_ADMIN_ROLES = [Roles.ADMIN, Roles.RABBI, Roles.TREASURER];

/**
 * Determine timeout in minutes based on user role
 * @private
 * @param {string} role - User role
 * @returns {number} Timeout in minutes
 */
const getTimeoutMinutes = (role) => {
    return DEFAULT_ADMIN_ROLES.includes(role) ? ADMIN_TIMEOUT_MINUTES : MEMBER_TIMEOUT_MINUTES;
};

/**
 * Determine session key prefix based on user role
 * @private
 * @param {string} role - User role
 * @returns {string} Session key prefix (e.g., 'admin' or 'member')
 */
const getSessionKeyPrefix = (role) => {
    return DEFAULT_ADMIN_ROLES.includes(role) ? 'admin' : 'member';
};

/**
 * Create session timeout middleware
 * @param {Object} options - Configuration options (currently unused, kept for backward compatibility)
 * @returns {Function} Express middleware function
 */
const sessionTimeout = (options = {}) => {
    void options;
    return async (req, res, next) => {
        const user = req.user;

        // Allow requests without authentication (synchronous fast path)
        if (!user) {
            return next();
        }

        try {

            // Get timeout and session key based on user role
            const timeoutMinutes = getTimeoutMinutes(user.role);
            const sessionKeyPrefix = getSessionKeyPrefix(user.role);
            const sessionKey = `session:${sessionKeyPrefix}:${user.id}`;
            const timeoutMs = timeoutMinutes * 60 * 1000; // Convert to milliseconds
            const ttlSeconds = timeoutMinutes * 60; // For Redis TTL

            // Try to get last activity time from Redis
            let lastActivityStr;
            try {
                lastActivityStr = await redis.get(sessionKey);
            } catch (redisError) {
                // Redis error - fail-secure: deny access
                console.error('Session timeout check failed:', redisError);
                return respondWithError(res, 401, 'Session check failed', req);
            }

            const now = Date.now();

            // If session doesn't exist, this is first request - allow it and create session
            // If session doesn't exist in Redis, it's invalid or expired (even if JWT is valid)
            if (!lastActivityStr) {
                // Do NOT create a new session. Strict enforcement.
                res.clearCookie('auth_token');
                return respondWithError(res, 401, 'Session expired or invalid', req);
            }

            // Check if session has expired
            const lastActivity = parseInt(lastActivityStr, 10);
            const inactiveMs = now - lastActivity;

            if (inactiveMs > timeoutMs) {
                // Session expired - invalidate token and clean up session
                const token = req.cookies && req.cookies.auth_token;
                if (token) {
                    try {
                        const decoded = jwt.decode(token);
                        if (decoded && decoded.jti && decoded.exp) {
                            await sessionService.invalidateSession(null, { jti: decoded.jti, exp: decoded.exp });
                        }
                    } catch (e) {
                        console.warn('Failed to decode token on session timeout:', e);
                    }
                }
                res.clearCookie('auth_token');

                // Delete expired session key from Redis (cleanup)
                try {
                    await redis.del(sessionKey);
                } catch (delError) {
                    console.warn('Failed to delete expired session key:', delError);
                    // Don't fail the response - session is still invalid
                }

                return respondWithError(res, 401, 'Session expired', req);
            }

            // Session is valid - refresh the timeout
            try {
                await redis.setex(sessionKey, ttlSeconds, String(now));
            } catch (setexError) {
                // Log but don't fail - allow request with warning
                console.warn('Failed to refresh session timeout:', setexError);
            }

            // Session is valid, proceed
            return next();

        } catch (error) {
            // Unexpected error - fail-secure: deny access
            console.error('Session timeout middleware error:', error);
            return respondWithError(res, 401, 'Session validation error', req);
        }
    };
};

/**
 * Helper to send error response in JSON or text format
 * @private
 */
const respondWithError = (res, statusCode, errorMessage, req) => {
    const url = req.originalUrl || req.url || '';
    if (req.accepts('html') && !url.startsWith('/api/')) {
        return res.redirect('/login?message=' + encodeURIComponent('Your session has expired. Please log in again.'));
    }
    if (req.accepts('json')) {
        return res.status(statusCode).json({
            error: errorMessage,
            message: 'Your session has expired. Please log in again.'
        });
    }
    return res.status(statusCode).send(errorMessage);
};

module.exports = sessionTimeout;
