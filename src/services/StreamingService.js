const CacheService = require('./CacheService');
const db = require('../config/db');
const auditService = require('./auditService');
const logger = require('../utils/logger');
const { formatEventDateTime } = require('../utils/templeTime');

const CACHE_KEY = 'stream:public-embed';
const CACHE_TTL_SECONDS = 30;
const DEFAULT_TITLE = "Temple B'nai Israel Live Service";
// Auto-expiry safety net: an 'active' stream is only treated as live for this many
// hours after the admin took it live (live_started_at). Past the window a forgotten
// 'active' row stops showing "LIVE NOW" — Facebook embeds can't be health-probed, so
// the honest live signal is admin-asserted AND time-bounded.
// The window must exceed the longest CONTINUOUS broadcast (so a real service is never
// dropped mid-stream) while still clearing a forgotten stream the same night. 8h covers
// even a long High Holy Day service yet clears an overnight-forgotten row by morning.
// Override per-deploy via STREAM_MAX_LIVE_HOURS for unusually long broadcasts. (A
// stream that genuinely runs past the window can be recovered by starting a fresh one,
// which auto-completes the stale row — see activateScheduledStream.)
const DEFAULT_MAX_LIVE_HOURS = 8;
const DEFAULT_FALLBACK_URL = "https://www.facebook.com/share/18jfSPTgMw/";

const parseBoolean = (value) => typeof value === 'string' && value.toLowerCase() === 'true';

const isHostOrSubdomain = (hostname, rootDomain) => {
    return hostname === rootDomain || hostname.endsWith(`.${rootDomain}`);
};

const isAllowedProviderUrl = (value) => {
    if (!value) {
        return false;
    }

    try {
        const url = new URL(value);
        if (url.protocol !== 'https:') {
            return false;
        }
        return isHostOrSubdomain(url.hostname, 'facebook.com') || url.hostname === 'fb.watch';
    } catch (error) {
        return false;
    }
};

const getWatchUrl = () => {
    return isAllowedProviderUrl(process.env.FACEBOOK_LIVE_WATCH_URL) 
        ? process.env.FACEBOOK_LIVE_WATCH_URL 
        : DEFAULT_FALLBACK_URL;
};

/**
 * Convert a Facebook watch/video URL into the plugins iframe embed URL.
 * Falls back to the original URL if encoding fails.
 */
const convertToEmbedUrl = (watchUrl) => {
    try {
        return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(watchUrl)}&show_text=false`;
    } catch {
        return watchUrl;
    }
};

/**
 * Parse a datetime-local string with timezone awareness.
 *
 * HTML datetime-local inputs produce timezone-naive strings like '2026-06-01T19:00'.
 * JavaScript's Date constructor interprets these as the server's local time, which
 * breaks when the server runs in UTC (e.g., Docker, Heroku, AWS). This helper
 * appends APP_TIMEZONE_OFFSET (e.g., '-05:00') so the date is interpreted in the
 * congregation's timezone regardless of the server's TZ setting.
 *
 * @param {string} dateStr - A date string, possibly from datetime-local input
 * @returns {Date} Parsed Date object
 */
const parseScheduledDate = (dateStr) => {
    if (!dateStr) return new Date(NaN);
    const str = String(dateStr);
    // If the string already has a timezone indicator (Z, +HH:MM, -HH:MM), parse as-is
    if (/[Zz]$/.test(str) || /[+-]\d{2}:\d{2}$/.test(str)) {
        return new Date(str);
    }
    // Append configured offset for timezone-naive strings (from datetime-local inputs)
    const offset = process.env.APP_TIMEZONE_OFFSET; // e.g., '-05:00', '+02:00'
    if (offset) {
        return new Date(`${str}${offset}`);
    }
    // No offset configured — fall back to server-local interpretation
    return new Date(str);
};

const buildOfflineState = () => ({
    status: 'offline',
    statusLabel: 'Offline',
    archiveCta: true,
    message: 'The livestream is currently offline. Please view our past recordings.',
    embedUrl: null
});

const buildErrorState = () => ({
    status: 'error',
    statusLabel: 'Stream Error',
    fallbackUrl: getWatchUrl(),
    message: 'The streaming provider is currently unavailable. Please watch directly on Facebook.'
});

const buildUpcomingState = (scheduledStart) => ({
    status: 'upcoming',
    statusLabel: 'Upcoming',
    scheduledStart: scheduledStart,
    countdownTarget: scheduledStart,
    // Ship a temple-timezone preformatted label so the homepage poll (stream-status.js)
    // renders the same wall-clock time as the SSR card, instead of reformatting the
    // instant in the viewer's browser-local zone (cross-surface drift).
    formattedScheduledStart: formatEventDateTime(scheduledStart),
    message: 'The livestream will begin shortly.'
});

const buildLiveState = () => ({
    status: 'live',
    statusLabel: 'LIVE NOW',
    title: process.env.FACEBOOK_LIVE_TITLE || DEFAULT_TITLE,
    embedUrl: process.env.FACEBOOK_LIVE_EMBED_URL,
    watchUrl: getWatchUrl()
});

class StreamingService {
    async getPublicEmbedMetadata() {
        const cached = await CacheService.get(CACHE_KEY);
        if (cached) {
            return cached;
        }

        let metadata;

        if (parseBoolean(process.env.STREAM_PROVIDER_UNAVAILABLE)) {
            metadata = buildErrorState();
        } else {
            // Check database first for an active or upcoming scheduled stream
            try {
                // Find a genuinely-live stream: status='active' AND taken live (live_started_at)
                // within the live window. A stale/forgotten 'active' row (NULL or expired
                // live_started_at) is NOT live — this is the auto-expiry safety net. The cutoff
                // is computed in SQL relative to NOW() (passing only the hours as a number) so
                // it stays correct regardless of the Node process / DB session timezone.
                const maxLiveHours = Number(process.env.STREAM_MAX_LIVE_HOURS) || DEFAULT_MAX_LIVE_HOURS;
                const activeResult = await db.query(
                    "SELECT * FROM scheduled_streams WHERE status = 'active' AND live_started_at IS NOT NULL AND live_started_at > NOW() - ($1::double precision * INTERVAL '1 hour') ORDER BY live_started_at DESC LIMIT 1",
                    [maxLiveHours]
                );
                
                if (activeResult.rows.length > 0) {
                    const activeStream = activeResult.rows[0];
                    if (isAllowedProviderUrl(activeStream.facebook_live_url)) {
                        metadata = {
                            id: activeStream.id,
                            status: 'live',
                            statusLabel: 'LIVE NOW',
                            title: activeStream.title || DEFAULT_TITLE,
                            embedUrl: convertToEmbedUrl(activeStream.facebook_live_url),
                            watchUrl: activeStream.facebook_live_url
                        };
                    } else {
                        metadata = buildErrorState();
                    }
                } else {
                    // Check for upcoming scheduled stream
                    const upcomingResult = await db.query(
                        "SELECT * FROM scheduled_streams WHERE status = 'scheduled' AND scheduled_start > NOW() ORDER BY scheduled_start ASC LIMIT 1"
                    );
                    
                    if (upcomingResult.rows.length > 0) {
                        const upcomingStream = upcomingResult.rows[0];
                        metadata = buildUpcomingState(upcomingStream.scheduled_start);
                    }
                }
            } catch (dbError) {
                logger.warn('DB query failed in getPublicEmbedMetadata, falling back to environment variables', { error: dbError.message });
            }

            // Fallback to env variables if no DB-backed metadata was resolved
            if (!metadata) {
                if (parseBoolean(process.env.FACEBOOK_LIVE_IS_ACTIVE) && isAllowedProviderUrl(process.env.FACEBOOK_LIVE_EMBED_URL)) {
                    metadata = buildLiveState();
                } else if (parseBoolean(process.env.FACEBOOK_LIVE_IS_ACTIVE)) {
                    metadata = buildErrorState();
                } else if (process.env.FACEBOOK_LIVE_SCHEDULED_START && new Date(process.env.FACEBOOK_LIVE_SCHEDULED_START).getTime() > Date.now()) {
                    metadata = buildUpcomingState(process.env.FACEBOOK_LIVE_SCHEDULED_START);
                } else {
                    metadata = buildOfflineState();
                }
            }
        }

        await CacheService.set(CACHE_KEY, metadata, CACHE_TTL_SECONDS);
        return metadata;
    }

    async getScheduledStreams(filters) {
        filters = filters || {};
        let query = 'SELECT * FROM scheduled_streams WHERE 1=1';
        const values = [];
        let paramCount = 1;

        if (filters.status) {
            query += ` AND status = $${paramCount}`;
            values.push(filters.status);
            paramCount++;
        }
        if (filters.futureOnly) {
            query += ' AND scheduled_start >= NOW()';
        }
        
        query += ' ORDER BY scheduled_start ASC';

        const result = await db.query(query, values);
        return result.rows;
    }

    async getScheduledStreamById(id) {
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId)) {
            return null;
        }
        const result = await db.query('SELECT * FROM scheduled_streams WHERE id = $1', [parsedId]);
        return result.rows[0] || null;
    }

    async createScheduledStream(data, userId, ipAddress) {
        const { title, scheduled_start, facebook_live_url, event_id } = data;
        
        if (!title || typeof title !== 'string' || !title.trim()) {
            throw new Error('Title is required');
        }
        if (title.length > 255) {
            throw new Error('Title cannot exceed 255 characters');
        }

        const start = parseScheduledDate(scheduled_start);
        if (isNaN(start.getTime())) {
            throw new Error('Invalid scheduled start date');
        }
        if (start.getTime() <= Date.now()) {
            throw new Error('Scheduled start date must be in the future');
        }

        if (facebook_live_url && !isAllowedProviderUrl(facebook_live_url)) {
            throw new Error('Invalid Facebook Live URL. Must be a secure (HTTPS) URL from facebook.com or fb.watch.');
        }

        const finalEventId = event_id ? parseInt(event_id, 10) : null;
        if (event_id && isNaN(finalEventId)) {
            throw new Error('Invalid event ID');
        }

        const query = `
            INSERT INTO scheduled_streams (title, scheduled_start, facebook_live_url, event_id, status)
            VALUES ($1, $2, $3, $4, 'scheduled')
            RETURNING *
        `;
        const result = await db.query(query, [title.trim(), start, facebook_live_url || null, finalEventId]);
        const newStream = result.rows[0];

        await auditService.log({
            user_id: userId,
            action: auditService.AUDIT_ACTIONS.STREAM_SCHEDULED,
            entity_type: 'scheduled_stream',
            entity_id: String(newStream.id),
            after_state: newStream,
            description: `Scheduled stream "${newStream.title}" for ${newStream.scheduled_start}`,
            ip_address: ipAddress
        });

        await this.invalidateCaches();

        return newStream;
    }

    async updateScheduledStream(id, data, userId, ipAddress) {
        const existing = await this.getScheduledStreamById(id);
        if (!existing) {
            throw new Error('Stream not found');
        }

        if (existing.status === 'completed' || existing.status === 'canceled') {
            throw new Error(`Cannot update a ${existing.status} stream`);
        }

        const { title, scheduled_start, facebook_live_url, event_id } = data;
        
        if (!title || typeof title !== 'string' || !title.trim()) {
            throw new Error('Title is required');
        }
        if (title.length > 255) {
            throw new Error('Title cannot exceed 255 characters');
        }

        const start = parseScheduledDate(scheduled_start);
        if (isNaN(start.getTime())) {
            throw new Error('Invalid scheduled start date');
        }
        // Only require future dates for streams that are still scheduled
        if (existing.status === 'scheduled' && start.getTime() <= Date.now()) {
            throw new Error('Scheduled start date must be in the future');
        }

        if (facebook_live_url && !isAllowedProviderUrl(facebook_live_url)) {
            throw new Error('Invalid Facebook Live URL. Must be a secure (HTTPS) URL from facebook.com or fb.watch.');
        }

        // Active streams must retain a valid Facebook Live URL
        if (existing.status === 'active' && !facebook_live_url) {
            throw new Error('Cannot remove Facebook Live URL from an active stream');
        }

        const finalEventId = event_id ? parseInt(event_id, 10) : null;
        if (event_id && isNaN(finalEventId)) {
            throw new Error('Invalid event ID');
        }

        const query = `
            UPDATE scheduled_streams
            SET title = $1, scheduled_start = $2, facebook_live_url = $3, event_id = $4, updated_at = NOW()
            WHERE id = $5
            RETURNING *
        `;
        const result = await db.query(query, [title.trim(), start, facebook_live_url || null, finalEventId, id]);
        const updatedStream = result.rows[0];

        await auditService.log({
            user_id: userId,
            action: auditService.AUDIT_ACTIONS.STREAM_UPDATED,
            entity_type: 'scheduled_stream',
            entity_id: String(id),
            before_state: existing,
            after_state: updatedStream,
            description: `Updated scheduled stream "${updatedStream.title}"`,
            ip_address: ipAddress
        });

        await this.invalidateCaches();

        return updatedStream;
    }

    async cancelScheduledStream(id, userId, ipAddress) {
        const existing = await this.getScheduledStreamById(id);
        if (!existing) {
            throw new Error('Stream not found');
        }

        if (existing.status !== 'scheduled') {
            throw new Error(`Cannot cancel a stream that is ${existing.status}`);
        }

        const query = `
            UPDATE scheduled_streams
            SET status = 'canceled', updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `;
        const result = await db.query(query, [id]);
        const updatedStream = result.rows[0];

        await auditService.log({
            user_id: userId,
            action: auditService.AUDIT_ACTIONS.STREAM_CANCELLED,
            entity_type: 'scheduled_stream',
            entity_id: String(id),
            before_state: existing,
            after_state: updatedStream,
            description: `Canceled scheduled stream "${updatedStream.title}"`,
            ip_address: ipAddress
        });

        await this.invalidateCaches();

        return updatedStream;
    }

    async activateScheduledStream(id, userId, ipAddress) {
        const existing = await this.getScheduledStreamById(id);
        if (!existing) {
            throw new Error('Stream not found');
        }

        if (existing.status !== 'scheduled') {
            throw new Error(`Cannot start a stream that is ${existing.status}`);
        }

        if (!existing.facebook_live_url) {
            throw new Error('Cannot start a stream without a Facebook Live URL');
        }

        // Complete any other active streams first, with audit logging
        const activeStreams = await db.query(`SELECT * FROM scheduled_streams WHERE status = 'active'`);
        if (activeStreams.rows.length > 0) {
            await db.query(`UPDATE scheduled_streams SET status = 'completed', updated_at = NOW() WHERE status = 'active'`);
            for (const autoCompleted of activeStreams.rows) {
                await auditService.log({
                    user_id: userId,
                    action: auditService.AUDIT_ACTIONS.STREAM_COMPLETED,
                    entity_type: 'scheduled_stream',
                    entity_id: String(autoCompleted.id),
                    before_state: autoCompleted,
                    after_state: { ...autoCompleted, status: 'completed' },
                    description: `Auto-completed stream "${autoCompleted.title}" (superseded by stream ${id})`,
                    ip_address: ipAddress
                });
            }
        }

        // live_started_at stamps the explicit "Go Live" moment; the public homepage
        // requires it to be within STREAM_MAX_LIVE_HOURS to show the stream as live.
        const query = `
            UPDATE scheduled_streams
            SET status = 'active', live_started_at = NOW(), updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `;
        const result = await db.query(query, [id]);
        const updatedStream = result.rows[0];

        await auditService.log({
            user_id: userId,
            action: auditService.AUDIT_ACTIONS.STREAM_ACTIVATED,
            entity_type: 'scheduled_stream',
            entity_id: String(id),
            before_state: existing,
            after_state: updatedStream,
            description: `Started live stream "${updatedStream.title}"`,
            ip_address: ipAddress
        });

        await this.invalidateCaches();

        return updatedStream;
    }

    async completeScheduledStream(id, userId, ipAddress) {
        const existing = await this.getScheduledStreamById(id);
        if (!existing) {
            throw new Error('Stream not found');
        }

        if (existing.status !== 'active') {
            throw new Error(`Cannot stop a stream that is ${existing.status}`);
        }

        const query = `
            UPDATE scheduled_streams
            SET status = 'completed', updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `;
        const result = await db.query(query, [id]);
        const updatedStream = result.rows[0];

        await auditService.log({
            user_id: userId,
            action: auditService.AUDIT_ACTIONS.STREAM_COMPLETED,
            entity_type: 'scheduled_stream',
            entity_id: String(id),
            before_state: existing,
            after_state: updatedStream,
            description: `Completed live stream "${updatedStream.title}"`,
            ip_address: ipAddress
        });

        await this.invalidateCaches();

        return updatedStream;
    }

    async invalidateCaches() {
        await CacheService.del(CACHE_KEY);
        // EventService caches the merged event list per visibility scope; a stream
        // change alters that merge, so bust both scoped keys (+ the legacy key) or
        // the homepage keeps serving the pre-merge list for the cache TTL.
        await CacheService.del('event:all:public');
        await CacheService.del('event:all:members');
        await CacheService.del('event:all');
    }
}

module.exports = new StreamingService();
// Exported for reuse by the past-videos sources (src/services/pastVideos): the embed
// builder keeps live + past-video embeds identical and CSP-safe; the URL validator
// gates curated entries to facebook.com / fb.watch.
module.exports.convertToEmbedUrl = convertToEmbedUrl;
module.exports.isAllowedProviderUrl = isAllowedProviderUrl;
