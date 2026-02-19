/**
 * Session Management Service
 * 
 * Handles session operations including:
 * - Checking session status and remaining time
 * - Invalidating expired sessions
 * - Determining if session is in warning zone
 */

const redis = require('../config/redis');
const { Roles } = require('../config/roles-permissions');

const ADMIN_TIMEOUT_MINUTES = 30;
const MEMBER_TIMEOUT_MINUTES = 30 * 24 * 60; // 30 days

/**
 * Get timeout in minutes based on user role
 * @private
 */
const getTimeoutMinutes = (role) => {
    return [Roles.ADMIN, Roles.RABBI].includes(role) ? ADMIN_TIMEOUT_MINUTES : MEMBER_TIMEOUT_MINUTES;
};

/**
 * Get session key prefix based on role
 * @private
 */
const getSessionKeyPrefix = (role) => {
    return [Roles.ADMIN, Roles.RABBI].includes(role) ? 'admin' : 'member';
};

/**
 * Get current session status for a user
 * Returns remaining time, warning zone, etc.
 * 
 * @param {Object} user - User object with id and role
 * @returns {Promise<Object>} Session status object
 * @throws {Object} Error object with code and message if session is invalid
 */
const getSessionStatus = async (user) => {
    if (!user || !user.id) {
        throw { code: 401, message: 'Not authenticated' };
    }

    const sessionKeyPrefix = getSessionKeyPrefix(user.role);
    const sessionKey = `session:${sessionKeyPrefix}:${user.id}`;
    const timeoutMinutes = getTimeoutMinutes(user.role);

    try {
        const lastActivityStr = await redis.get(sessionKey);

        if (!lastActivityStr) {
            throw { code: 401, message: 'Session not found' };
        }

        const lastActivity = parseInt(lastActivityStr, 10);
        const now = Date.now();
        const inactiveMs = now - lastActivity;
        const timeoutMs = timeoutMinutes * 60 * 1000;
        const remainingMs = Math.max(0, timeoutMs - inactiveMs);
        const percentRemaining = (remainingMs / timeoutMs) * 100;

        return {
            status: 'active',
            remainingMs: remainingMs,
            percentRemaining: percentRemaining,
            willExpireAt: new Date(now + remainingMs),
            lastActivityAt: new Date(lastActivity),
            isWarningZone: percentRemaining <= 5 && percentRemaining > 0,
            timeoutMinutes: timeoutMinutes
        };
    } catch (err) {
        if (err.code) {
            throw err; // Re-throw our custom errors
        }
        throw { code: 500, message: 'Session check failed', details: err.message };
    }
};

/**
 * Create or refresh a session for a user
 * @param {Object} user - User object with id and role
 * @returns {Promise<void>}
 */
const createSession = async (user) => {
    if (!user || !user.id) {
        throw new Error('User required for session creation');
    }
    const sessionKeyPrefix = getSessionKeyPrefix(user.role);
    const sessionKey = `session:${sessionKeyPrefix}:${user.id}`;
    const timeoutMinutes = getTimeoutMinutes(user.role);
    const ttlSeconds = timeoutMinutes * 60;
    const now = String(Date.now());

    await redis.setex(sessionKey, ttlSeconds, now);
};

/**
 * Invalidate a session for a user
 * @param {Object} user - User object with id and role
 * @returns {Promise<void>}
 */
const invalidateSession = async (user, tokenData = null) => {
    if (user && user.id) {
        const sessionKeyPrefix = getSessionKeyPrefix(user.role);
        const sessionKey = `session:${sessionKeyPrefix}:${user.id}`;
        await redis.del(sessionKey);
    }

    if (tokenData && tokenData.jti && tokenData.exp) {
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = Math.max(1, tokenData.exp - now);
        await redis.setex(`invalidated:token:${tokenData.jti}`, expiresIn, '1');
    }
};

module.exports = {
    getSessionStatus,
    createSession,
    invalidateSession
};
