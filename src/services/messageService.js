/**
 * services/messageService.js
 * Read-side helpers for contact-form messages. The full read/reply inbox is Epic 7
 * (deferred); the MVP Rabbi dashboard surfaces only the pending-message count.
 */
const db = require('../config/db');

/** Count of contact messages still awaiting a response (status='new'). */
const getNewMessageCount = async () => {
    const result = await db.query("SELECT COUNT(*)::int AS count FROM messages WHERE status = 'new'");
    return result.rows[0] ? result.rows[0].count : 0;
};

module.exports = { getNewMessageCount };
