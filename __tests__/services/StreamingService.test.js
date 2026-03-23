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

    it('returns an inactive public stream model when no active stream is configured', async () => {
        const StreamingService = require('../../src/services/StreamingService');

        const stream = await StreamingService.getPublicEmbedMetadata();

        expect(stream.status).toBe('inactive');
        expect(stream.isLive).toBe(false);
        expect(stream.embedUrl).toBeNull();
    });

    it('returns normalized live embed metadata for an active Facebook stream', async () => {
        process.env.FACEBOOK_LIVE_IS_ACTIVE = 'true';
        process.env.FACEBOOK_LIVE_EMBED_URL = 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Ftemple%2Fvideos%2F123';
        process.env.FACEBOOK_LIVE_WATCH_URL = 'https://www.facebook.com/temple/videos/123';
        process.env.FACEBOOK_LIVE_TITLE = 'Friday Evening Shabbat Service';
        process.env.FACEBOOK_LIVE_SCHEDULED_START = '2026-03-27T19:00:00.000Z';

        const StreamingService = require('../../src/services/StreamingService');

        const stream = await StreamingService.getPublicEmbedMetadata();

        expect(stream.status).toBe('live');
        expect(stream.isLive).toBe(true);
        expect(stream.provider).toBe('facebook');
        expect(stream.embedUrl).toContain('facebook.com');
        expect(stream.watchUrl).toContain('facebook.com');
        expect(stream.title).toBe('Friday Evening Shabbat Service');
    });

    it('returns unavailable when an active stream is configured with an invalid embed URL', async () => {
        process.env.FACEBOOK_LIVE_IS_ACTIVE = 'true';
        process.env.FACEBOOK_LIVE_EMBED_URL = 'https://example.com/not-facebook';

        const StreamingService = require('../../src/services/StreamingService');

        const stream = await StreamingService.getPublicEmbedMetadata();

        expect(stream.status).toBe('unavailable');
        expect(stream.isLive).toBe(false);
    });

    it('returns unavailable when embed URL uses http instead of https', async () => {
        process.env.FACEBOOK_LIVE_IS_ACTIVE = 'true';
        process.env.FACEBOOK_LIVE_EMBED_URL = 'http://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Ftemple%2Fvideos%2F123';

        const StreamingService = require('../../src/services/StreamingService');

        const stream = await StreamingService.getPublicEmbedMetadata();

        expect(stream.status).toBe('unavailable');
        expect(stream.isLive).toBe(false);
    });
});