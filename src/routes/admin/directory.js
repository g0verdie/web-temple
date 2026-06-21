/**
 * routes/admin/directory.js
 * Admin view of all members + profile moderation (R16/R17). Standalone — does not
 * depend on the (not-yet-built) Rabbi dashboard; the dashboard will surface this
 * later rather than introduce it.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const adminDirectoryController = require('../../controllers/adminDirectoryController');
const { requirePermission } = require('../../middleware/requireRbac');
const requireAuth = require('../../middleware/requireAuth');
const sessionTimeout = require('../../middleware/sessionTimeout');
const { Permissions } = require('../../config/roles-permissions');

// Gated by a dedicated permission, not a broad role check (plan KTD7).
const requireDirectoryAdmin = [
    requireAuth,
    sessionTimeout(),
    requirePermission(Permissions.MANAGE_DIRECTORY)
];

// Export decrypts every listed member's PII in one request, so cap export frequency
// per user (mirrors the donations export limiter).
const exportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => (req.user && req.user.id ? String(req.user.id) : 'anonymous'),
    message: { error: 'Too many export requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test'
});

router.get('/', requireDirectoryAdmin, adminDirectoryController.getDirectoryAdmin);
router.get('/export.csv', requireDirectoryAdmin, exportLimiter, adminDirectoryController.exportCsv);
router.get('/export.json', requireDirectoryAdmin, exportLimiter, adminDirectoryController.exportJson);
router.post('/moderate', requireDirectoryAdmin, adminDirectoryController.moderate);

// Admin edit of any member's listing (item 8). Registered after /moderate so the
// literal path wins over the :userId param; /export.* GETs are likewise unaffected
// (they are single-segment and registered above).
router.get('/:userId/edit', requireDirectoryAdmin, adminDirectoryController.editForm);
router.post('/:userId', requireDirectoryAdmin, adminDirectoryController.update);

module.exports = router;
