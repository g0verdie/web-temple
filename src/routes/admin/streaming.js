const express = require('express');
const router = express.Router();
const streamingController = require('../../controllers/streamingController');
const { requirePermission } = require('../../middleware/requireRbac');
const requireAuth = require('../../middleware/requireAuth');
const sessionTimeout = require('../../middleware/sessionTimeout');
const { Permissions } = require('../../config/roles-permissions');

const requireManageStreaming = [
    requireAuth,
    sessionTimeout(),
    requirePermission(Permissions.MANAGE_STREAMING)
];

// List streams dashboard
router.get('/', requireManageStreaming, streamingController.listStreams);

// Create stream schedule form
router.get('/new', requireManageStreaming, streamingController.renderCreateForm);

// Process stream schedule creation
router.post('/', requireManageStreaming, streamingController.createStream);

// Edit stream schedule form
router.get('/:id/edit', requireManageStreaming, streamingController.renderEditForm);

// Process stream schedule update
router.post('/:id', requireManageStreaming, streamingController.updateStream);

// Cancel a scheduled stream
router.post('/:id/cancel', requireManageStreaming, streamingController.cancelStream);

// Start/Activate stream
router.post('/:id/start', requireManageStreaming, streamingController.startStream);

// Stop/Complete stream
router.post('/:id/stop', requireManageStreaming, streamingController.stopStream);

module.exports = router;
