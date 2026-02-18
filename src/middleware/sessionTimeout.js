/**
 * Session Timeout Middleware
 * 
 * Enforces automatic logout for admin users (ADMIN, RABBI) after 30 minutes of inactivity.
 * - Tracks last activity timestamp in Redis
 * - Checks session validity on each request
 * - Refreshes session timeout on each admin request
 * - Returns 401 and clears cookie if session expired
 */

const redis = require('../config/redis');
const { Roles } = require('../config/roles-permissions');

const DEFAULT_TIMEOUT_MINUTES = 30;
const DEFAULT_ADMIN_ROLES = [Roles.ADMIN, Roles.RABBI];

/**
 * Create session timeout middleware
 * @param {Object} options - Configuration options
 * @param {number} options.timeoutMinutes - Session timeout in minutes (default: 30)
 * @param {string[]} options.adminRoles - Roles that have session timeout (default: ADMIN, RABBI)
 * @returns {Function} Express middleware function
 */
const sessionTimeout = (options = {}) => {
    const timeoutMinutes = options.timeoutMinutes || DEFAULT_TIMEOUT_MINUTES;
    const adminRoles = options.adminRoles || DEFAULT_ADMIN_ROLES;
    const timeoutMs = timeoutMinutes * 60 * 1000; // Convert to milliseconds
    const ttlSeconds = timeoutMinutes * 60; // For Redis TTL

    return async (req, res, next) => {
        try {
            const user = req.user;

            // Only enforce timeout for admin users
            if (!user || !adminRoles.includes(user.role)) {
                return next();
            }

            const sessionKey = `session:admin:${user.id}`;

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

            // If session doesn't exist, this is first admin request - allow it and create session
            if (!lastActivityStr) {
                try {
                    await redis.setex(sessionKey, ttlSeconds, String(now));
                } catch (setexError) {
                    // Log but don't fail - allow request to proceed
                    console.error('Failed to set session timeout:', setexError);
                }
                return next();
            }

            // Check if session has expired
            const lastActivity = parseInt(lastActivityStr, 10);
            const inactiveMs = now - lastActivity;

            if (inactiveMs > timeoutMs) {
                // Session expired
                res.clearCookie('auth_token');
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
    if (req.accepts('json')) {
        return res.status(statusCode).json({
            error: errorMessage,
            message: 'Your session has expired. Please log in again.'
        });
    }
    return res.status(statusCode).send(errorMessage);
};

module.exports = sessionTimeout;
