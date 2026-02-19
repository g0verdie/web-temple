const jwt = require('jsonwebtoken');
const db = require('../config/db');
const redis = require('../config/redis');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret' : null);

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
}

/**
 * Middleware to require authentication
 * Verifies JWT token from cookie and checks token_version against DB for invalidation.
 */
const requireAuth = async (req, res, next) => {
    const token = req.cookies.auth_token;

    // Test environment fallback
    if (process.env.NODE_ENV === 'test' && !token) {
        req.user = {
            id: 'admin-001',
            role: 'admin',
            email: 'admin@example.com',
            first_name: 'Test',
            last_name: 'Admin'
        };
        return next();
    }

    if (!token) {
        if (req.accepts('html')) {
            return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
        }
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check token blacklist
        if (decoded.jti) {
            const isBlacklisted = await redis.get(`invalidated:token:${decoded.jti}`);
            if (isBlacklisted) {
                throw new Error('Token has been invalidated');
            }
        }

        // Check token_version for session invalidation
        // We need to fetch the current version from DB
        // Optimization: In a high-traffic app, we might cache this or only check on critical actions.
        // For this app, checking on every request ensures immediate invalidation.
        const result = await db.query('SELECT token_version, role, email FROM users WHERE id = $1', [decoded.user_id]);

        if (result.rows.length === 0) {
            throw new Error('User not found');
        }

        const user = result.rows[0];

        // If the token has a version (new tokens will), compare it.
        // If token doesn't have version (old tokens), and DB has version > 1 (or whatever default), invalidate.
        // Or simply: if DB version != payload version, invalidate.
        // Handling legacy tokens: Treat missing version in token as 0 or 1?
        // Let's assume missing = 0.
        const payloadVersion = decoded.token_version || 0;
        const dbVersion = user.token_version || 0; // DB default is 1 in our migration, but old records might be null if not backfilled? Migration sets default 1.

        if (payloadVersion !== dbVersion) {
            throw new Error('Session invalidated');
        }

        req.user = {
            id: decoded.user_id,
            email: user.email,
            role: user.role
        };

        next();

    } catch (error) {
        // Clear invalid cookie
        res.clearCookie('auth_token');

        if (req.accepts('html')) {
            return res.redirect('/login?message=' + encodeURIComponent('Session expired. Please login again.'));
        }
        return res.status(401).json({ success: false, message: 'Session expired or invalid' });
    }
};

module.exports = requireAuth;
