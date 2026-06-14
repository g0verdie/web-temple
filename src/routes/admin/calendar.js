const express = require('express');
const router = express.Router();
const calendarController = require('../../controllers/calendarController');
const { requirePermission } = require('../../middleware/requireRbac');
const requireAuth = require('../../middleware/requireAuth');
const sessionTimeout = require('../../middleware/sessionTimeout');
const { Permissions } = require('../../config/roles-permissions');

const requireManageCalendar = [
    requireAuth,
    sessionTimeout(),
    requirePermission(Permissions.MANAGE_CALENDAR)
];

// Archived events + restore (declared before /:id to avoid route capture)
router.get('/archive', requireManageCalendar, calendarController.renderArchive);
router.post('/:id/restore', requireManageCalendar, calendarController.restoreEvent);

// List active events
router.get('/', requireManageCalendar, calendarController.listEvents);

// Create event form + submit
router.get('/new', requireManageCalendar, calendarController.renderCreateForm);
router.post('/', requireManageCalendar, calendarController.createEvent);

// Edit event form + submit
router.get('/:id/edit', requireManageCalendar, calendarController.renderEditForm);
router.post('/:id', requireManageCalendar, calendarController.updateEvent);

// Soft-delete event
router.post('/:id/delete', requireManageCalendar, calendarController.deleteEvent);

module.exports = router;
