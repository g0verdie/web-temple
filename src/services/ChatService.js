/**
 * src/services/ChatService.js
 * Handles business logic, validations, database queries, and auditing for live chat messages.
 */

const db = require('../config/db');
const { log: logAudit, AUDIT_ACTIONS } = require('./auditService');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../errors');

// Role words a guest may not use in a display name. Blocks clergy/staff
// impersonation in live chat (a guest choosing "Rabbi David"). Shared with the
// WS upgrade handler in chatSocketServer.js so the gate covers both paths.
const RESERVED_NAME_WORDS = ['rabbi', 'cantor', 'admin', 'moderator'];

/**
 * Whether a display name (case-insensitively) contains a reserved role word.
 */
const containsReservedName = (displayName) => {
    const lower = String(displayName).toLowerCase();
    return RESERVED_NAME_WORDS.some((word) => lower.includes(word));
};

/**
 * Validates a chat message payload
 */
const validateMessage = (streamId, displayName, messageText) => {
    if (!streamId || isNaN(parseInt(streamId, 10))) {
        throw new ValidationError('Invalid stream ID');
    }
    if (!displayName || typeof displayName !== 'string' || displayName.trim() === '') {
        throw new ValidationError('Display name is required');
    }
    if (displayName.length > 50) {
        throw new ValidationError('Display name must not exceed 50 characters');
    }
    if (containsReservedName(displayName)) {
        throw new ValidationError('That display name is not allowed');
    }
    if (!messageText || typeof messageText !== 'string' || messageText.trim() === '') {
        throw new ValidationError('Message text is required');
    }
    if (messageText.length > 500) {
        throw new ValidationError('Message text must not exceed 500 characters');
    }
};

/**
 * Simple spam heuristic check (Story 7.6):
 * Returns true if message is all-caps (>70% uppercase) or contains suspicious external URLs.
 */
const checkIsSpam = (messageText) => {
    // 1. All-caps check (>70% uppercase)
    const alphabeticalChars = messageText.replace(/[^a-zA-Z]/g, '');
    if (alphabeticalChars.length > 0) {
        const uppercaseChars = alphabeticalChars.replace(/[^A-Z]/g, '');
        if (uppercaseChars.length / alphabeticalChars.length > 0.7) {
            return true;
        }
    }

    // 2. Suspicious URLs check
    // Matches http://, https://, ftp://, www., or standard domains with common extensions
    const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.(com|net|org|xyz|gov|edu|info|io|biz|me|live|tv|cc|ws|online)\b/i;
    if (urlRegex.test(messageText)) {
        return true;
    }

    return false;
};

/**
 * Whether a guest display name has ever had an approved message (across all
 * streams). Guests have user_id NULL, so display_name is the only persistent
 * identifier: once a name's first message is approved, later messages from that
 * name auto-approve.
 */
const guestDisplayNameHasApprovedMessage = async (cleanDisplayName) => {
    const result = await db.query(
        "SELECT 1 FROM chat_messages WHERE user_id IS NULL AND display_name = $1 AND status = 'approved' LIMIT 1",
        [cleanDisplayName]
    );
    return result.rows.length > 0;
};

/**
 * Create a new chat message in the database
 */
const createMessage = async ({ streamId, userId, displayName, messageText }) => {
    const cleanStreamId = parseInt(streamId, 10);
    const cleanDisplayName = displayName.trim();
    const cleanMessageText = messageText.trim();

    validateMessage(cleanStreamId, cleanDisplayName, cleanMessageText);

    // Moderation policy:
    //   spam                                   -> deleted
    //   registered member (userId set)         -> approved
    //   guest whose display_name was approved  -> approved
    //   otherwise (new guest)                  -> pending
    const isSpam = checkIsSpam(cleanMessageText);
    let status;
    if (isSpam) {
        status = 'deleted';
    } else if (userId) {
        status = 'approved';
    } else if (await guestDisplayNameHasApprovedMessage(cleanDisplayName)) {
        status = 'approved';
    } else {
        status = 'pending';
    }

    const query = `
        INSERT INTO chat_messages (
            stream_id,
            user_id,
            display_name,
            message_text,
            status
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    const values = [cleanStreamId, userId || null, cleanDisplayName, cleanMessageText, status];

    const result = await db.query(query, values);
    const message = result.rows[0];

    // Audit auto-filter so moderators can review the heuristic's calls.
    // user_id is the poster (or null for a guest); this is a system action,
    // not a moderation action, so the description carries the reason.
    if (isSpam) {
        try {
            await logAudit({
                user_id: userId || null,
                action: AUDIT_ACTIONS.CHAT_MESSAGE_AUTO_FILTERED,
                entity_type: 'chat_message',
                entity_id: String(message.id),
                description: `Auto-filtered as spam from ${cleanDisplayName}: "${cleanMessageText.substring(0, 30)}..."`
            });
        } catch (e) {
            logger.error(`Audit write for auto-filter failed: ${e.message}`);
        }
    }

    return message;
};

/**
 * Approve a chat message
 */
const approveMessage = async (id, moderatorUserId, ip) => {
    if (!id || isNaN(parseInt(id, 10))) {
        throw new ValidationError('Invalid message ID');
    }

    const query = `
        UPDATE chat_messages
        SET status = 'approved', updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `;
    const result = await db.query(query, [parseInt(id, 10)]);

    if (result.rows.length === 0) {
        throw new NotFoundError('Message not found');
    }

    const message = result.rows[0];

    // Audit log
    await logAudit({
        user_id: moderatorUserId,
        action: AUDIT_ACTIONS.CHAT_MESSAGE_APPROVED,
        entity_type: 'chat_message',
        entity_id: id.toString(),
        ip_address: ip,
        description: `Approved chat message from ${message.display_name}: "${message.message_text.substring(0, 30)}..."`
    });

    return message;
};

/**
 * Delete (or soft delete) a chat message
 */
const deleteMessage = async (id, moderatorUserId, ip) => {
    if (!id || isNaN(parseInt(id, 10))) {
        throw new ValidationError('Invalid message ID');
    }

    const query = `
        UPDATE chat_messages
        SET status = 'deleted', updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `;
    const result = await db.query(query, [parseInt(id, 10)]);

    if (result.rows.length === 0) {
        throw new NotFoundError('Message not found');
    }

    const message = result.rows[0];

    // Audit log
    await logAudit({
        user_id: moderatorUserId,
        action: AUDIT_ACTIONS.CHAT_MESSAGE_DELETED,
        entity_type: 'chat_message',
        entity_id: id.toString(),
        ip_address: ip,
        description: `Deleted chat message from ${message.display_name}: "${message.message_text.substring(0, 30)}..."`
    });

    return message;
};

/**
 * Get all approved messages for a stream sorted chronologically
 */
const getApprovedMessagesForStream = async (streamId) => {
    if (!streamId || isNaN(parseInt(streamId, 10))) {
        throw new ValidationError('Invalid stream ID');
    }

    const query = `
        SELECT id, stream_id, user_id, display_name, message_text, status, created_at
        FROM chat_messages
        WHERE stream_id = $1 AND status = 'approved'
        ORDER BY created_at ASC
    `;
    const result = await db.query(query, [parseInt(streamId, 10)]);
    return result.rows;
};

/**
 * Get all pending messages for moderation
 */
const getPendingMessages = async () => {
    const query = `
        SELECT id, stream_id, user_id, display_name, message_text, status, created_at
        FROM chat_messages
        WHERE status = 'pending'
        ORDER BY created_at ASC
    `;
    const result = await db.query(query);
    return result.rows;
};

/**
 * Find matching scheduled_streams record within 6 hours of serviceDate and return its approved messages
 */
const getMessagesForRecording = async (serviceDate) => {
    if (!serviceDate) {
        return [];
    }

    try {
        // Query to find closest stream within 6 hours of the recording's service date.
        // Cast to timestamptz on both sides: scheduled_start is TIMESTAMPTZ; if we cast
        // to plain timestamp the comparison silently reapplies session TZ and the 6h
        // window drifts by (session_tz - UTC). See review finding #3.
        const streamQuery = `
            SELECT id
            FROM scheduled_streams
            WHERE scheduled_start >= $1::timestamptz - INTERVAL '6 hours'
              AND scheduled_start <= $1::timestamptz + INTERVAL '6 hours'
            ORDER BY ABS(EXTRACT(EPOCH FROM (scheduled_start - $1::timestamptz))) ASC
            LIMIT 1
        `;
        const dateObj = new Date(serviceDate);
        if (isNaN(dateObj.getTime())) {
            return [];
        }

        const streamResult = await db.query(streamQuery, [dateObj]);
        if (streamResult.rows.length === 0) {
            return [];
        }

        const streamId = streamResult.rows[0].id;
        return await getApprovedMessagesForStream(streamId);
    } catch (err) {
        logger.error(`Error in getMessagesForRecording: ${err.message}`);
        return [];
    }
};

/**
 * Count of pending (awaiting-moderation) chat messages — cheap COUNT for the
 * dashboard moderation badge (avoids loading every pending row just to size it).
 */
const getPendingMessageCount = async () => {
    const result = await db.query("SELECT COUNT(*)::int AS count FROM chat_messages WHERE status = 'pending'");
    return result.rows[0] ? result.rows[0].count : 0;
};

module.exports = {
    createMessage,
    approveMessage,
    deleteMessage,
    getApprovedMessagesForStream,
    getPendingMessages,
    getPendingMessageCount,
    getMessagesForRecording,
    containsReservedName
};
