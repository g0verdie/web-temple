/**
 * services/messageService.js
 * Contact-form messages: the dashboard count plus the admin inbox (list / read /
 * reply-status / delete) over the existing `messages` table (item 9). Services own SQL.
 */
const db = require('../config/db');
const validator = require('validator');

const STATUSES = ['new', 'read', 'replied', 'archived'];

/** Count of contact messages still awaiting a response (status='new'). */
const getNewMessageCount = async () => {
    const result = await db.query("SELECT COUNT(*)::int AS count FROM messages WHERE status = 'new'");
    return result.rows[0] ? result.rows[0].count : 0;
};

/** Paginated inbox list, newest first, optionally filtered by status. */
const listMessages = async ({ status, page = 1, limit = 20 } = {}) => {
    const where = [];
    const values = [];
    let i = 1;
    if (status && STATUSES.includes(status)) {
        where.push(`status = $${i++}`);
        values.push(status);
    }
    const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const countRes = await db.query(`SELECT COUNT(*)::int AS count FROM messages ${whereStr}`, values);
    const totalCount = countRes.rows[0] ? countRes.rows[0].count : 0;

    const dataRes = await db.query(
        `SELECT id, name, email, subject, message, status, created_at
         FROM messages ${whereStr}
         ORDER BY created_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...values, limit, offset]
    );
    return {
        messages: dataRes.rows,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        currentPage: page
    };
};

/** A single message for the detail view. Null on missing/invalid id. */
const getMessageById = async (id) => {
    if (!id || !validator.isUUID(String(id))) return null;
    const res = await db.query(
        'SELECT id, name, email, subject, message, status, created_at, updated_at FROM messages WHERE id = $1',
        [id]
    );
    return res.rows[0] || null;
};

/** Update a message's status (new|read|replied|archived). Returns true if a row changed. */
const updateStatus = async (id, status) => {
    if (!STATUSES.includes(status)) {
        throw new Error('Invalid status');
    }
    if (!id || !validator.isUUID(String(id))) return false;
    const res = await db.query(
        'UPDATE messages SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING id',
        [id, status]
    );
    return res.rows.length > 0;
};

/** Permanently delete a message (e.g. spam). Returns true if a row was removed. */
const deleteMessage = async (id) => {
    if (!id || !validator.isUUID(String(id))) return false;
    const res = await db.query('DELETE FROM messages WHERE id = $1 RETURNING id', [id]);
    return res.rows.length > 0;
};

module.exports = { getNewMessageCount, listMessages, getMessageById, updateStatus, deleteMessage, STATUSES };
