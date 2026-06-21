/**
 * services/memberAdminService.js
 * Admin-side member account management for two-gate registration (backlog item 6):
 * the pending-approval queue plus approve/reject actions. Services own all SQL.
 */
const db = require('../config/db');
const { logAudit, AUDIT_ACTIONS } = require('./auditService');
const { enqueueEmail } = require('./emailQueueService');
const { renderTemplate } = require('./emailTemplateService');
const logger = require('../utils/logger');

/** Members who verified their email and are awaiting admin/rabbi approval (oldest first). */
const listPendingApproval = async () => {
    const result = await db.query(
        `SELECT id, email, first_name, last_name, created_at
         FROM users
         WHERE status = 'pending_approval'
         ORDER BY created_at ASC`
    );
    return result.rows;
};

/** Count of accounts awaiting approval (for the dashboard badge). */
const getPendingApprovalCount = async () => {
    const result = await db.query("SELECT COUNT(*)::int AS count FROM users WHERE status = 'pending_approval'");
    return result.rows[0] ? result.rows[0].count : 0;
};

/**
 * Approve a pending member: activate the account and send the (deferred) welcome email.
 * Idempotent — only a row still in 'pending_approval' is activated.
 * @returns {Promise<boolean>} true if this call activated the account
 */
const approveMember = async (userId, actorId = null, ip_address = null) => {
    const result = await db.query(
        "UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1 AND status = 'pending_approval' RETURNING email, first_name",
        [userId]
    );
    if (result.rows.length === 0) {
        return false;
    }
    const { email, first_name } = result.rows[0];

    logAudit({
        user_id: actorId,
        action: AUDIT_ACTIONS.MEMBER_APPROVED,
        entity_type: 'user',
        entity_id: userId,
        description: `Member approved: ${email}`,
        ip_address,
    }).catch(err => logger.error('Audit log error', { error: err }));

    // Welcome email is sent here, deferred from registration to approval.
    try {
        const emailContent = renderTemplate('welcome', { name: first_name || email });
        enqueueEmail({
            to: email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
            priority: 2
        }).catch(err => logger.error('Failed to queue welcome email', { error: err }));
    } catch (err) {
        logger.error('Failed to render welcome email on approval', { error: err });
    }

    return true;
};

/**
 * Reject a pending member (still email-unverified or awaiting approval).
 * @returns {Promise<boolean>} true if a row was rejected
 */
const rejectMember = async (userId, actorId = null, ip_address = null) => {
    const result = await db.query(
        "UPDATE users SET status = 'rejected', updated_at = NOW() WHERE id = $1 AND status IN ('pending_verification', 'pending_approval') RETURNING email",
        [userId]
    );
    if (result.rows.length === 0) {
        return false;
    }
    logAudit({
        user_id: actorId,
        action: AUDIT_ACTIONS.MEMBER_REJECTED,
        entity_type: 'user',
        entity_id: userId,
        description: `Member rejected: ${result.rows[0].email}`,
        ip_address,
    }).catch(err => logger.error('Audit log error', { error: err }));
    return true;
};

module.exports = { listPendingApproval, getPendingApprovalCount, approveMember, rejectMember };
