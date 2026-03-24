/**
 * routes/admin/recordings.js
 * Admin interface for recording publication workflow
 */

const express = require('express');
const router = express.Router();
const recordingController = require('../../controllers/recordingController');
const { requireAnyRole } = require('../../middleware/requireRbac');
const requireAuth = require('../../middleware/requireAuth');
const sessionTimeout = require('../../middleware/sessionTimeout');
const { Roles } = require('../../config/roles-permissions');

// Middleware to check for ADMIN or RABBI roles
const requireAdminAccess = [
    requireAuth,
    sessionTimeout(),
    requireAnyRole([Roles.ADMIN, Roles.RABBI])
];

/**
 * GET /admin/recordings
 * List unpublished recordings for publication workflow
 */
router.get('/', requireAdminAccess, recordingController.getRecordingsList);

/**
 * POST /admin/recordings/drafts
 * Save or update a recording draft (autosave every 30 seconds)
 */
router.post('/drafts', requireAdminAccess, recordingController.saveDraft);

/**
 * POST /admin/recordings/:provider/:recordingId/publish
 * Publish a recording
 */
router.post('/:provider/:recordingId/publish', requireAdminAccess, recordingController.publishRecording);

module.exports = router;
