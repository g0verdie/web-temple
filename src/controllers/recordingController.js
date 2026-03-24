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
            durationSeconds
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
            durationSeconds
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
            durationSeconds
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
            durationSeconds
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
