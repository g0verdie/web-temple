const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');

// Public calendar page. requireAuth is intentionally NOT applied: req.user is
// populated globally by the server JWT decode, so the controller decides
// includeMembersOnly = !!req.user per-request without forcing login.
router.get('/', calendarController.getCalendarPage);

module.exports = router;
