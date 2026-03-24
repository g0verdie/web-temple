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
        const page = parseInt(req.query.page) || 1;
        const limit = 20;

        const filters = {
            search: req.query.search || '',
            serviceType: req.query.serviceType || '',
            torahPortion: req.query.torahPortion || '',
            startDate: req.query.startDate || '',
            endDate: req.query.endDate || ''
        };

        const result = await RecordingService.getArchiveRecordings(filters, page, limit);

        res.render('layout', {
            title: 'Recording Archive',
            bodyView: 'recordings/index',
            viewData: {
                recordings: result.recordings,
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                totalCount: result.totalCount,
                filters,
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
