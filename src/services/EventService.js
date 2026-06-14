const CacheService = require('./CacheService');
const StreamingService = require('./StreamingService');
const db = require('../config/db');
const auditService = require('./auditService');
const { enqueueEmail } = require('./emailQueueService');
const { buildEventIcs } = require('./icalService');
const logger = require('../utils/logger');

const VALID_VISIBILITY = ['public', 'members'];
const VALID_EVENT_TYPE = ['service', 'event'];

const CACHE_KEY_PUBLIC = 'event:all:public';
const CACHE_KEY_MEMBERS = 'event:all:members';

/**
 * Map a DB row to the legacy event shape consumed by home.ejs / homeController
 * and the streaming admin dropdown. Keeps `date` (Date), `type` ('service'|'event'),
 * and camelCase extras so existing callers need no changes.
 */
const mapRow = (row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.starts_at ? new Date(row.starts_at) : null,
    endsAt: row.ends_at ? new Date(row.ends_at) : null,
    type: row.event_type,
    visibility: row.visibility,
    location: row.location,
    zoomUrl: row.zoom_url,
    reminderSentAt: row.reminder_sent_at ? new Date(row.reminder_sent_at) : null,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    createdBy: row.created_by,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null
});

/**
 * Parse a datetime-local / ISO string into a Date. datetime-local inputs are
 * timezone-naive; append APP_TIMEZONE_OFFSET so they're interpreted in the
 * congregation's timezone regardless of server TZ (mirrors StreamingService).
 */
const parseEventDate = (dateStr) => {
    if (!dateStr) return new Date(NaN);
    if (dateStr instanceof Date) return dateStr;
    const str = String(dateStr);
    if (/[Zz]$/.test(str) || /[+-]\d{2}:\d{2}$/.test(str)) {
        return new Date(str);
    }
    const offset = process.env.APP_TIMEZONE_OFFSET;
    if (offset) {
        return new Date(`${str}${offset}`);
    }
    return new Date(str);
};

class EventService {
    async invalidateCaches(id) {
        await CacheService.del(CACHE_KEY_PUBLIC);
        await CacheService.del(CACHE_KEY_MEMBERS);
        // Keep legacy key in sync (StreamingService still invalidates 'event:all').
        await CacheService.del('event:all');
        if (id != null) {
            await CacheService.del(`event:${id}`);
        }
    }

    /**
     * Read active (non-deleted) events from the DB, visibility-filtered.
     * @param {boolean} includeMembersOnly - when false, only 'public' events
     * @returns {Promise<Array>} mapped event rows
     */
    async getDbEvents(includeMembersOnly = false) {
        let query = 'SELECT * FROM events WHERE deleted_at IS NULL';
        const values = [];
        if (!includeMembersOnly) {
            query += " AND visibility = 'public'";
        }
        query += ' ORDER BY starts_at ASC';
        const result = await db.query(query, values);
        return result.rows.map(mapRow);
    }

    /**
     * Get all events (DB events + merged scheduled streams), visibility-aware.
     * Preserves the legacy contract: returns objects with { id, title, date (Date),
     * description, type, location, ... }. Cached per visibility scope (KTD5).
     * @param {boolean} includeMembersOnly
     * @returns {Promise<Array>}
     */
    async getEvents(includeMembersOnly = false) {
        const cacheKey = includeMembersOnly ? CACHE_KEY_MEMBERS : CACHE_KEY_PUBLIC;
        const cachedEvents = await CacheService.get(cacheKey);

        if (cachedEvents) {
            return cachedEvents.map(event => ({
                ...event,
                date: event.date ? new Date(event.date) : null,
                endsAt: event.endsAt ? new Date(event.endsAt) : null
            }));
        }

        let events;
        try {
            events = await this.getDbEvents(includeMembersOnly);
        } catch (error) {
            logger.error('Failed to load events from DB', { error: error.message });
            return [];
        }

        try {
            const scheduledStreams = await StreamingService.getScheduledStreams();
            const activeAndScheduled = scheduledStreams.filter(
                stream => stream.status === 'scheduled' || stream.status === 'active'
            );

            for (const stream of activeAndScheduled) {
                if (stream.event_id) {
                    const matchedEvent = events.find(e => Number(e.id) === Number(stream.event_id));
                    if (matchedEvent) {
                        matchedEvent.hasLiveStream = true;
                        matchedEvent.facebookLiveUrl = stream.facebook_live_url;
                        matchedEvent.streamStatus = stream.status;
                        matchedEvent.description = `${matchedEvent.description || ''} (This service will be livestreamed.)`;
                        continue;
                    }
                }

                // Stream not linked to a DB event: synthesise a calendar entry.
                events.push({
                    id: `stream-${stream.id}`,
                    title: stream.title,
                    date: new Date(stream.scheduled_start),
                    description: `Live Streamed Service: ${stream.title || 'Upcoming Stream'}`,
                    type: 'service',
                    location: 'Main Sanctuary (Online)',
                    hasLiveStream: true,
                    facebookLiveUrl: stream.facebook_live_url,
                    streamStatus: stream.status
                });
            }
        } catch (error) {
            logger.error('Failed to merge scheduled streams into events list', { error: error.message });
            // Return uncached so the next request retries instead of serving stale data.
            return events;
        }

        // Re-sort because synthesised stream events were appended.
        events.sort((a, b) => (a.date || 0) - (b.date || 0));

        await CacheService.set(cacheKey, events, 300);
        return events;
    }

    /**
     * Get next upcoming 'service' event. Public-only (homepage is a public page).
     * @returns {Promise<Object|null>}
     */
    async getNextService() {
        const events = await this.getEvents(false);
        const now = new Date();
        const upcomingServices = events
            .filter(event => event.type === 'service' && event.date > now)
            .sort((a, b) => a.date - b.date);
        return upcomingServices[0] || null;
    }

    /**
     * Get upcoming events (limited). Public-only (homepage is a public page).
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getUpcomingEvents(limit = 3) {
        const events = await this.getEvents(false);
        const now = new Date();
        return events
            .filter(event => event.date > now)
            .sort((a, b) => a.date - b.date)
            .slice(0, limit);
    }

    /**
     * Get a single active event by id.
     * @param {number|string} id
     * @returns {Promise<Object|null>}
     */
    async getEventById(id) {
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId)) return null;
        const result = await db.query(
            'SELECT * FROM events WHERE id = $1 AND deleted_at IS NULL',
            [parsedId]
        );
        return result.rows[0] ? mapRow(result.rows[0]) : null;
    }

    /**
     * Get active events whose start falls within [rangeStart, rangeEnd], visibility-filtered.
     * @param {Date} rangeStart
     * @param {Date} rangeEnd
     * @param {boolean} includeMembersOnly
     * @returns {Promise<Array>}
     */
    async getEventsInRange(rangeStart, rangeEnd, includeMembersOnly = false) {
        const values = [rangeStart, rangeEnd];
        let query = 'SELECT * FROM events WHERE deleted_at IS NULL AND starts_at >= $1 AND starts_at <= $2';
        if (!includeMembersOnly) {
            query += " AND visibility = 'public'";
        }
        query += ' ORDER BY starts_at ASC';
        const result = await db.query(query, values);
        return result.rows.map(mapRow);
    }

    /**
     * Get soft-deleted (archived) events for the admin restore view.
     * @returns {Promise<Array>}
     */
    async getArchivedEvents() {
        const result = await db.query(
            'SELECT * FROM events WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
        );
        return result.rows.map(mapRow);
    }

    /**
     * Events starting within the next 24h that have not been reminded yet (KTD8).
     * @returns {Promise<Array>}
     */
    async getEventsNeedingReminder() {
        const result = await db.query(
            `SELECT * FROM events
             WHERE deleted_at IS NULL
               AND reminder_sent_at IS NULL
               AND starts_at > NOW()
               AND starts_at <= NOW() + INTERVAL '24 hours'
             ORDER BY starts_at ASC`
        );
        return result.rows.map(mapRow);
    }

    /**
     * Atomically claim an event's 24h reminder (one-shot guard). Returns true only
     * when THIS call flips reminder_sent_at NULL → NOW(), so an overlapping scan or
     * a job retry can't double-fire the reminder to the whole membership. Callers
     * claim BEFORE fanning out (claim-then-send).
     * @param {number} id
     * @returns {Promise<boolean>} true if this call won the claim
     */
    async markReminderSent(id) {
        const result = await db.query(
            'UPDATE events SET reminder_sent_at = NOW() WHERE id = $1 AND reminder_sent_at IS NULL RETURNING id',
            [id]
        );
        return result.rows.length > 0;
    }

    /**
     * Fetch members opted in to calendar notifications (canonical key: calendar_events).
     * @returns {Promise<Array<{id, email, first_name}>>}
     */
    async getOptedInMembers() {
        const result = await db.query(
            `SELECT id, email, first_name
             FROM users
             WHERE (notification_preferences->>'calendar_events')::boolean = true`
        );
        return result.rows;
    }

    /**
     * Validate and normalise event input shared by create/update.
     * @returns {Object} normalised fields
     */
    validate(eventData) {
        const title = typeof eventData.title === 'string' ? eventData.title.trim() : '';
        if (!title) {
            throw new Error('Title is required');
        }
        if (title.length > 255) {
            throw new Error('Title cannot exceed 255 characters');
        }

        const startsAt = parseEventDate(eventData.starts_at || eventData.date);
        if (isNaN(startsAt.getTime())) {
            throw new Error('Invalid start date');
        }

        let endsAt = null;
        if (eventData.ends_at) {
            endsAt = parseEventDate(eventData.ends_at);
            if (isNaN(endsAt.getTime())) {
                throw new Error('Invalid end date');
            }
            if (endsAt.getTime() < startsAt.getTime()) {
                throw new Error('End date must be after start date');
            }
        }

        const visibility = eventData.visibility || 'public';
        if (!VALID_VISIBILITY.includes(visibility)) {
            throw new Error('Invalid visibility');
        }

        const eventType = eventData.event_type || eventData.type || 'event';
        if (!VALID_EVENT_TYPE.includes(eventType)) {
            throw new Error('Invalid event type');
        }

        return {
            title,
            description: eventData.description ? String(eventData.description) : null,
            startsAt,
            endsAt,
            visibility,
            eventType,
            location: eventData.location ? String(eventData.location).trim() : null,
            zoomUrl: eventData.zoom_url ? String(eventData.zoom_url).trim() : null
        };
    }

    /**
     * Create an event: insert, audit (inside service), invalidate cache, then
     * notify opted-in members OUTSIDE the write path.
     * @param {Object} eventData
     * @param {string} [userId]
     * @param {string} [ipAddress]
     * @returns {Promise<Object>} created (mapped) event
     */
    async create(eventData, userId = null, ipAddress = null) {
        const v = this.validate(eventData);

        const result = await db.query(
            `INSERT INTO events (title, description, starts_at, ends_at, visibility, event_type, location, zoom_url, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [v.title, v.description, v.startsAt, v.endsAt, v.visibility, v.eventType, v.location, v.zoomUrl, userId]
        );
        const created = mapRow(result.rows[0]);

        await auditService.log({
            user_id: userId,
            action: auditService.AUDIT_ACTIONS.CALENDAR_EVENT_CREATED,
            entity_type: 'event',
            entity_id: String(created.id),
            after_state: result.rows[0],
            description: `Created event "${created.title}"`,
            ip_address: ipAddress
        });

        await this.invalidateCaches(created.id);
        await this.notifyMembers(created, 'new-event');

        return created;
    }

    /**
     * Update an event: capture before-state, update, audit before/after, invalidate
     * cache, then notify opted-in members of the change.
     * @param {number|string} id
     * @param {Object} eventData
     * @param {string} [userId]
     * @param {string} [ipAddress]
     * @returns {Promise<Object>} updated (mapped) event
     */
    async update(id, eventData, userId = null, ipAddress = null) {
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId)) {
            throw new Error('Event not found');
        }

        const existingResult = await db.query(
            'SELECT * FROM events WHERE id = $1 AND deleted_at IS NULL',
            [parsedId]
        );
        if (existingResult.rows.length === 0) {
            throw new Error('Event not found');
        }
        const beforeRow = existingResult.rows[0];

        const v = this.validate(eventData);

        const result = await db.query(
            `UPDATE events
             SET title = $1, description = $2, starts_at = $3, ends_at = $4,
                 visibility = $5, event_type = $6, location = $7, zoom_url = $8, updated_at = NOW()
             WHERE id = $9
             RETURNING *`,
            [v.title, v.description, v.startsAt, v.endsAt, v.visibility, v.eventType, v.location, v.zoomUrl, parsedId]
        );
        const updated = mapRow(result.rows[0]);

        await auditService.log({
            user_id: userId,
            action: auditService.AUDIT_ACTIONS.CALENDAR_EVENT_UPDATED,
            entity_type: 'event',
            entity_id: String(parsedId),
            before_state: beforeRow,
            after_state: result.rows[0],
            description: `Updated event "${updated.title}"`,
            ip_address: ipAddress
        });

        await this.invalidateCaches(parsedId);
        await this.notifyMembers(updated, 'event-updated');

        return updated;
    }

    /**
     * Soft-delete an event: set deleted_at, audit, invalidate cache, then notify
     * opted-in members of the cancellation.
     * @param {number|string} id
     * @param {string} [userId]
     * @param {string} [ipAddress]
     * @returns {Promise<boolean>}
     */
    async delete(id, userId = null, ipAddress = null) {
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId)) {
            throw new Error('Event not found');
        }

        const existingResult = await db.query(
            'SELECT * FROM events WHERE id = $1 AND deleted_at IS NULL',
            [parsedId]
        );
        if (existingResult.rows.length === 0) {
            throw new Error('Event not found');
        }
        const beforeRow = existingResult.rows[0];

        const result = await db.query(
            'UPDATE events SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *',
            [parsedId]
        );
        const deleted = mapRow(result.rows[0]);

        await auditService.log({
            user_id: userId,
            action: auditService.AUDIT_ACTIONS.CALENDAR_EVENT_DELETED,
            entity_type: 'event',
            entity_id: String(parsedId),
            before_state: beforeRow,
            after_state: result.rows[0],
            description: `Deleted event "${deleted.title}"`,
            ip_address: ipAddress
        });

        await this.invalidateCaches(parsedId);
        await this.notifyMembers(deleted, 'event-canceled');

        return true;
    }

    /**
     * Restore a soft-deleted event (Story 6.7).
     * @param {number|string} id
     * @param {string} [userId]
     * @param {string} [ipAddress]
     * @returns {Promise<Object>} restored (mapped) event
     */
    async restore(id, userId = null, ipAddress = null) {
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId)) {
            throw new Error('Event not found');
        }

        const existingResult = await db.query(
            'SELECT * FROM events WHERE id = $1 AND deleted_at IS NOT NULL',
            [parsedId]
        );
        if (existingResult.rows.length === 0) {
            throw new Error('Event not found');
        }

        const result = await db.query(
            'UPDATE events SET deleted_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
            [parsedId]
        );
        const restored = mapRow(result.rows[0]);

        await auditService.log({
            user_id: userId,
            action: auditService.AUDIT_ACTIONS.CALENDAR_EVENT_UPDATED,
            entity_type: 'event',
            entity_id: String(parsedId),
            after_state: result.rows[0],
            description: `Restored event "${restored.title}"`,
            ip_address: ipAddress
        });

        await this.invalidateCaches(parsedId);
        return restored;
    }

    /**
     * Fan out a calendar email to every opted-in member, outside the write path.
     * Passes template + data (incl. unsubscribeToken) so renderTemplate appends a
     * working unsubscribe footer (KTD7); attaches the event .ics (KTD9).
     * Enqueue failures are caught and logged; they never fail the originating write.
     * @param {Object} event - mapped event
     * @param {('new-event'|'event-updated'|'event-canceled'|'event-reminder')} template
     */
    async notifyMembers(event, template) {
        let members;
        try {
            members = await this.getOptedInMembers();
        } catch (error) {
            logger.error('Failed to load opted-in members for calendar notification', {
                error: error.message,
                eventId: event.id
            });
            return;
        }

        if (!members.length) return;

        let icsAttachment = null;
        try {
            const ics = buildEventIcs(event);
            icsAttachment = {
                filename: ics.filename,
                content: ics.content,
                contentType: ics.contentType
            };
        } catch (error) {
            logger.error('Failed to build iCal attachment for calendar notification', {
                error: error.message,
                eventId: event.id
            });
        }

        // Fan out concurrently with per-recipient failure isolation (mirrors
        // AnnouncementService) so one bad address can't block or abort the rest.
        await Promise.allSettled(members.map(member => enqueueEmail({
            to: member.email,
            template,
            data: {
                memberName: member.first_name || 'Member',
                eventId: event.id,
                title: event.title,
                description: event.description,
                date: event.date,
                location: event.location,
                zoomUrl: event.zoomUrl,
                calendarUrl: process.env.APP_BASE_URL
                    ? `${process.env.APP_BASE_URL}/calendar`
                    : 'http://localhost:3000/calendar',
                unsubscribeToken: member.id
            },
            attachments: icsAttachment ? [icsAttachment] : undefined,
            priority: 2
        }).catch(error => logger.error('Failed to queue calendar notification email', {
            error: error.message,
            eventId: event.id,
            template
        }))));
    }
}

module.exports = new EventService();
