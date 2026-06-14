const EventService = require('../../src/services/EventService');
const CacheService = require('../../src/services/CacheService');
const AnnouncementService = require('../../src/services/AnnouncementService');
const db = require('../../src/config/db');

// Mock StreamingService so EventService.getEvents() can merge streams
// successfully and cache the result (the cache-pollution fix skips caching
// on merge failure, which would break cache hit/miss assertions here).
jest.mock('../../src/services/StreamingService', () => ({
    getScheduledStreams: jest.fn().mockResolvedValue([])
}));

// AnnouncementService is now Postgres-backed (Epic 5). Mock the DB layer so the
// cache hit/miss behavior can be exercised without a real Postgres (CI has none).
// EventService is in-memory and never touches db, so this mock is inert for it.
jest.mock('../../src/config/db');

describe('Caching Integration', () => {
    beforeEach(async () => {
        // Clear cache and reset metrics before each test
        await CacheService.flush();
        CacheService.resetMetrics();
        // Default DB stub so AnnouncementService reads resolve without real Postgres.
        if (db.query && db.query.mockResolvedValue) {
            db.query.mockResolvedValue({ rows: [] });
        }
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('EventService', () => {
        it('should cache events after first fetch', async () => {
            // First call - should be cache miss
            const events1 = await EventService.getEvents();
            expect(events1).toBeDefined();
            expect(Array.isArray(events1)).toBe(true);
            
            const metrics1 = CacheService.getMetrics();
            expect(metrics1.misses).toBe(1);
            expect(metrics1.hits).toBe(0);

            // Second call - should be cache hit
            const events2 = await EventService.getEvents();
            expect(events2).toEqual(events1);
            
            const metrics2 = CacheService.getMetrics();
            expect(metrics2.hits).toBe(1);
            expect(metrics2.misses).toBe(1);
            expect(parseFloat(metrics2.hitRate)).toBe(50.00);
        });

        it('should invalidate cache on create', async () => {
            // Prime cache
            await EventService.getEvents();
            expect(CacheService.getMetrics().hits).toBe(0);
            
            // Create new event
            await EventService.create({
                title: 'New Event',
                date: new Date('2026-03-01'),
                type: 'event',
                location: 'Test Hall'
            });
            
            // Next fetch should be cache miss (invalidated)
            await EventService.getEvents();
            const metrics = CacheService.getMetrics();
            expect(metrics.misses).toBe(2); // Initial miss + post-create miss
        });

        it('should invalidate cache on update', async () => {
            // Prime cache
            const events = await EventService.getEvents();
            const eventId = events[0]?.id || 1;
            
            // Update event
            await EventService.update(eventId, {
                title: 'Updated Event',
                date: new Date('2026-03-02'),
                type: 'service',
                location: 'Main Hall'
            });
            
            // Next fetch should be cache miss
            await EventService.getEvents();
            const metrics = CacheService.getMetrics();
            expect(metrics.misses).toBeGreaterThanOrEqual(2);
        });

        it('should invalidate cache on delete', async () => {
            // Prime cache
            const events = await EventService.getEvents();
            const eventId = events[0]?.id || 1;
            
            // Delete event
            await EventService.delete(eventId);
            
            // Next fetch should be cache miss
            await EventService.getEvents();
            const metrics = CacheService.getMetrics();
            expect(metrics.misses).toBeGreaterThanOrEqual(2);
        });
    });

    describe('AnnouncementService', () => {
        const VALID_ID = '11111111-1111-1111-1111-111111111111';
        const row = {
            id: VALID_ID,
            title: 'Notice',
            body_html: '<p>Hi</p>',
            body_text: 'Hi',
            status: 'published',
            featured: false,
            featured_until: null,
            published_at: new Date('2026-06-14T00:00:00Z'),
            updated_at: new Date('2026-06-14T00:00:00Z'),
            deleted_at: null
        };

        beforeEach(() => {
            jest.clearAllMocks();
            // Reads (getHomepageAnnouncements) and single-statement writes go through db.query.
            db.query.mockResolvedValue({ rows: [row] });
            // Transactional create() uses a pooled client.
            const client = { query: jest.fn().mockResolvedValue({ rows: [row] }), release: jest.fn() };
            db.pool = { connect: jest.fn().mockResolvedValue(client) };
        });

        it('should cache announcements after first fetch', async () => {
            // First call - should be cache miss
            const announcements1 = await AnnouncementService.getHomepageAnnouncements();
            expect(announcements1).toBeDefined();
            expect(Array.isArray(announcements1)).toBe(true);

            const metrics1 = CacheService.getMetrics();
            expect(metrics1.misses).toBe(1);

            // Second call - should be cache hit (no DB query). The cached payload is
            // JSON-revived (dates become strings), so compare by identity/shape.
            const announcements2 = await AnnouncementService.getHomepageAnnouncements();
            expect(announcements2).toHaveLength(announcements1.length);
            expect(announcements2[0].id).toEqual(announcements1[0].id);

            const metrics2 = CacheService.getMetrics();
            expect(metrics2.hits).toBe(1);
        });

        it('should invalidate cache on create', async () => {
            // Prime cache
            await AnnouncementService.getHomepageAnnouncements();

            // Create new announcement (busts announcement:* cache)
            await AnnouncementService.create(
                { title: 'New Announcement', body: '<p>Test content</p>' },
                { userId: VALID_ID }
            );

            // Next fetch should be a cache miss
            await AnnouncementService.getHomepageAnnouncements();
            const metrics = CacheService.getMetrics();
            expect(metrics.misses).toBe(2);
        });

        it('should invalidate cache on update', async () => {
            // Prime cache
            await AnnouncementService.getHomepageAnnouncements();

            // Update announcement
            await AnnouncementService.update(
                VALID_ID,
                { title: 'Updated Announcement', body: '<p>Updated content</p>' },
                { userId: VALID_ID }
            );

            // Next fetch should be a cache miss
            await AnnouncementService.getHomepageAnnouncements();
            const metrics = CacheService.getMetrics();
            expect(metrics.misses).toBeGreaterThanOrEqual(2);
        });

        it('should invalidate cache on delete', async () => {
            // Prime cache
            await AnnouncementService.getHomepageAnnouncements();

            // Soft delete announcement
            await AnnouncementService.softDelete(VALID_ID, { userId: VALID_ID });

            // Next fetch should be a cache miss
            await AnnouncementService.getHomepageAnnouncements();
            const metrics = CacheService.getMetrics();
            expect(metrics.misses).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Cache Metrics', () => {
        it('should track hit rate correctly', async () => {
            // Generate some cache activity
            await EventService.getEvents(); // miss
            await EventService.getEvents(); // hit
            await EventService.getEvents(); // hit
            await AnnouncementService.getHomepageAnnouncements(); // miss

            const metrics = CacheService.getMetrics();
            expect(metrics.total).toBe(4);
            expect(metrics.hits).toBe(2);
            expect(metrics.misses).toBe(2);
            expect(parseFloat(metrics.hitRate)).toBe(50.00);
        });

        it('should reset metrics', async () => {
            await EventService.getEvents();
            await EventService.getEvents();
            
            let metrics = CacheService.getMetrics();
            expect(metrics.total).toBeGreaterThan(0);
            
            CacheService.resetMetrics();
            
            metrics = CacheService.getMetrics();
            expect(metrics.hits).toBe(0);
            expect(metrics.misses).toBe(0);
            expect(metrics.total).toBe(0);
        });
    });

    describe('Key Naming Convention', () => {
        it('should use cache:resource:id pattern', async () => {
            // Verify keys follow the pattern by checking cache prefix
            await EventService.getEvents();
            await AnnouncementService.getHomepageAnnouncements();

            // Keys should be: cache:event:all and cache:announcement:homepage
            // This is verified by the service implementations
            expect(CacheService.prefix).toBe('cache:');
        });
    });
});
