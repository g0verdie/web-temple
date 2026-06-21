/**
 * routes/admin/messages.js
 * Admin/Rabbi contact-message inbox (item 9). Gated by MANAGE_MESSAGES (held by admin
 * + rabbi). State-changing POSTs are CSRF-protected globally; forms embed _csrf.
 */
const express = require('express');
const router = express.Router();
const adminMessageController = require('../../controllers/adminMessageController');
const { requirePermission } = require('../../middleware/requireRbac');
const requireAuth = require('../../middleware/requireAuth');
const sessionTimeout = require('../../middleware/sessionTimeout');
const { Permissions } = require('../../config/roles-permissions');

const requireMessagesAdmin = [
    requireAuth,
    sessionTimeout(),
    requirePermission(Permissions.MANAGE_MESSAGES)
];

router.get('/', requireMessagesAdmin, adminMessageController.list);
router.get('/:id', requireMessagesAdmin, adminMessageController.view);
router.post('/:id/status', requireMessagesAdmin, adminMessageController.updateStatus);
router.post('/:id/delete', requireMessagesAdmin, adminMessageController.remove);

module.exports = router;
