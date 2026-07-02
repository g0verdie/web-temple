const CacheService = require('../../src/services/CacheService');

jest.mock('../../src/services/CacheService', () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn()
}));

describe('StreamingService', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env.FACEBOOK_LIVE_IS_ACTIVE;
        delete process.env.FACEBOOK_LIVE_EMBED_URL;
        delete process.env.FACEBOOK_LIVE_WATCH_URL;
        delete process.env.FACEBOOK_LIVE_TITLE;
        delete process.env.FACEBOOK_LIVE_SCHEDULED_START;
        delete process.env.FACEBOOK_LIVE_THUMBNAIL_URL;
        delete process.env.STREAM_PROVIDER_UNAVAILABLE;
        CacheService.get.mockResolvedValue(null);
        CacheService.set.mockResolvedValue(true);
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('invalidateCaches busts the visibility-scoped event cache keys so the homepage refreshes', async () => {
        // EventService caches the merged event list under event:all:public / :members;
        // a stream mutation must bust both or the homepage serves the pre-merge list.
        // beforeEach calls jest.resetModules(), so require CacheService fresh here to
        // get the same mocked instance the re-required StreamingService uses.
        const StreamingService = require('../../src/services/StreamingService');
        const cache = require('../../src/services/CacheService');
        await StreamingService.invalidateCaches();
        expect(cache.del).toHaveBeenCalledWith('event:all:public');
        expect(cache.del).toHaveBeenCalledWith('event:all:members');
    });

    it('returns offline state when no active stream or future scheduled start is configured', async () => {
        const StreamingService = require('../../src/services/StreamingService');

        const stream = await StreamingService.getPublicEmbedMetadata();

        expect(stream.status).toBe('offline');
        expect(stream.statusLabel).toBe('Offline');
        expect(stream.archiveCta).toBe(true);
        expect(stream.message).toBe('The livestream is currently offline. Please view our past recordings.');
        expect(stream.embedUrl).toBeNull();
    });

    it('returns live state for an active Facebook stream', async () => {
        process.env.FACEBOOK_LIVE_IS_ACTIVE = 'true';
        process.env.FACEBOOK_LIVE_EMBED_URL = 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Ftemple%2Fvideos%2F123';
        process.env.FACEBOOK_LIVE_WATCH_URL = 'https://www.facebook.com/temple/videos/123';
        process.env.FACEBOOK_LIVE_TITLE = 'Friday Evening Shabbat Service';

        const StreamingService = require('../../src/services/StreamingService');

        const stream = await StreamingService.getPublicEmbedMetadata();

        expect(stream.status).toBe('live');
        expect(stream.statusLabel).toBe('LIVE NOW');
        expect(stream.embedUrl).toContain('facebook.com');
        expect(stream.watchUrl).toContain('facebook.com');
        expect(stream.title).toBe('Friday Evening Shabbat Service');
    });

    it('returns error state when an active stream has an invalid provider URL', async () => {
        process.env.FACEBOOK_LIVE_IS_ACTIVE = 'true';
        process.env.FACEBOOK_LIVE_EMBED_URL = 'https://evilfacebook.com/plugins/video.php?href=123';

        const StreamingService = require('../../src/services/StreamingService');

        const stream = await StreamingService.getPublicEmbedMetadata();

        expect(stream.status).toBe('error');
        expect(stream.statusLabel).toBe('Stream Error');
        expect(stream.fallbackUrl).toBe('https://www.facebook.com/share/18jfSPTgMw/');
    });

    it('accepts subdomains of facebook.com as valid providers', async () => {
        process.env.FACEBOOK_LIVE_IS_ACTIVE = 'true';
        process.env.FACEBOOK_LIVE_EMBED_URL = 'https://www.facebook.com/plugins/video.php?href=123';
        process.env.FACEBOOK_LIVE_WATCH_URL = 'https://m.facebook.com/temple/videos/123';

        const StreamingService = require('../../src/services/StreamingService');

        const stream = await StreamingService.getPublicEmbedMetadata();

        expect(stream.status).toBe('live');
        expect(stream.embedUrl).toContain('facebook.com');
        expect(stream.watchUrl).toContain('facebook.com');
    });

    it('returns upcoming state when scheduled start is in the future and stream is not active', async () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        process.env.FACEBOOK_LIVE_SCHEDULED_START = futureDate;
        
        const StreamingService = require('../../src/services/StreamingService');

        const stream = await StreamingService.getPublicEmbedMetadata();

        expect(stream.status).toBe('upcoming');
        expect(stream.statusLabel).toBe('Upcoming');
        expect(stream.scheduledStart).toBe(futureDate);
        expect(stream.countdownTarget).toBe(futureDate);
        expect(stream.message).toBe('The livestream will begin shortly.');
    });

    it('exposes a temple-timezone preformatted scheduledStart label on the upcoming state', async () => {
        // A fixed far-future summer instant so the env-fallback upcoming path is always taken.
        // 19:00 UTC on 2099-07-04 == 2:00 PM CDT in the temple zone.
        process.env.FACEBOOK_LIVE_SCHEDULED_START = '2099-07-04T19:00:00Z';
        process.env.TEMPLE_TIMEZONE = 'America/Chicago';

        const StreamingService = require('../../src/services/StreamingService');

        const stream = await StreamingService.getPublicEmbedMetadata();

        expect(stream.status).toBe('upcoming');
        // The API must ship a pre-formatted temple-zone string so the client never
        // reformats the instant in the viewer's local timezone (cross-surface drift).
        expect(stream.formattedScheduledStart).toBe('Saturday, July 4, 2099 at 2:00 PM');
    });

    it('returns error state when provider is flagged unavailable', async () => {
        process.env.STREAM_PROVIDER_UNAVAILABLE = 'true';
        process.env.FACEBOOK_LIVE_WATCH_URL = 'https://www.facebook.com/temple/videos/123';

        const StreamingService = require('../../src/services/StreamingService');

        const stream = await StreamingService.getPublicEmbedMetadata();

        expect(stream.status).toBe('error');
        expect(stream.statusLabel).toBe('Stream Error');
        expect(stream.fallbackUrl).toBe('https://www.facebook.com/temple/videos/123');
        expect(stream.message).toBe('The streaming provider is currently unavailable. Please watch directly on Facebook.');
    });

    it('returns error state with default fallback URL when watchUrl is invalid', async () => {
        process.env.STREAM_PROVIDER_UNAVAILABLE = 'true';
        process.env.FACEBOOK_LIVE_WATCH_URL = 'invalid-url';

        const StreamingService = require('../../src/services/StreamingService');

        const stream = await StreamingService.getPublicEmbedMetadata();

        expect(stream.status).toBe('error');
        expect(stream.statusLabel).toBe('Stream Error');
        expect(stream.fallbackUrl).toBe('https://www.facebook.com/share/18jfSPTgMw/'); // Assume default fallback URL
        expect(stream.message).toBe('The streaming provider is currently unavailable. Please watch directly on Facebook.');
    });
});