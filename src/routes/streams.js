const express = require('express');
const router = express.Router();
const streamController = require('../controllers/streamController');

// Numeric ids only — a non-numeric path falls through to the 404 handler rather than
// hitting the DB. Linked from the calendar event popup's "View stream" button.
router.get('/:id(\\d+)', streamController.getStreamPage);

module.exports = router;
