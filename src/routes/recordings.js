const express = require('express');
const router = express.Router();
const recordingController = require('../controllers/recordingController');
const requireAuth = require('../middleware/requireAuth');

// All archive routes require authentication
router.use(requireAuth);

// GET /archive
router.get('/', recordingController.getArchiveList);

// GET /archive/:id - playback detail page (Story 3.5)
router.get('/:id', recordingController.getRecordingDetail);

module.exports = router;
