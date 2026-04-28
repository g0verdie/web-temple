/**
 * controllers/recordingController.js
 * Admin interface for recording publication workflow
 */

const RecordingService = require('../services/RecordingService');

/**
 * Get list of unpublished recordings for admin publication
 */
exports.getRecordingsList = async (req, res) => {
    try {
        const recordings = await RecordingService.listPendingRecordings();

        res.render('layout', {
            title: 'Admin - Recordings',
            bodyView: 'admin/recordings/list',
            viewData: {
                recordings
            }
        });
    } catch (error) {
        console.error('Error loading recordings list:', error);
        res.status(500).render('error', { error });
    }
};

/**
 * Save or update a recording draft (autosave)
 */
exports.saveDraft = async (req, res) => {
    try {
        const {
            providerName,
            providerRecordingId,
            providerVideoUrl,
            previewUrl,
            title,
            description,
            serviceDate,
            torahPortion,
            durationSeconds,
            serviceType
        } = req.body;

        // Validate required provider fields
        if (!providerName || !providerRecordingId) {
            return res.status(400).json({
                success: false,
                error: 'providerName and providerRecordingId are required'
            });
        }

        const saved = await RecordingService.saveDraft({
            providerName,
            providerRecordingId,
            providerVideoUrl,
            previewUrl,
            title,
            description,
            serviceDate,
            torahPortion,
            durationSeconds,
            serviceType
        }, req.user.id);

        res.json({
            success: true,
            recording: saved,
            message: 'Draft saved successfully'
        });
    } catch (error) {
        console.error('Error saving draft:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Publish a recording
 */
exports.publishRecording = async (req, res) => {
    try {
        const { provider, recordingId } = req.params;
        const {
            providerVideoUrl,
            previewUrl,
            title,
            description,
            serviceDate,
            torahPortion,
            durationSeconds,
            serviceType
        } = req.body;

        // Validate required fields for publish
        if (!serviceDate || !durationSeconds) {
            return res.status(400).json({
                success: false,
                error: 'Service date and duration are required'
            });
        }

        const published = await RecordingService.publishRecording({
            providerName: provider,
            providerRecordingId: recordingId,
            providerVideoUrl,
            previewUrl,
            title,
            description,
            serviceDate,
            torahPortion,
            durationSeconds,
            serviceType
        }, {
            serviceType
        }, {
            userId: req.user.id,
            ipAddress: req.ip || req.connection?.remoteAddress
        });

        res.json({
            success: true,
            recording: published,
            message: 'Recording published successfully'
        });
    } catch (error) {
        console.error('Error publishing recording:', error);
        const statusCode = error.message.includes('required') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get archive recordings list for members
 */
exports.getArchiveList = async (req, res) => {
    try {
        // Normalize query values to strings to avoid array/object edge cases.
        const queryString = (value) => (typeof value === 'string' ? value : '');

        // Validate and parse page number with safe defaults and bounds.
        if (Array.isArray(req.query.page)) {
            return res.status(400).render('error', {
                title: '400 - Invalid Request',
                message: 'Invalid page number'
            });
        }
        const rawPage = queryString(req.query.page);
        if (rawPage && !/^[1-9]\d{0,3}$/.test(rawPage)) {
            return res.status(400).render('error', { 
                title: '400 - Invalid Request',
                message: 'Invalid page number' 
            });
        }
        let page = rawPage ? parseInt(rawPage, 10) : 1;
        if (isNaN(page) || !Number.isInteger(page) || page < 1 || page > 1000) {
            return res.status(400).render('error', { 
                title: '400 - Invalid Request',
                message: 'Invalid page number' 
            });
        }

        // Validate date inputs are ISO 8601 format and real calendar dates.
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const startDate = queryString(req.query.startDate);
        const endDate = queryString(req.query.endDate);

        const isValidCalendarDate = (value) => {
            if (!dateRegex.test(value)) {
                return false;
            }

            const [year, month, day] = value.split('-').map(Number);
            const dt = new Date(Date.UTC(year, month - 1, day));
            return dt.getUTCFullYear() === year
                && dt.getUTCMonth() === month - 1
                && dt.getUTCDate() === day;
        };

        if (startDate && !isValidCalendarDate(startDate)) {
            return res.status(400).render('error', { 
                title: '400 - Invalid Request',
                message: 'Invalid start date format (use YYYY-MM-DD)' 
            });
        }
        if (endDate && !isValidCalendarDate(endDate)) {
            return res.status(400).render('error', { 
                title: '400 - Invalid Request',
                message: 'Invalid end date format (use YYYY-MM-DD)' 
            });
        }

        // Validate date range: startDate must be <= endDate
        if (startDate && endDate && startDate > endDate) {
            return res.status(400).render('error', { 
                title: '400 - Invalid Request',
                message: 'Start date must be before or equal to end date' 
            });
        }

        const limit = 20;
        const cutoffDate = new Date();
        cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 364);
        const cutoffIso = cutoffDate.toISOString().slice(0, 10);
        const showOlderRecordingsNotice = !startDate || startDate < cutoffIso;

        const filters = {
            search: queryString(req.query.search),
            serviceType: queryString(req.query.serviceType),
            torahPortion: queryString(req.query.torahPortion),
            startDate,
            endDate
        };

        const result = await RecordingService.getArchiveRecordings(filters, page, limit);

        res.render('layout', {
            title: 'Recording Archive',
            bodyView: 'recordings/index',
            stylesheets: ['/css/recordings.css'],
            viewData: {
                recordings: result.recordings,
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                totalCount: result.totalCount,
                filters,
                showOlderRecordingsNotice,
                csrfToken: req.csrfToken ? req.csrfToken() : null
            }
        });
    } catch (error) {
        console.error('Error loading archive:', error);
        res.status(500).render('error', { 
            title: '500 - Server Error',
            message: 'Unable to load archive.' 
        });
    }
};

/**
 * Render the playback page for a single published recording.
 *
 * Story 3.5 AC contract:
 * - Returns 200 only when the recording exists and is in 'published' state.
 * - Returns 404 (not 403) for any non-published or missing id, to avoid
 *   leaking the existence of unpublished drafts via a distinct error code.
 * - Caption metadata (caption_url, caption_format) is forwarded to the view
 *   so it can render either a WebVTT <track> with toggle, or the
 *   "captions are burned in" affordance.
 */
exports.getRecordingDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const recording = await RecordingService.getPublishedRecordingById(id);

        if (!recording) {
            return res.status(404).render('404', { title: '404 - Recording Not Found' });
        }

        res.render('layout', {
            title: recording.title || 'Recording',
            bodyView: 'recordings/show',
            stylesheets: ['/css/recordings.css'],
            viewData: {
                recording,
                csrfToken: req.csrfToken ? req.csrfToken() : null
            }
        });
    } catch (error) {
        console.error('Error loading recording detail:', error);
        res.status(500).render('error', {
            title: '500 - Server Error',
            message: 'Unable to load recording.'
        });
    }
};
