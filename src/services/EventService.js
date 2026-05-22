const CacheService = require('./CacheService');
const StreamingService = require('./StreamingService');
const logger = require('../utils/logger');

// Static data moved from homeController
const upcomingEvents = [
    {
        id: 1,
        title: 'Kabbalat Shabbat Service',
        date: new Date('2026-02-07T19:00:00'),
        description: 'Join us for our welcoming Shabbat service with Rabbi Sarah',
        type: 'service',
        location: 'Main Sanctuary'
    },
    {
        id: 2,
        title: 'Shabbat Morning Service',
        date: new Date('2026-02-08T10:00:00'),
        description: 'Traditional Shabbat morning service and Torah study',
        type: 'service',
        location: 'Main Sanctuary'
    },
    {
        id: 3,
        title: 'Tu B\'Shvat Celebration',
        date: new Date('2026-02-12T18:30:00'),
        description: 'Celebrate the New Year for Trees with family activities',
        type: 'event',
        location: 'Community Hall'
    }
];

class EventService {
    /**
     * Get all upcoming events
     * @returns {Promise<Array>} Array of events
     */
    async getEvents() {
        const cacheKey = 'event:all';
        const cachedEvents = await CacheService.get(cacheKey);

        if (cachedEvents) {
            // Need to convert date strings back to Date objects
            return cachedEvents.map(event => ({
                ...event,
                date: new Date(event.date)
            }));
        }

        // Clone upcomingEvents so we do not mutate the static array directly
        const events = upcomingEvents.map(e => ({ ...e }));

        try {
            // Fetch scheduled and active streams
            const scheduledStreams = await StreamingService.getScheduledStreams();

            const activeAndScheduled = scheduledStreams.filter(
                stream => stream.status === 'scheduled' || stream.status === 'active'
            );

            for (const stream of activeAndScheduled) {
                if (stream.event_id) {
                    // Coerce to number for safe comparison (event_id may arrive as string from DB or forms)
                    const matchedEvent = events.find(e => Number(e.id) === Number(stream.event_id));
                    if (matchedEvent) {
                        matchedEvent.hasLiveStream = true;
                        matchedEvent.facebookLiveUrl = stream.facebook_live_url;
                        matchedEvent.streamStatus = stream.status;
                        matchedEvent.description = `${matchedEvent.description} (This service will be livestreamed.)`;
                        continue;
                    }
                }
                
                // If not linked to an in-memory event, dynamically construct a calendar event
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
            // Do NOT cache degraded results — return them uncached so the next
            // request retries the DB query instead of serving stale data.
            return events;
        }

        // Cache for 5 minutes (only when streams were merged successfully)
        await CacheService.set(cacheKey, events, 300);

        return events;
    }

    /**
     * Get next service
     * @returns {Promise<Object|null>} Next service
     */
    async getNextService() {
        const events = await this.getEvents();
        const now = new Date();

        const upcomingServices = events
            .filter(event => event.type === 'service' && event.date > now)
            .sort((a, b) => a.date - b.date);

        return upcomingServices[0] || null;
    }

    /**
     * Get upcoming events (limited)
     * @param {number} limit 
     * @returns {Promise<Array>}
     */
    async getUpcomingEvents(limit = 3) {
        const events = await this.getEvents();
        const now = new Date();
        return events
            .filter(event => event.date > now)
            .sort((a, b) => a.date - b.date)
            .slice(0, limit);
    }

    /**
     * Create new event
     * @param {Object} eventData - Event data
     * @returns {Promise<Object>} Created event
     */
    async create(eventData) {
        // In real implementation, this would insert to DB
        const newEvent = {
            id: upcomingEvents.length + 1,
            ...eventData,
            date: new Date(eventData.date)
        };
        upcomingEvents.push(newEvent);

        // Invalidate cache
        await CacheService.del('event:all');

        return newEvent;
    }

    /**
     * Update event
     * @param {number} id - Event ID
     * @param {Object} eventData - Updated event data
     * @returns {Promise<Object>} Updated event
     */
    async update(id, eventData) {
        // In real implementation, this would update DB
        const index = upcomingEvents.findIndex(e => e.id === id);
        if (index === -1) {
            throw new Error('Event not found');
        }

        upcomingEvents[index] = {
            ...upcomingEvents[index],
            ...eventData,
            date: new Date(eventData.date)
        };

        // Invalidate cache
        await CacheService.del('event:all');
        await CacheService.del(`event:${id}`);

        return upcomingEvents[index];
    }

    /**
     * Delete event
     * @param {number} id - Event ID
     * @returns {Promise<boolean>} Success
     */
    async delete(id) {
        // In real implementation, this would delete from DB
        const index = upcomingEvents.findIndex(e => e.id === id);
        if (index === -1) {
            throw new Error('Event not found');
        }

        upcomingEvents.splice(index, 1);

        // Invalidate cache
        await CacheService.del('event:all');
        await CacheService.del(`event:${id}`);

        return true;
    }
}

module.exports = new EventService();
