const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const requireAuth = require('../middleware/requireAuth');
const sessionTimeout = require('../middleware/sessionTimeout');
const directoryController = require('../controllers/directoryController');

// Per-user rate limit on directory reads. The directory is auth-only, so we key by
// authenticated user id rather than IP. Mounted AFTER requireAuth so req.user is
// always present; a custom keyGenerator (not the default IP one) also sidesteps the
// express-rate-limit permissive-trust-proxy validator. Skipped in test for a
// deterministic suite (matches chatPostLimiter).
const directoryReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: (req) => (req.user && req.user.id ? String(req.user.id) : 'anonymous'),
    message: { error: 'Too many directory requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test'
});

router.get('/', requireAuth, sessionTimeout(), directoryReadLimiter, directoryController.getDirectory);
router.get('/:id', requireAuth, sessionTimeout(), directoryReadLimiter, directoryController.getProfile);

module.exports = router;
