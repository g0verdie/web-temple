/**
 * routes/admin/announcements.js
 * Admin authoring for announcements (Epic 5). Gated by the POST_ANNOUNCEMENTS
 * permission (admin / rabbi / social_chair, FR25-27) via requirePermission so
 * Social Chair works without listing roles (KTD7).
 */

const express = require('express');
const router = express.Router();
const announcementController = require('../../controllers/announcementController');
const { requirePermission } = require('../../middleware/requireRbac');
const requireAuth = require('../../middleware/requireAuth');
const sessionTimeout = require('../../middleware/sessionTimeout');
const { Permissions } = require('../../config/roles-permissions');

const requireAnnouncementAdmin = [
    requireAuth,
    sessionTimeout(),
    requirePermission(Permissions.POST_ANNOUNCEMENTS)
];

router.get('/', requireAnnouncementAdmin, announcementController.list);
router.get('/new', requireAnnouncementAdmin, announcementController.newForm);
router.get('/:id/edit', requireAnnouncementAdmin, announcementController.editForm);

router.post('/', requireAnnouncementAdmin, announcementController.create);
router.post('/:id/delete', requireAnnouncementAdmin, announcementController.remove);
router.post('/:id/restore', requireAnnouncementAdmin, announcementController.restore);
router.post('/:id/feature', requireAnnouncementAdmin, announcementController.feature);
router.post('/:id', requireAnnouncementAdmin, announcementController.update);

module.exports = router;
