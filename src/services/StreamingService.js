const CacheService = require('./CacheService');

const CACHE_KEY = 'stream:public-embed';
const CACHE_TTL_SECONDS = 30;
const DEFAULT_TITLE = "Temple B'nai Israel Live Service";

const parseBoolean = (value) => typeof value === 'string' && value.toLowerCase() === 'true';

const isAllowedProviderUrl = (value) => {
    if (!value) {
        return false;
    }

    try {
        const url = new URL(value);
        // Require HTTPS for security; allow facebook.com and fb.watch domains only
        if (url.protocol !== 'https:') {
            return false;
        }
        return url.hostname.endsWith('facebook.com') || url.hostname === 'fb.watch';
    } catch (error) {
        return false;
    }
};

const buildInactiveState = () => ({
    provider: 'facebook',
    status: 'inactive',
    isLive: false,
    title: process.env.FACEBOOK_LIVE_TITLE || DEFAULT_TITLE,
    embedUrl: null,
    watchUrl: null,
    scheduledStart: process.env.FACEBOOK_LIVE_SCHEDULED_START || null,
    thumbnailUrl: process.env.FACEBOOK_LIVE_THUMBNAIL_URL || null
});

const buildUnavailableState = () => ({
    provider: 'facebook',
    status: 'unavailable',
    isLive: false,
    title: process.env.FACEBOOK_LIVE_TITLE || DEFAULT_TITLE,
    embedUrl: null,
    watchUrl: isAllowedProviderUrl(process.env.FACEBOOK_LIVE_WATCH_URL) ? process.env.FACEBOOK_LIVE_WATCH_URL : null,
    scheduledStart: process.env.FACEBOOK_LIVE_SCHEDULED_START || null,
    thumbnailUrl: process.env.FACEBOOK_LIVE_THUMBNAIL_URL || null
});

const buildLiveState = () => ({
    provider: 'facebook',
    status: 'live',
    isLive: true,
    title: process.env.FACEBOOK_LIVE_TITLE || DEFAULT_TITLE,
    embedUrl: process.env.FACEBOOK_LIVE_EMBED_URL,
    watchUrl: isAllowedProviderUrl(process.env.FACEBOOK_LIVE_WATCH_URL) ? process.env.FACEBOOK_LIVE_WATCH_URL : null,
    scheduledStart: process.env.FACEBOOK_LIVE_SCHEDULED_START || null,
    thumbnailUrl: process.env.FACEBOOK_LIVE_THUMBNAIL_URL || null
});

class StreamingService {
    async getPublicEmbedMetadata() {
        const cached = await CacheService.get(CACHE_KEY);
        if (cached) {
            return cached;
        }

        let metadata;

        if (parseBoolean(process.env.STREAM_PROVIDER_UNAVAILABLE)) {
            metadata = buildUnavailableState();
        } else if (!parseBoolean(process.env.FACEBOOK_LIVE_IS_ACTIVE)) {
            metadata = buildInactiveState();
        } else if (!isAllowedProviderUrl(process.env.FACEBOOK_LIVE_EMBED_URL)) {
            metadata = buildUnavailableState();
        } else {
            metadata = buildLiveState();
        }

        await CacheService.set(CACHE_KEY, metadata, CACHE_TTL_SECONDS);
        return metadata;
    }
}

module.exports = new StreamingService();
