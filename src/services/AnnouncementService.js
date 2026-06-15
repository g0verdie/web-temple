/**
 * services/AnnouncementService.js
 * Postgres-backed announcements: CRUD + feature/restore + homepage read + the
 * first all-members email fan-out on the Bull queue. Mirrors the recordings
 * publish→notify→cache-invalidate transaction shape (RecordingService.publishRecording).
 *
 * SECURITY CRUX (KTD2): body_html is sanitized ON WRITE with a tight
 * sanitize-html allowlist before persist, so every consumer (homepage EJS, email
 * HTML) is safe by construction and can render it raw.
 */

const sanitizeHtml = require('sanitize-html');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const CacheService = require('./CacheService');
const { enqueueEmail } = require('./emailQueueService');
const { renderTemplate } = require('./emailTemplateService');
const { logAudit, AUDIT_ACTIONS } = require('./auditService');
const { signUnsubscribeToken } = require('../utils/unsubscribeToken');
const logger = require('../utils/logger');

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HOMEPAGE_CACHE_KEY = 'announcement:homepage';
const HOMEPAGE_CACHE_TTL = 120; // seconds (KTD6)
const DEFAULT_FEATURE_DAYS = 30; // FR111

// KTD2 — write-time sanitizer allowlist. Drops everything else (scripts, event
// handlers, javascript: URLs). img requires alt (dropped if missing → a11y).
const SANITIZE_OPTIONS = {
    allowedTags: ['p', 'br', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'a', 'img'],
    allowedAttributes: {
        a: ['href'],
        img: ['src', 'alt']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
        a: ['http', 'https', 'mailto'],
        img: ['http', 'https']
    },
    // Reject protocol-relative URLs (//evil.com), which otherwise bypass the scheme
    // allowlist and render as off-site links on the public homepage.
    allowProtocolRelative: false,
    // Drop <img> that has no alt text (accessibility requirement, Story 5.2).
    exclusiveFilter: (frame) => frame.tag === 'img' && !(frame.attribs && frame.attribs.alt && frame.attribs.alt.trim()),
    disallowedTagsMode: 'discard'
};

/**
 * Sanitize raw author HTML into a safe body_html and derive a plaintext body_text.
 * @param {string} rawBody
 * @returns {{ bodyHtml: string, bodyText: string }}
 */
const sanitizeBody = (rawBody) => {
    const source = typeof rawBody === 'string' ? rawBody : '';
    const bodyHtml = sanitizeHtml(source, SANITIZE_OPTIONS);
    // Derive plaintext from the *sanitized* HTML so the text part can never carry
    // anything the HTML part wouldn't. Strip all tags, keep text content.
    const bodyText = sanitizeHtml(source, { allowedTags: [], allowedAttributes: {} })
        .replace(/\s+/g, ' ')
        .trim();
    return { bodyHtml, bodyText };
};

const getHomeUrl = () => {
    const base = process.env.APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
    return base.replace(/\/$/, '');
};

/**
 * Decorate a raw DB row with computed display flags for views.
 *  - isFeatured: featured AND not yet expired (lazy expiry, KTD5)
 *  - wasEdited: updated meaningfully after publish (Story 5.3 "Updated:" indicator)
 */
const decorate = (row) => {
    if (!row) {
        return row;
    }
    const now = Date.now();
    const featuredUntil = row.featured_until ? new Date(row.featured_until).getTime() : 0;
    const publishedAt = row.published_at ? new Date(row.published_at).getTime() : 0;
    const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    return {
        ...row,
        isFeatured: !!row.featured && featuredUntil > now,
        // 1s epsilon avoids flagging the create-time updated_at==published_at write as an edit.
        wasEdited: updatedAt > publishedAt + 1000
    };
};

/**
 * Homepage slice: published announcements, featured (unexpired) pinned first,
 * then newest-first. Cached for 120s and busted on every write.
 * @param {number} limit
 * @returns {Promise<Array>}
 */
const getHomepageAnnouncements = async (limit = 5) => {
    const cached = await CacheService.get(HOMEPAGE_CACHE_KEY);
    if (cached) {
        return cached;
    }

    const result = await db.query(
        `
        SELECT id, title, body_html, body_text, featured, featured_until,
               published_at, updated_at
        FROM announcements
        WHERE status = 'published'
        ORDER BY (featured AND featured_until > NOW()) DESC, published_at DESC
        LIMIT $1
        `,
        [limit]
    );

    const decorated = result.rows.map(decorate);
    await CacheService.set(HOMEPAGE_CACHE_KEY, decorated, HOMEPAGE_CACHE_TTL);
    return decorated;
};

/**
 * Single published announcement by id (public). Returns null for missing,
 * malformed, or non-published ids (conflates missing/unpublished, like recordings).
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
const getById = async (id) => {
    if (typeof id !== 'string' || !uuidRegex.test(id)) {
        return null;
    }
    const result = await db.query(
        `SELECT * FROM announcements WHERE id = $1 AND status = 'published' LIMIT 1`,
        [id]
    );
    return result.rows[0] ? decorate(result.rows[0]) : null;
};

/**
 * Admin edit-form fetch: any non-deleted row by id (published only — deleted rows
 * are reached via the archive/restore flow). Returns null for missing/malformed.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
const getByIdForAdmin = async (id) => {
    if (typeof id !== 'string' || !uuidRegex.test(id)) {
        return null;
    }
    const result = await db.query(
        `SELECT * FROM announcements WHERE id = $1 AND status != 'deleted' LIMIT 1`,
        [id]
    );
    return result.rows[0] ? decorate(result.rows[0]) : null;
};

/**
 * Admin list (newest-first). Excludes deleted rows unless includeDeleted is set
 * (the archive section, Story 5.4).
 * @param {{ includeDeleted?: boolean }} [options]
 * @returns {Promise<Array>}
 */
const listForAdmin = async ({ includeDeleted = false } = {}) => {
    const where = includeDeleted ? '' : `WHERE status != 'deleted'`;
    const result = await db.query(
        `
        SELECT id, title, body_html, body_text, status, featured, featured_until,
               published_at, updated_at, deleted_at
        FROM announcements
        ${where}
        ORDER BY published_at DESC
        `
    );
    return result.rows.map(decorate);
};

/**
 * Fan out one Bull job per opted-in recipient (KTD3 step 4 / U7). Runs OUTSIDE
 * the DB transaction. One job per recipient gives each independent retry/backoff;
 * a single rejection is isolated so it never aborts the rest or throws.
 * @param {Array<{ email: string, first_name: string }>} members
 * @param {{ title: string, bodyHtml: string, bodyText: string }} payload
 */
const fanOutAnnouncementEmails = async (members, payload) => {
    await Promise.allSettled(
        members.map((member) => {
            const content = renderTemplate('announcement-notification', {
                memberName: member.first_name || 'Member',
                title: payload.title,
                bodyHtml: payload.bodyHtml,
                bodyText: payload.bodyText,
                homeUrl: getHomeUrl(),
                unsubscribeToken: signUnsubscribeToken(member.id)
            });

            return enqueueEmail({
                to: member.email,
                subject: content.subject,
                html: content.html,
                text: content.text,
                priority: 2
            }).catch((e) => logger.error('Failed to queue announcement email', { error: e.message }));
        })
    );
};

/**
 * Create + publish an announcement: sanitize, persist + audit in a transaction,
 * then fan out emails to opted-in members and bust the homepage cache.
 * @param {Object} input - { title, body, featured, featuredDurationDays }
 * @param {Object} context - { userId, ipAddress }
 * @returns {Promise<Object>} the created row + recipientCount
 */
const create = async ({ title, body, featured = false, featuredDurationDays = DEFAULT_FEATURE_DAYS } = {}, context = {}) => {
    const { userId, ipAddress } = context;

    if (!title || !String(title).trim()) {
        throw new Error('Title is required');
    }

    const { bodyHtml, bodyText } = sanitizeBody(body);
    const id = uuidv4();
    const isFeatured = !!featured;
    const featuredUntil = isFeatured
        ? new Date(Date.now() + featuredDurationDays * 24 * 60 * 60 * 1000)
        : null;

    const client = await db.pool.connect();
    let created;
    let members = [];

    try {
        await client.query('BEGIN');

        // If publishing a featured announcement, clear any other featured row first
        // (one-at-a-time, Story 5.7) inside the same transaction.
        if (isFeatured) {
            await client.query(
                `UPDATE announcements SET featured = false WHERE featured = true`
            );
        }

        const insertResult = await client.query(
            `
            INSERT INTO announcements (
                id, title, body_html, body_text, status, featured, featured_until,
                published_at, updated_at, created_by, updated_by
            ) VALUES ($1, $2, $3, $4, 'published', $5, $6, NOW(), NOW(), $7, $7)
            RETURNING *
            `,
            [id, String(title).trim(), bodyHtml, bodyText, isFeatured, featuredUntil, userId]
        );
        created = insertResult.rows[0];

        // Opted-in recipients (KTD4) — filtered at the SQL layer.
        const membersResult = await client.query(
            `
            SELECT id, email, first_name
            FROM users
            WHERE (notification_preferences->>'announcements')::boolean = true
            `
        );
        members = membersResult.rows;

        await logAudit({
            user_id: userId,
            action: AUDIT_ACTIONS.ANNOUNCEMENT_CREATED || 'ANNOUNCEMENT_CREATED',
            entity_type: 'announcement',
            entity_id: created.id,
            after_state: { title: created.title, featured: created.featured },
            description: `Created announcement: ${created.title}`,
            ip_address: ipAddress
        });

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error creating announcement', { error: error.message });
        throw error;
    } finally {
        client.release();
    }

    // OUTSIDE the transaction: fan out emails (failure-isolated) then bust cache.
    await fanOutAnnouncementEmails(members, { title: created.title, bodyHtml, bodyText });
    await CacheService.invalidatePattern('announcement:*');

    return { ...decorate(created), recipientCount: members.length };
};

/**
 * Edit a published announcement. Preserves published_at; does NOT re-notify
 * (Story 5.3). Captures before/after audit state.
 * @param {string} id
 * @param {Object} input - { title, body }
 * @param {Object} context - { userId, ipAddress }
 * @returns {Promise<Object>} the updated row
 */
const update = async (id, { title, body } = {}, context = {}) => {
    const { userId, ipAddress } = context;

    if (!uuidRegex.test(id)) {
        throw new Error('Announcement not found');
    }
    if (!title || !String(title).trim()) {
        throw new Error('Title is required');
    }

    const beforeResult = await db.query(
        `SELECT id, title, body_html, body_text FROM announcements WHERE id = $1 AND status = 'published'`,
        [id]
    );
    const before = beforeResult.rows[0];
    if (!before) {
        throw new Error('Announcement not found');
    }

    const { bodyHtml, bodyText } = sanitizeBody(body);

    const updateResult = await db.query(
        `
        UPDATE announcements
        SET title = $2, body_html = $3, body_text = $4, updated_at = NOW(), updated_by = $5
        WHERE id = $1 AND status = 'published'
        RETURNING *
        `,
        [id, String(title).trim(), bodyHtml, bodyText, userId]
    );
    const updated = updateResult.rows[0];

    await logAudit({
        user_id: userId,
        action: AUDIT_ACTIONS.ANNOUNCEMENT_UPDATED || 'ANNOUNCEMENT_UPDATED',
        entity_type: 'announcement',
        entity_id: id,
        before_state: { title: before.title, body_html: before.body_html, body_text: before.body_text },
        after_state: { title: updated.title, body_html: updated.body_html, body_text: updated.body_text },
        description: `Edited announcement: ${updated.title}`,
        ip_address: ipAddress
    });

    await CacheService.invalidatePattern('announcement:*');
    return decorate(updated);
};

/**
 * Soft-delete an announcement (archive). Captures full content in before_state.
 * @param {string} id
 * @param {Object} context - { userId, ipAddress }
 * @returns {Promise<boolean>}
 */
const softDelete = async (id, context = {}) => {
    const { userId, ipAddress } = context;
    if (!uuidRegex.test(id)) {
        throw new Error('Announcement not found');
    }

    const beforeResult = await db.query(
        `SELECT id, title, body_html, body_text, status FROM announcements WHERE id = $1 AND status = 'published'`,
        [id]
    );
    const before = beforeResult.rows[0];
    if (!before) {
        throw new Error('Announcement not found');
    }

    await db.query(
        `UPDATE announcements SET status = 'deleted', deleted_at = NOW(), updated_at = NOW(), updated_by = $2 WHERE id = $1`,
        [id, userId]
    );

    await logAudit({
        user_id: userId,
        action: AUDIT_ACTIONS.ANNOUNCEMENT_DELETED || 'ANNOUNCEMENT_DELETED',
        entity_type: 'announcement',
        entity_id: id,
        before_state: { title: before.title, body_html: before.body_html, body_text: before.body_text },
        description: `Archived announcement: ${before.title}`,
        ip_address: ipAddress
    });

    await CacheService.invalidatePattern('announcement:*');
    return true;
};

/**
 * Restore a soft-deleted announcement back to published (Story 5.4 reversible).
 * @param {string} id
 * @param {Object} context - { userId, ipAddress }
 * @returns {Promise<Object>} the restored row
 */
const restore = async (id, context = {}) => {
    const { userId, ipAddress } = context;
    if (!uuidRegex.test(id)) {
        throw new Error('Announcement not found');
    }

    const result = await db.query(
        `
        UPDATE announcements
        SET status = 'published', deleted_at = NULL, updated_at = NOW(), updated_by = $2
        WHERE id = $1 AND status = 'deleted'
        RETURNING *
        `,
        [id, userId]
    );
    const restored = result.rows[0];
    if (!restored) {
        throw new Error('Announcement not found');
    }

    await logAudit({
        user_id: userId,
        action: AUDIT_ACTIONS.ANNOUNCEMENT_UPDATED || 'ANNOUNCEMENT_UPDATED',
        entity_type: 'announcement',
        entity_id: id,
        after_state: { title: restored.title, status: 'published' },
        description: `Restored announcement: ${restored.title}`,
        ip_address: ipAddress
    });

    await CacheService.invalidatePattern('announcement:*');
    return decorate(restored);
};

/**
 * Feature/pin (or un-feature) an announcement. One-at-a-time (Story 5.7): clears
 * any other featured row first, in a transaction. 30-day lazy expiry (FR111).
 * @param {string} id
 * @param {{ featured: boolean, durationDays?: number }} input
 * @param {Object} context - { userId, ipAddress }
 * @returns {Promise<Object>} the updated row
 */
const setFeatured = async (id, { featured, durationDays = DEFAULT_FEATURE_DAYS } = {}, context = {}) => {
    const { userId, ipAddress } = context;
    if (!uuidRegex.test(id)) {
        throw new Error('Announcement not found');
    }
    const makeFeatured = !!featured;
    const featuredUntil = makeFeatured
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
        : null;

    const client = await db.pool.connect();
    let updated;
    try {
        await client.query('BEGIN');

        if (makeFeatured) {
            // Clear every other featured row (one-at-a-time, Story 5.7).
            await client.query(
                `UPDATE announcements SET featured = false WHERE featured = true AND id <> $1`,
                [id]
            );
        }

        const result = await client.query(
            `
            UPDATE announcements
            SET featured = $2, featured_until = $3, updated_at = updated_at, updated_by = $4
            WHERE id = $1 AND status = 'published'
            RETURNING *
            `,
            [id, makeFeatured, featuredUntil, userId]
        );
        updated = result.rows[0];
        if (!updated) {
            throw new Error('Announcement not found');
        }

        await logAudit({
            user_id: userId,
            action: AUDIT_ACTIONS.ANNOUNCEMENT_FEATURED || 'ANNOUNCEMENT_FEATURED',
            entity_type: 'announcement',
            entity_id: id,
            after_state: { featured: makeFeatured, featured_until: featuredUntil },
            description: `${makeFeatured ? 'Featured' : 'Unfeatured'} announcement: ${updated.title}`,
            ip_address: ipAddress
        });

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error featuring announcement', { error: error.message });
        throw error;
    } finally {
        client.release();
    }

    await CacheService.invalidatePattern('announcement:*');
    return decorate(updated);
};

module.exports = {
    sanitizeBody,
    getHomepageAnnouncements,
    getById,
    getByIdForAdmin,
    listForAdmin,
    create,
    update,
    softDelete,
    restore,
    setFeatured
};
