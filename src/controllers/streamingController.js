const StreamingService = require('../services/StreamingService');
const EventService = require('../services/EventService');
const logger = require('../utils/logger');

// Sanitize flash messages from query params to prevent social engineering
const ALLOWED_FLASH_MAX_LENGTH = 200;
const sanitizeFlashMessage = (msg) => {
    if (!msg || typeof msg !== 'string') return null;
    // Strip any HTML tags and truncate
    return msg.replace(/<[^>]*>/g, '').slice(0, ALLOWED_FLASH_MAX_LENGTH) || null;
};

exports.listStreams = async (req, res) => {
    try {
        const streams = await StreamingService.getScheduledStreams();
        res.render('layout', {
            title: 'Manage Livestreams',
            bodyView: 'admin/streaming/index',
            stylesheets: ['/css/streaming.css'],
            viewData: {
                streams,
                success: sanitizeFlashMessage(req.query.success),
                error: sanitizeFlashMessage(req.query.error)
            }
        });
    } catch (error) {
        logger.error('Error listing streams:', error);
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load livestreams.' });
    }
};

exports.renderCreateForm = async (req, res) => {
    try {
        const events = await EventService.getEvents();
        res.render('layout', {
            title: 'Schedule Livestream',
            bodyView: 'admin/streaming/new',
            stylesheets: ['/css/streaming.css'],
            viewData: {
                events,
                errors: null,
                data: {}
            }
        });
    } catch (error) {
        logger.error('Error rendering create form:', error);
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load the schedule form.' });
    }
};

exports.createStream = async (req, res) => {
    try {
        const { title, scheduled_start, facebook_live_url, event_id } = req.body;
        const userId = req.user ? req.user.id : null;
        const ipAddress = req.ip;

        try {
            await StreamingService.createScheduledStream({
                title,
                scheduled_start,
                facebook_live_url,
                event_id
            }, userId, ipAddress);

            res.redirect('/admin/streaming?success=Stream+scheduled+successfully');
        } catch (validationError) {
            const events = await EventService.getEvents();
            res.render('layout', {
                title: 'Schedule Livestream',
                bodyView: 'admin/streaming/new',
                stylesheets: ['/css/streaming.css'],
                viewData: {
                    events,
                    errors: { general: validationError.message },
                    data: req.body
                }
            });
        }
    } catch (error) {
        logger.error('Error creating stream:', error);
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to schedule the livestream.' });
    }
};

exports.renderEditForm = async (req, res) => {
    try {
        const { id } = req.params;
        const stream = await StreamingService.getScheduledStreamById(id);
        if (!stream) {
            return res.status(404).render('404', { title: '404 - Stream Not Found' });
        }

        const events = await EventService.getEvents();
        res.render('layout', {
            title: 'Edit Livestream Schedule',
            bodyView: 'admin/streaming/edit',
            stylesheets: ['/css/streaming.css'],
            viewData: {
                stream,
                events,
                errors: null,
                data: stream
            }
        });
    } catch (error) {
        logger.error('Error rendering edit form:', error);
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load the edit form.' });
    }
};

exports.updateStream = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, scheduled_start, facebook_live_url, event_id } = req.body;
        const userId = req.user ? req.user.id : null;
        const ipAddress = req.ip;

        try {
            await StreamingService.updateScheduledStream(id, {
                title,
                scheduled_start,
                facebook_live_url,
                event_id
            }, userId, ipAddress);

            res.redirect('/admin/streaming?success=Stream+updated+successfully');
        } catch (validationError) {
            if (validationError.message === 'Stream not found') {
                return res.status(404).render('404', { title: '404 - Stream Not Found' });
            }
            const stream = await StreamingService.getScheduledStreamById(id);
            const events = await EventService.getEvents();
            res.render('layout', {
                title: 'Edit Livestream Schedule',
                bodyView: 'admin/streaming/edit',
                stylesheets: ['/css/streaming.css'],
                viewData: {
                    stream,
                    events,
                    errors: { general: validationError.message },
                    data: { ...req.body, id }
                }
            });
        }
    } catch (error) {
        logger.error('Error updating stream:', error);
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to update the livestream.' });
    }
};

exports.cancelStream = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user ? req.user.id : null;
        const ipAddress = req.ip;

        await StreamingService.cancelScheduledStream(id, userId, ipAddress);
        res.redirect('/admin/streaming?success=Stream+cancelled+successfully');
    } catch (error) {
        logger.error('Error cancelling stream:', error);
        const userMessage = error.message.startsWith('Cannot') || error.message.startsWith('Stream not found')
            ? error.message
            : 'An unexpected error occurred. Please try again.';
        res.redirect(`/admin/streaming?error=${encodeURIComponent(userMessage)}`);
    }
};

exports.startStream = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user ? req.user.id : null;
        const ipAddress = req.ip;

        await StreamingService.activateScheduledStream(id, userId, ipAddress);
        res.redirect('/admin/streaming?success=Stream+activated+successfully');
    } catch (error) {
        logger.error('Error starting stream:', error);
        const userMessage = error.message.startsWith('Cannot') || error.message.startsWith('Stream not found')
            ? error.message
            : 'An unexpected error occurred. Please try again.';
        res.redirect(`/admin/streaming?error=${encodeURIComponent(userMessage)}`);
    }
};

exports.stopStream = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user ? req.user.id : null;
        const ipAddress = req.ip;

        await StreamingService.completeScheduledStream(id, userId, ipAddress);
        res.redirect('/admin/streaming?success=Stream+completed+successfully');
    } catch (error) {
        logger.error('Error stopping stream:', error);
        const userMessage = error.message.startsWith('Cannot') || error.message.startsWith('Stream not found')
            ? error.message
            : 'An unexpected error occurred. Please try again.';
        res.redirect(`/admin/streaming?error=${encodeURIComponent(userMessage)}`);
    }
};
