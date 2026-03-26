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
        durationSeconds,
        serviceType
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
            service_type,
            publish_state,
            created_at,
            updated_at,
            updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'unpublished', NOW(), NOW(), $12)
        ON CONFLICT (provider_name, provider_recording_id) DO UPDATE SET
            title = COALESCE(EXCLUDED.title, recordings.title),
            description = COALESCE(EXCLUDED.description, recordings.description),
            service_date = COALESCE(EXCLUDED.service_date, recordings.service_date),
            torah_portion = COALESCE(EXCLUDED.torah_portion, recordings.torah_portion),
            duration_seconds = COALESCE(EXCLUDED.duration_seconds, recordings.duration_seconds),
            service_type = COALESCE(EXCLUDED.service_type, recordings.service_type),
            preview_url = COALESCE(EXCLUDED.preview_url, recordings.preview_url),
            provider_video_url = COALESCE(EXCLUDED.provider_video_url, recordings.provider_video_url),
            updated_at = NOW(),
            updated_by = EXCLUDED.updated_by
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
            durationSeconds,
            serviceType,
            userId
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
            serviceType: saved.service_type,
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
        durationSeconds,
        serviceType
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
                service_type,
                publish_state,
                published_at,
                created_at,
                updated_at,
                updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'published', $12, NOW(), NOW(), $13)
            ON CONFLICT (provider_name, provider_recording_id) DO UPDATE SET
                publish_state = 'published',
                published_at = EXCLUDED.published_at,
                title = COALESCE(EXCLUDED.title, recordings.title),
                description = COALESCE(EXCLUDED.description, recordings.description),
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
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
                serviceType,
                publishedAt,
                userId
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

        await client.query('COMMIT');

        // 4. Queue notification emails for members with preference enabled (OUTSIDE TRANSACTION)
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
            }).catch(e => console.error('Failed to queue email for recording:', e));
        }

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
            serviceType,
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

/**
 * Fetch member archive recordings with filtering and pagination
 * @param {Object} filters 
 * @param {number} page 
 * @param {number} limit 
 * @returns {Promise<Object>} paginated recordings
 */
const getArchiveRecordings = async (filters, page = 1, limit = 20) => {
    const { search, serviceType, torahPortion, startDate, endDate } = filters;
    const offset = (page - 1) * limit;
    
    let whereClauses = ["publish_state = 'published'"];
    let values = [];
    let paramIndex = 1;

    if (search && search.trim()) {
        whereClauses.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
        values.push(`%${search.trim()}%`);
        paramIndex++;
    }

    if (serviceType) {
        whereClauses.push(`service_type = $${paramIndex}`);
        values.push(serviceType);
        paramIndex++;
    }

    if (torahPortion) {
        whereClauses.push(`torah_portion ILIKE $${paramIndex}`);
        values.push(`%${torahPortion}%`);
        paramIndex++;
    }

    if (startDate) {
        whereClauses.push(`service_date >= $${paramIndex}`);
        values.push(startDate);
        paramIndex++;
    } else {
        // Default to latest 52 weeks if no start date is explicitly requested
        whereClauses.push(`service_date >= NOW() - INTERVAL '52 weeks'`);
    }

    if (endDate) {
        whereClauses.push(`service_date <= $${paramIndex}`);
        // Shift end of day to include entire day
        values.push(`${endDate} 23:59:59.999`);
        paramIndex++;
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `
        SELECT COUNT(*)
        FROM recordings
        ${whereString}
    `;

    const dataQuery = `
        SELECT r.*, u.first_name, u.last_name
        FROM recordings r
        LEFT JOIN users u ON r.updated_by = u.id
        ${whereString}
        ORDER BY r.service_date DESC, r.published_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataValues = [...values, limit, offset];

    const client = await db.pool.connect();
    try {
        const countResult = await client.query(countQuery, values);
        // Guard against null/empty/non-numeric COUNT edge cases.
        const rawCount = countResult && countResult.rows && countResult.rows[0]
            ? parseInt(countResult.rows[0].count, 10)
            : 0;
        const totalCount = Number.isFinite(rawCount) && rawCount >= 0 ? rawCount : 0;
        
        const dataResult = await client.query(dataQuery, dataValues);
        
        return {
            recordings: dataResult.rows,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page
        };
    } catch (error) {
        console.error('Error fetching archive recordings:', error);
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    listPendingRecordings,
    saveDraft,
    publishRecording,
    getArchiveRecordings
};
