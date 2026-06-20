const PastVideoService = require('../services/pastVideos/PastVideoService');
const StreamingService = require('../services/StreamingService');
const logger = require('../utils/logger');

// The temple's public Facebook page — the empty/degraded state links here.
const FACEBOOK_PAGE_URL = 'https://www.facebook.com/share/18jfSPTgMw/';

exports.getWatchPage = async (req, res) => {
    let videos = [];
    let degraded = false;

    try {
        const result = await PastVideoService.getVideos();
        videos = result.videos || [];
        degraded = !!result.degraded;
    } catch (error) {
        // PastVideoService is built not to throw, but never let /watch 500.
        logger.warn('watchController falling back to empty state', { error: error && error.message });
        degraded = true;
    }

    // Surface the current live stream on Watch too (the homepage keeps its
    // hero). Only the live case is shown here; never let the lookup 500 /watch.
    let liveStream = null;
    try {
        const meta = await StreamingService.getPublicEmbedMetadata();
        if (meta && meta.status === 'live' && meta.embedUrl) {
            liveStream = { embedUrl: meta.embedUrl, title: meta.title };
        }
    } catch (error) {
        logger.warn('watchController live lookup failed', { error: error && error.message });
    }

    // VideoObject structured data (schema.org) for the featured (first) video.
    // Top-level layout render local (U6) — viewData keys never reach <head>.
    const featured = videos[0];
    const jsonLd = featured ? {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: featured.title,
        description: `Past service recording from Temple B'nai Israel: ${featured.title}`,
        thumbnailUrl: featured.thumbnailUrl || undefined,
        embedUrl: featured.embedUrl || undefined,
        uploadDate: (featured.date && !Number.isNaN(new Date(featured.date).getTime()))
            ? new Date(featured.date).toISOString()
            : undefined
    } : undefined;

    res.render('layout', {
        title: 'Past Services',
        description: 'Watch past services and recordings from Temple B\'nai Israel. Catch up on sermons, prayers, and community gatherings.',
        jsonLd,
        bodyView: 'watch/index',
        stylesheets: ['/css/watch.css'],
        viewData: {
            videos,
            degraded,
            facebookPageUrl: FACEBOOK_PAGE_URL,
            liveStream
        }
    });
};
