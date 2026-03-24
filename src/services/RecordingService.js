/**
 * services/RecordingService.js
 * Handles recording publication workflow, metadata persistence, and member notification
 */

const db = require('../config/db');
const CacheService = require('./CacheService');
const { enqueueEmail } = require('./emailQueueService');
const { renderTemplate } = require('./emailTemplateService');
const { logAudit, AUDIT_ACTIONS } = require('./auditService');
const { v4: uuidv4 } = require('uuid');

/**
 * List unpublished recordings ready for publish workflow
 * @returns {Promise<Array>} Unpublished recordings with metadata
 */
const listPendingRecordings = async () => {
    const query = `
        SELECT 
            id,
            provider_name as "providerName",
            provider_recording_id as "providerRecordingId",
            provider_video_url as "providerVideoUrl",
            preview_url as "previewUrl",
            title,
            description,
            service_date as "serviceDate",
            torah_portion as "torahPortion",
            duration_seconds as "durationSeconds",
            publish_state as "publishState",
            published_at as "publishedAt",
            created_at as "createdAt",
            updated_at as "updatedAt"
        FROM recordings
        WHERE publish_state = 'unpublished'
        ORDER BY updated_at DESC
    `;

    try {
        const result = await db.query(query, []);
        return result.rows;
    } catch (error) {
        console.error('Error listing pending recordings:', error);
        throw error;
    }
};

/**
 * Save or update an unpublished recording draft
 * @param {Object} recording - Recording metadata
 * @param {string} userId - ID of user making the edit
 * @returns {Promise<Object>} Saved recording with timestamps
 */
const saveDraft = async (recording, userId) => {
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
    } = recording;

    if (!providerName || !providerRecordingId) {
        throw new Error('Provider name and recording ID are required');
    }

    const query = `
        INSERT INTO recordings (
            id,
            provider_name,
            provider_recording_id,
            provider_video_url,
            preview_url,
            title,
            description,
            service_date,
            torah_portion,
            duration_seconds,
            publish_state,
            created_at,
            updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'unpublished', NOW(), NOW())
        ON CONFLICT (provider_name, provider_recording_id) DO UPDATE SET
            title = COALESCE(EXCLUDED.title, recordings.title),
            description = COALESCE(EXCLUDED.description, recordings.description),
            service_date = COALESCE(EXCLUDED.service_date, recordings.service_date),
            torah_portion = COALESCE(EXCLUDED.torah_portion, recordings.torah_portion),
            duration_seconds = COALESCE(EXCLUDED.duration_seconds, recordings.duration_seconds),
            preview_url = COALESCE(EXCLUDED.preview_url, recordings.preview_url),
            provider_video_url = COALESCE(EXCLUDED.provider_video_url, recordings.provider_video_url),
            updated_at = NOW()
        RETURNING *
    `;

    try {
        const recordingId = uuidv4();
        const result = await db.query(query, [
            recordingId,
            providerName,
            providerRecordingId,
            providerVideoUrl,
            previewUrl,
            title,
            description,
            serviceDate,
            torahPortion,
            durationSeconds
        ]);

        const saved = result.rows[0];
        return {
            id: saved.id,
            providerName: saved.provider_name,
            providerRecordingId: saved.provider_recording_id,
            providerVideoUrl: saved.provider_video_url,
            previewUrl: saved.preview_url,
            title: saved.title,
            description: saved.description,
            serviceDate: saved.service_date,
            torahPortion: saved.torah_portion,
            durationSeconds: saved.duration_seconds,
            publishState: saved.publish_state,
            createdAt: saved.created_at,
            updatedAt: saved.updated_at
        };
    } catch (error) {
        console.error('Error saving recording draft:', error);
        throw error;
    }
};

/**
 * Publish a recording: persist, audit, invalidate cache, and queue notifications
 * @param {Object} recording - Recording metadata with title, date, provider refs
 * @param {Object} context - User context { userId, ipAddress }
 * @returns {Promise<Object>} Published recording with visibility timestamp
 */
const publishRecording = async (recording, context) => {
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
    } = recording;

    const { userId, ipAddress } = context;

    // Validation gate: service date and duration are required for publish
    if (!serviceDate || !durationSeconds) {
        throw new Error('Service date and duration are required');
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Upsert recording with published state
        const recordingId = uuidv4();
        const publishedAt = new Date();

        const upsertResult = await client.query(
            `
            INSERT INTO recordings (
                id,
                provider_name,
                provider_recording_id,
                provider_video_url,
                preview_url,
                title,
                description,
                service_date,
                torah_portion,
                duration_seconds,
                publish_state,
                published_at,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'published', $11, NOW(), NOW())
            ON CONFLICT (provider_name, provider_recording_id) DO UPDATE SET
                publish_state = 'published',
                published_at = EXCLUDED.published_at,
                title = COALESCE(EXCLUDED.title, recordings.title),
                description = COALESCE(EXCLUDED.description, recordings.description),
                updated_at = NOW()
            RETURNING id, provider_recording_id, title
            `,
            [
                recordingId,
                providerName,
                providerRecordingId,
                providerVideoUrl,
                previewUrl,
                title,
                description,
                serviceDate,
                torahPortion,
                durationSeconds,
                publishedAt
            ]
        );

        const publishedId = upsertResult.rows[0].id;

        // 2. Fetch all members with recordings notification preference enabled
        const membersResult = await client.query(
            `
            SELECT id, email, first_name
            FROM users
            WHERE (notification_preferences->>'recordings')::boolean = true
            `
        );

        const members = membersResult.rows;

        // 3. Audit log for publication
        await logAudit({
            user_id: userId,
            action: AUDIT_ACTIONS.RECORDING_PUBLISHED || 'RECORDING_PUBLISHED',
            entity_type: 'recording',
            entity_id: publishedId,
            description: `Published recording: ${title}`,
            ip_address: ipAddress
        });

        // 4. Queue notification emails for members with preference enabled
        for (const member of members) {
            const emailContent = renderTemplate('new-recording-available', {
                memberName: member.first_name || 'Member',
                title,
                serviceDate,
                torahPortion,
                archiveUrl: process.env.APP_URL ? `${process.env.APP_URL}/archive` : 'https://temple.example.com/archive'
            });

            await enqueueEmail({
                to: member.email,
                subject: emailContent.subject,
                html: emailContent.html,
                text: emailContent.text,
                priority: 2
            });
        }

        await client.query('COMMIT');

        // 5. Invalidate archive cache after successful publish
        await CacheService.invalidatePattern('recording:*');

        return {
            id: publishedId,
            providerName,
            providerRecordingId,
            title,
            serviceDate,
            torahPortion,
            durationSeconds,
            publishState: 'published',
            publishedAt
        };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error publishing recording:', error);
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    listPendingRecordings,
    saveDraft,
    publishRecording
};
