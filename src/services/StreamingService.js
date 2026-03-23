const CacheService = require('./CacheService');

const CACHE_KEY = 'stream:public-embed';
const CACHE_TTL_SECONDS = 30;
const DEFAULT_TITLE = "Temple B'nai Israel Live Service";
const DEFAULT_FALLBACK_URL = "https://www.facebook.com/TempleBnaiIsrael";

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
        } else if (parseBoolean(process.env.FACEBOOK_LIVE_IS_ACTIVE) && isAllowedProviderUrl(process.env.FACEBOOK_LIVE_EMBED_URL)) {
            metadata = buildLiveState();
        } else if (parseBoolean(process.env.FACEBOOK_LIVE_IS_ACTIVE)) {
            metadata = buildErrorState();
        } else if (process.env.FACEBOOK_LIVE_SCHEDULED_START && new Date(process.env.FACEBOOK_LIVE_SCHEDULED_START).getTime() > Date.now()) {
            metadata = buildUpcomingState(process.env.FACEBOOK_LIVE_SCHEDULED_START);
        } else {
            metadata = buildOfflineState();
        }

        await CacheService.set(CACHE_KEY, metadata, CACHE_TTL_SECONDS);
        return metadata;
    }
}

module.exports = new StreamingService();
