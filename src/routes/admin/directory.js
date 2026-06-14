/**
 * routes/admin/directory.js
 * Admin view of all members + profile moderation (R16/R17). Standalone — does not
 * depend on the (not-yet-built) Rabbi dashboard; the dashboard will surface this
 * later rather than introduce it.
 */

const express = require('express');
const router = express.Router();
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

router.get('/', requireDirectoryAdmin, adminDirectoryController.getDirectoryAdmin);
router.post('/moderate', requireDirectoryAdmin, adminDirectoryController.moderate);

module.exports = router;
