const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/adminController');
const { requireAnyRole, requireStaff } = require('../../middleware/requireRbac');
const requireAuth = require('../../middleware/requireAuth');
const sessionTimeout = require('../../middleware/sessionTimeout');
const { Roles } = require('../../config/roles-permissions');

// Roles that see the full dashboard (and its metrics, audit logs and email queue).
const FULL_DASHBOARD_ROLES = [Roles.ADMIN, Roles.RABBI, Roles.MEMBERSHIP_DIRECTOR];

// Middleware to check for ADMIN, RABBI or MEMBERSHIP_DIRECTOR roles
// Note: requireAuth must be first to populate req.user
const requireAdminAccess = [
    requireAuth,
    sessionTimeout(),
    // Metrics/audit/email-queue are role-gated (the per-feature areas are
    // permission-gated). The membership director (item 13) needs the dashboard too, so
    // it is included here alongside admin/rabbi.
    requireAnyRole(FULL_DASHBOARD_ROLES)
];

// Any staff role may open /admin; which page it gets depends on the role.
const requireStaffAccess = [
    requireAuth,
    sessionTimeout(),
    requireStaff()
];

// Dashboard Route: the full dashboard for admin/rabbi/membership director, a light
// permission-filtered landing for other staff. Reads req.user.role (reloaded from the
// DB by requireAuth), not res.locals.user, which holds the possibly stale token claim.
router.get('/', requireStaffAccess, (req, res, next) => {
    if (FULL_DASHBOARD_ROLES.includes(req.user.role)) {
        return adminController.getDashboard(req, res, next);
    }
    return adminController.getStaffHome(req, res);
});

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
