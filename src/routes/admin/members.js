/**
 * routes/admin/members.js
 * Admin/Rabbi member-approval queue (two-gate registration, backlog item 6).
 * Gated by MANAGE_MEMBERS (held by admin + rabbi). State-changing routes are
 * CSRF-protected globally; the list view embeds _csrf in each form.
 */
const express = require('express');
const router = express.Router();
const adminMembersController = require('../../controllers/adminMembersController');
const { requirePermission } = require('../../middleware/requireRbac');
const requireAuth = require('../../middleware/requireAuth');
const sessionTimeout = require('../../middleware/sessionTimeout');
const { Permissions } = require('../../config/roles-permissions');

const requireMembersAdmin = [
    requireAuth,
    sessionTimeout(),
    requirePermission(Permissions.MANAGE_MEMBERS)
];

router.get('/', requireMembersAdmin, adminMembersController.listPending);
router.post('/:id/approve', requireMembersAdmin, adminMembersController.approve);
router.post('/:id/reject', requireMembersAdmin, adminMembersController.reject);

module.exports = router;
