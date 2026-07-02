/**
 * controllers/announcementController.js
 * Admin authoring surface for announcements (Stories 5.1, 5.3, 5.4, 5.7).
 * Permission-gated by the route (POST_ANNOUNCEMENTS). State-changing endpoints
 * respond with a JSON envelope (matches recordingController); list/form GETs render.
 */

const AnnouncementService = require('../services/AnnouncementService');
const logger = require('../utils/logger');
const { mapError } = require('../errors');

const TITLE_MAX = 200;
const BODY_MAX = 50000;

const actorContext = (req) => ({
    userId: req.user.id,
    ipAddress: req.ip || req.connection?.remoteAddress
});

/**
 * GET /admin/announcements — list (published + archive).
 */
exports.list = async (req, res) => {
    try {
        const announcements = await AnnouncementService.listForAdmin({ includeDeleted: true });
        const active = announcements.filter((a) => a.status !== 'deleted');
        const archived = announcements.filter((a) => a.status === 'deleted');

        res.render('layout', {
            title: 'Admin - Announcements',
            bodyView: 'admin/announcements/list',
            stylesheets: ['/css/announcements.css'],
            viewData: {
                active,
                archived,
                csrfToken: req.csrfToken ? req.csrfToken() : null
            }
        });
    } catch (error) {
        logger.error('Error loading announcements list', { error: error.message });
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load announcements.' });
    }
};

/**
 * GET /admin/announcements/new — blank authoring form.
 */
exports.newForm = (req, res) => {
    res.render('layout', {
        title: 'New Announcement',
        bodyView: 'admin/announcements/form',
        stylesheets: ['/css/announcements.css'],
        viewData: {
            announcement: null,
            csrfToken: req.csrfToken ? req.csrfToken() : null
        }
    });
};

/**
 * GET /admin/announcements/:id/edit — edit form for an existing published row.
 */
exports.editForm = async (req, res) => {
    try {
        const announcement = await AnnouncementService.getByIdForAdmin(req.params.id);
        if (!announcement) {
            return res.status(404).render('404', { title: '404 - Announcement Not Found' });
        }
        res.render('layout', {
            title: 'Edit Announcement',
            bodyView: 'admin/announcements/form',
            stylesheets: ['/css/announcements.css'],
            viewData: {
                announcement,
                csrfToken: req.csrfToken ? req.csrfToken() : null
            }
        });
    } catch (error) {
        logger.error('Error loading announcement edit form', { error: error.message });
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load announcement.' });
    }
};

const validateContent = ({ title, body }) => {
    if (!title || !String(title).trim()) {
        return 'Title is required';
    }
    if (String(title).length > TITLE_MAX) {
        return `Title must be ${TITLE_MAX} characters or fewer`;
    }
    if (body && String(body).length > BODY_MAX) {
        return 'Body is too long';
    }
    return null;
};

/**
 * POST /admin/announcements — create + publish.
 */
exports.create = async (req, res) => {
    try {
        const { title, body, featured, featuredDurationDays } = req.body;
        const validationError = validateContent({ title, body });
        if (validationError) {
            return res.status(400).json({ success: false, error: validationError });
        }

        const announcement = await AnnouncementService.create(
            {
                title,
                body,
                featured: featured === true || featured === 'true' || featured === 'on',
                featuredDurationDays: featuredDurationDays ? parseInt(featuredDurationDays, 10) : undefined
            },
            actorContext(req)
        );

        res.status(201).json({ success: true, announcement });
    } catch (error) {
        logger.error('Error creating announcement', { error: error.message });
        const { statusCode, clientMessage } = mapError(error);
        res.status(statusCode).json({ success: false, error: clientMessage });
    }
};

/**
 * POST /admin/announcements/:id — edit. Does not re-notify (Story 5.3).
 */
exports.update = async (req, res) => {
    try {
        const { title, body } = req.body;
        const validationError = validateContent({ title, body });
        if (validationError) {
            return res.status(400).json({ success: false, error: validationError });
        }

        const announcement = await AnnouncementService.update(req.params.id, { title, body }, actorContext(req));
        res.json({ success: true, announcement });
    } catch (error) {
        logger.error('Error updating announcement', { error: error.message });
        const { statusCode, clientMessage } = mapError(error);
        res.status(statusCode).json({ success: false, error: clientMessage });
    }
};

/**
 * POST /admin/announcements/:id/delete — soft delete (archive).
 */
exports.remove = async (req, res) => {
    try {
        await AnnouncementService.softDelete(req.params.id, actorContext(req));
        res.json({ success: true });
    } catch (error) {
        logger.error('Error deleting announcement', { error: error.message });
        const { statusCode, clientMessage } = mapError(error);
        res.status(statusCode).json({ success: false, error: clientMessage });
    }
};

/**
 * POST /admin/announcements/:id/restore — restore from archive.
 */
exports.restore = async (req, res) => {
    try {
        const announcement = await AnnouncementService.restore(req.params.id, actorContext(req));
        res.json({ success: true, announcement });
    } catch (error) {
        logger.error('Error restoring announcement', { error: error.message });
        const { statusCode, clientMessage } = mapError(error);
        res.status(statusCode).json({ success: false, error: clientMessage });
    }
};

/**
 * POST /admin/announcements/:id/feature — feature/unfeature (one-at-a-time).
 */
exports.feature = async (req, res) => {
    try {
        const { featured, durationDays } = req.body;
        const announcement = await AnnouncementService.setFeatured(
            req.params.id,
            {
                featured: featured === true || featured === 'true' || featured === 'on',
                durationDays: durationDays ? parseInt(durationDays, 10) : undefined
            },
            actorContext(req)
        );
        res.json({ success: true, announcement });
    } catch (error) {
        logger.error('Error featuring announcement', { error: error.message });
        const { statusCode, clientMessage } = mapError(error);
        res.status(statusCode).json({ success: false, error: clientMessage });
    }
};
