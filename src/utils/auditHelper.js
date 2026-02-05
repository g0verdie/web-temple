const db = require('../config/db');

/**
 * Audit logging helper for recording sensitive operations
 * Logs to append-only audit_logs table
 */

/**
 * Log an audit event
 * @param {Object} options - Audit event details
 * @param {string} options.user_id - UUID of user performing action
 * @param {string} options.action - Action type (e.g., 'ANNOUNCEMENT_CREATED', 'DONATION_RECEIVED', 'PASSWORD_CHANGED')
 * @param {string} options.entity_type - Type of entity (e.g., 'announcement', 'donation', 'user')
 * @param {string} options.entity_id - ID of entity being modified
 * @param {Object} options.before_state - Previous state (optional, for updates)
 * @param {Object} options.after_state - New state (optional)
 * @param {string} options.description - Human-readable description
 * @param {string} options.ip_address - IP address of requester (optional)
 * @returns {Promise<void>}
 */
const logAudit = async (options) => {
    try {
        const {
            user_id,
            action,
            entity_type,
            entity_id,
            before_state,
            after_state,
            description,
            ip_address,
        } = options;

        if (!action) {
            throw new Error('audit log: action is required');
        }

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
            RETURNING id;
        `;

        const values = [
            user_id || null,
            action,
            entity_type || null,
            entity_id || null,
            before_state ? JSON.stringify(before_state) : null,
            after_state ? JSON.stringify(after_state) : null,
            description || null,
            ip_address || null,
        ];

        const result = await db.query(query, values);
        return result.rows[0];
    } catch (error) {
        // FAIL-CLOSED: Rethrow error to prevent sensitive actions from proceeding without audit log
        console.error('CRITICAL: Audit logging failed. Action blocked.', error.message);
        throw new Error('System error: Audit log failure');
    }
};

/**
 * Common audit event types
 */
const AUDIT_ACTIONS = {
    // Authentication
    USER_REGISTERED: 'USER_REGISTERED',
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

    // Admin
    ADMIN_LOGIN: 'ADMIN_LOGIN',
    ADMIN_LOGOUT: 'ADMIN_LOGOUT',
    USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
    ADMIN_SETTING_CHANGED: 'ADMIN_SETTING_CHANGED',
};

/**
 * Query audit logs
 * @param {Object} filters - Query filters
 * @param {string} filters.action - Filter by action type
 * @param {string} filters.user_id - Filter by user
 * @param {string} filters.entity_type - Filter by entity type
 * @param {Date} filters.since - Filter by timestamp (ISO string)
 * @param {number} filters.limit - Limit results (default: 100, max: 1000)
 * @returns {Promise<Array>} Audit log entries
 */
const queryAuditLogs = async (filters = {}) => {
    try {
        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        const values = [];
        let paramCount = 1;

        if (filters.action) {
            query += ` AND action = $${paramCount++}`;
            values.push(filters.action);
        }

        if (filters.user_id) {
            query += ` AND user_id = $${paramCount++}`;
            values.push(filters.user_id);
        }

        if (filters.entity_type) {
            query += ` AND entity_type = $${paramCount++}`;
            values.push(filters.entity_type);
        }

        if (filters.since) {
            query += ` AND timestamp >= $${paramCount++}`;
            values.push(new Date(filters.since));
        }

        query += ' ORDER BY timestamp DESC';

        const limit = Math.min(filters.limit || 100, 1000);
        query += ` LIMIT ${limit}`;

        const result = await db.query(query, values);
        return result.rows;
    } catch (error) {
        console.error('Audit log query failed:', error.message);
        return [];
    }
};

module.exports = {
    logAudit,
    queryAuditLogs,
    AUDIT_ACTIONS,
};
