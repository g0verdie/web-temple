const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { requireRole } = require('../middleware/requireRbac');
const requireAuth = require('../middleware/requireAuth');
const sessionTimeout = require('../middleware/sessionTimeout');
const { Roles } = require('../config/roles-permissions');
const backupLogService = require('../services/backupLogService');
const auditService = require('../services/auditService');
const sessionService = require('../services/sessionService');
const userController = require('../controllers/userController');
const unsubscribeController = require('../controllers/unsubscribeController');
const authRoutes = require('./auth');
const StreamingService = require('../services/StreamingService');
const logger = require('../utils/logger');

// GET /api/stream/status - Public endpoint for homepage polling
router.get('/stream/status', async (req, res) => {
    try {
        const stream = await StreamingService.getPublicEmbedMetadata();
        res.json(stream);
    } catch (err) {
        logger.error('API Error (stream status)', { error: err });
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Middleware to check for ADMIN role (strict)
const requireSuperAdminAccess = [
    requireAuth,
    sessionTimeout(),
    requireRole(Roles.ADMIN)
];

// Session timeout middleware for all authenticated users
const requireAuthSession = [
    requireAuth,
    sessionTimeout()
];

// Rate limiter for email change requests (5 per hour per IP)
const emailChangeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many email change requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter for the chat REST fallback (10 posts per minute per IP).
// This is the per-IP abuse gate for the REST path. The WebSocket post path has
// its own per-connection flood guard (MAX_POSTS_PER_WINDOW in chatSocketServer);
// the 50-conn cap alone does NOT bound per-socket write rate. Skipped in tests
// to keep the existing integration suite deterministic.
const chatPostLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many chat messages. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test'
});

// Account settings routes
router.get('/account/settings', requireAuthSession, userController.getAccountSettings);
router.put('/account/profile', requireAuthSession, userController.updateProfile);
router.put('/account/preferences', requireAuthSession, userController.updatePreferences);
router.post('/account/password', requireAuthSession, userController.changePassword);
router.post('/account/email-change', requireAuthSession, emailChangeLimiter, userController.requestEmailChange);
router.post('/account/email-change/confirm', userController.confirmEmailChange);

// Public one-click unsubscribe (CAN-SPAM). Token-authenticated, no requireAuth —
// mirrors the email-change/confirm flow. The signed token proves the recipient.
router.post('/unsubscribe/confirm', unsubscribeController.apply);

// Member directory: a member's own listing (self-service)
router.get('/account/directory', requireAuthSession, userController.getDirectoryListing);
router.put('/account/directory', requireAuthSession, userController.updateDirectoryListing);

// PUT /api/users/onboarding/complete
router.put('/users/onboarding/complete', requireAuthSession, userController.completeOnboarding);

// Auth routes
router.use('/auth', authRoutes);

// GET /api/session/status - Frontend can poll this to detect pre-timeout warning (Story 2-5)
// Returns remaining session time and warning zone indicator
router.get('/session/status', requireAuthSession, async (req, res) => {
    try {
        const status = await sessionService.getSessionStatus(req.user);
        res.json(status);
    } catch (err) {
        const statusCode = err.code || 500;
        res.status(statusCode).json({
            error: err.message,
            details: err.details
        });
    }
});

// GET /api/admin/backups/status
router.get('/admin/backups/status', requireSuperAdminAccess, async (req, res) => {
    try {
        // Use the absolute path defined in script or fallback relative to project root
        // In production, LOG_FILE is /var/log/temple/backups.log
        // In dev, it might be project_root/logs/backups.log

        const latestAttempt = await backupLogService.getLastBackupAttempt();
        const lastSuccess = await backupLogService.getLastSuccessfulBackup();

        if (latestAttempt) {
            // If latest failed, we still might want to know when the last success was
            // Adjust response to match previous contract or improve it
            // Previous contract: { lastBackup: { ... }, status: 'success' }
            // If error, it just returned 'no-success-backups'.
            // Let's improve: return last ATTEMPT details, and if it was error, status is error.

            if (latestAttempt.status === 'SUCCESS') {
                res.json({
                    lastBackup: {
                        timestamp: latestAttempt.timestamp,
                        size_bytes: latestAttempt.size_bytes,
                        message: latestAttempt.message
                    },
                    status: 'success'
                });
            } else {
                res.json({
                    lastBackup: { // Return failure details
                        timestamp: latestAttempt.timestamp,
                        message: latestAttempt.message
                    },
                    lastSuccess: lastSuccess ? { timestamp: lastSuccess.timestamp } : null,
                    status: 'error',
                    message: 'Latest backup failed'
                });
            }
        } else {
            res.json({ lastBackup: null, status: 'no-backups' });
        }


    } catch (error) {
        logger.error('API Error', { error });
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/admin/audit-logs
router.get('/admin/audit-logs', requireSuperAdminAccess, async (req, res) => {
    try {
        const { action, userId, entityType, startDate, endDate, limit, offset } = req.query;
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 1000);
        const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

        const logsData = await auditService.queryLogs({
            action,
            user_id: userId,
            entity_type: entityType,
            startDate,
            endDate,
            limit: parsedLimit,
            offset: parsedOffset
        });

        res.json({
            logs: logsData.logs,
            total: logsData.total,
            limit: parsedLimit,
            offset: parsedOffset
        });
    } catch (error) {
        logger.error('API Error (audit logs)', { error });
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ============================================================================
// Live Chat Endpoints
// ============================================================================
const chatController = require('../controllers/chatController');
const { Permissions } = require('../config/roles-permissions');
const { requirePermission } = require('../middleware/requireRbac');

// GET /api/chat/poll?streamId=<id>&since=<timestamp> - REST fallback to poll messages
router.get('/chat/poll', chatController.getMessagesPoll);

// POST /api/chat/post - REST fallback to send a message (rate-limited)
router.post('/chat/post', chatPostLimiter, chatController.postMessage);

// POST /api/chat/message/:id/approve - Approve chat message
router.post('/chat/message/:id/approve', [
    requireAuth,
    sessionTimeout(),
    requirePermission(Permissions.MODERATE_CHAT)
], chatController.approveMessage);

// POST /api/chat/message/:id/delete - Delete chat message
router.post('/chat/message/:id/delete', [
    requireAuth,
    sessionTimeout(),
    requirePermission(Permissions.MODERATE_CHAT)
], chatController.deleteMessage);

module.exports = router;
