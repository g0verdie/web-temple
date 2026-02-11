const CacheService = require('./CacheService');

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

        // In a real app, this would be a DB query
        const events = upcomingEvents;

        // Cache for 5 minutes
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
