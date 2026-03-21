/**
 * services/auditService.js
 * Handles audit logging for security events and sensitive operations
 */

const db = require('../config/db');

/**
 * Common audit event types
 */
const AUDIT_ACTIONS = {
    // Authentication
    USER_REGISTERED: 'USER_REGISTERED',
    USER_REGISTRATION_FAILED: 'USER_REGISTRATION_FAILED',
    USER_LOGIN: 'USER_LOGIN',
    USER_LOGOUT: 'USER_LOGOUT',
    PASSWORD_CHANGED: 'PASSWORD_CHANGED',
    PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',

    // Announcements
    ANNOUNCEMENT_CREATED: 'ANNOUNCEMENT_CREATED',
    ANNOUNCEMENT_UPDATED: 'ANNOUNCEMENT_UPDATED',
    ANNOUNCEMENT_DELETED: 'ANNOUNCEMENT_DELETED',
    ANNOUNCEMENT_FEATURED: 'ANNOUNCEMENT_FEATURED',

    // Calendar
    CALENDAR_EVENT_CREATED: 'CALENDAR_EVENT_CREATED',
    CALENDAR_EVENT_UPDATED: 'CALENDAR_EVENT_UPDATED',
    CALENDAR_EVENT_DELETED: 'CALENDAR_EVENT_DELETED',

    // Donations
    DONATION_RECEIVED: 'DONATION_RECEIVED',
    DONATION_FAILED: 'DONATION_FAILED',
    DONATION_REFUNDED: 'DONATION_REFUNDED',
    TAX_RECEIPT_SENT: 'TAX_RECEIPT_SENT',

    // Messaging
    MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
    MESSAGE_REPLIED: 'MESSAGE_REPLIED',
    MESSAGE_DELETED: 'MESSAGE_DELETED',

    // Account settings
    PROFILE_UPDATED: 'PROFILE_UPDATED',
    PREFERENCES_UPDATED: 'PREFERENCES_UPDATED',
    EMAIL_CHANGE_REQUESTED: 'EMAIL_CHANGE_REQUESTED',
    EMAIL_CHANGE_CONFIRMED: 'EMAIL_CHANGE_CONFIRMED',

    // Admin
    ADMIN_LOGIN: 'ADMIN_LOGIN',
    ADMIN_LOGOUT: 'ADMIN_LOGOUT',
    USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
    ADMIN_SETTING_CHANGED: 'ADMIN_SETTING_CHANGED',
};

/**
 * Log an audit event
 * @param {Object} options - Audit event details
 * @param {string} options.user_id - UUID of user performing action
 * @param {string} options.action - Action type (e.g., 'ANNOUNCEMENT_CREATED')
 * @param {string} [options.entity_type] - Type of entity (e.g., 'announcement')
 * @param {string} [options.entity_id] - ID of entity being modified
 * @param {Object} [options.before_state] - Previous state (optional, for updates)
 * @param {Object} [options.after_state] - New state (optional)
 * @param {string} [options.description] - Human-readable description
 * @param {string} [options.ip_address] - IP address of requester
 * @returns {Promise<void>}
 */
const log = async (options) => {
    // We normalize input to match our agreed schema but keep support for legacy usage if any
    const {
        user_id, userId, // Support both snake and camel (prefer snake to match DB or camel to match JS?)
        // internal convention seems mixed but DB is snake_case. Params usually camelCase in JS.
        // But the previous auditHelper used snake_case params. I'll support snake_case primarily to match previous helper.
        action,
        entity_type, entityType,
        entity_id, entityId,
        before_state, beforeState,
        after_state, afterState,
        description,
        ip_address, ipAddress,
    } = options;

    const finalUserId = user_id || userId || null;
    const finalEntityType = entity_type || entityType || null;
    const finalEntityId = entity_id || entityId || null;
    const finalBeforeState = before_state || beforeState || null;
    const finalAfterState = after_state || afterState || null;
    const finalIpAddress = ip_address || ipAddress || null;

    if (!action) {
        console.error('Audit log missing action');
        return;
    }

    try {
        const query = `
            INSERT INTO audit_logs (
                user_id,
                action,
                entity_type,
                entity_id,
                before_state,
                after_state,
                description,
                ip_address,
                timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `;

        const values = [
            finalUserId,
            action,
            finalEntityType,
            finalEntityId,
            finalBeforeState ? JSON.stringify(finalBeforeState) : null,
            finalAfterState ? JSON.stringify(finalAfterState) : null,
            description || null,
            finalIpAddress,
        ];

        // Fire and forget (don't await if we want non-blocking)
        // OR await but catch error.
        // For reliability, we await but catch.
        await db.query(query, values);
    } catch (error) {
        console.error('FAILED TO WRITE AUDIT LOG:', error.message);
        // We do NOT throw here to avoid blocking user actions
    }
};

/**
 * Query audit logs
 * @param {Object} filters - Query filters
 * @param {string} [filters.action] - Filter by action type
 * @param {string} [filters.user_id] - Filter by user
 * @param {string} [filters.entity_type] - Filter by entity type
 * @param {Date} [filters.startDate] - Filter by start timestamp
 * @param {Date} [filters.endDate] - Filter by end timestamp
 * @param {number} [filters.limit] - Limit results (default: 100, max: 1000)
 * @param {number} [filters.offset] - Offset for pagination
 * @returns {Promise<{logs: Array, total: number}>} Audit log entries and total count
 */
const queryLogs = async (filters = {}) => {
    try {
        const normalizedFilters = {
            action: filters.action,
            user_id: filters.user_id || filters.userId,
            entity_type: filters.entity_type || filters.entityType,
            startDate: filters.startDate,
            endDate: filters.endDate,
        };

        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) FROM audit_logs WHERE 1=1';
        const values = [];
        let paramCount = 1;

        if (normalizedFilters.action) {
            query += ` AND action = $${paramCount}`;
            countQuery += ` AND action = $${paramCount}`;
            values.push(normalizedFilters.action);
            paramCount++;
        }

        if (normalizedFilters.user_id) {
            query += ` AND user_id = $${paramCount}`;
            countQuery += ` AND user_id = $${paramCount}`;
            values.push(normalizedFilters.user_id);
            paramCount++;
        }

        if (normalizedFilters.entity_type) {
            query += ` AND entity_type = $${paramCount}`;
            countQuery += ` AND entity_type = $${paramCount}`;
            values.push(normalizedFilters.entity_type);
            paramCount++;
        }

        if (normalizedFilters.startDate) {
            query += ` AND timestamp >= $${paramCount}`;
            countQuery += ` AND timestamp >= $${paramCount}`;
            values.push(new Date(normalizedFilters.startDate));
            paramCount++;
        }

        if (normalizedFilters.endDate) {
            query += ` AND timestamp <= $${paramCount}`;
            countQuery += ` AND timestamp <= $${paramCount}`;
            values.push(new Date(normalizedFilters.endDate));
            paramCount++;
        }

        query += ' ORDER BY timestamp DESC';

        const limit = Math.min(filters.limit || 100, 1000);
        const offset = filters.offset || 0;

        query += ` LIMIT ${limit} OFFSET ${offset}`;

        const [logsResult, countResult] = await Promise.all([
            db.query(query, values),
            db.query(countQuery, values) // Note: reusing values works because params are consistent
        ]);

        return {
            logs: logsResult.rows,
            total: parseInt(countResult.rows[0].count)
        };
    } catch (error) {
        console.error('Audit log query failed:', error.message);
        throw error; // We throw here because this IS the user action (viewing logs)
    }
};

/**
 * Cleanup old audit logs (Retention Policy)
 * Intended to be run by a daily cron job.
 * Note: Requires a DB user with DELETE permissions or RLS bypass (superuser).
 * @param {number} daysToKeep - Number of days to keep logs (default: 365)
 * @returns {Promise<number>} Number of deleted rows
 */
const cleanupOldLogs = async (daysToKeep = 365) => {
    try {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - daysToKeep);

        // This query requires DELETE permission which may be revoked from app user.
        // Should be run by a maintenance worker with appropriate permissions.
        const result = await db.query(
            'DELETE FROM audit_logs WHERE timestamp < $1',
            [thresholdDate]
        );

        console.log(`Audit log cleanup: Deleted ${result.rowCount} logs older than ${daysToKeep} days.`);
        return result.rowCount;
    } catch (error) {
        console.error('Audit log cleanup failed:', error.message);
        // We log but don't rethrow to avoid crashing the cron job
        return 0;
    }
};

module.exports = {
    log,
    // Alias for compatibility if needed, or preferred name
    logAudit: log,
    queryLogs,
    // Alias for compatibility
    queryAuditLogs: queryLogs,
    cleanupOldLogs,
    AUDIT_ACTIONS,
};
