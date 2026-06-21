const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/adminController');
const { requireAnyRole } = require('../../middleware/requireRbac');
const requireAuth = require('../../middleware/requireAuth');
const sessionTimeout = require('../../middleware/sessionTimeout');
const { Roles } = require('../../config/roles-permissions');

// Middleware to check for ADMIN or RABBI roles
// Note: requireAuth must be first to populate req.user
const requireAdminAccess = [
    requireAuth,
    sessionTimeout(),
    // The dashboard landing + metrics/audit are role-gated (the per-feature areas are
    // permission-gated). The membership director (item 13) needs the dashboard too, so
    // it is included here alongside admin/rabbi.
    requireAnyRole([Roles.ADMIN, Roles.RABBI, Roles.MEMBERSHIP_DIRECTOR])
];

// Dashboard Route
router.get('/', requireAdminAccess, adminController.getDashboard);

// Dashboard metrics JSON (30s client auto-refresh, Story 9.1) — admin/rabbi only.
router.get('/metrics.json', requireAdminAccess, adminController.getDashboardMetricsJson);

// Email Queue Retry Route
router.post('/email-queue/:id/retry', requireAdminAccess, adminController.retryEmailJob);

// Audit Logs Route
router.get('/audit-logs', requireAdminAccess, adminController.getAuditLogs);

// Chat Moderation Page Route
const chatController = require('../../controllers/chatController');
const { Permissions } = require('../../config/roles-permissions');
const { requirePermission } = require('../../middleware/requireRbac');

router.get('/chat-moderation', [
    requireAuth,
    sessionTimeout(),
    requirePermission(Permissions.MODERATE_CHAT)
], chatController.getPendingMessagesPage);

module.exports = router;
