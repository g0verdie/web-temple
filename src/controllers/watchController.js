const PastVideoService = require('../services/pastVideos/PastVideoService');
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

    res.render('layout', {
        title: 'Past Services',
        description: 'Watch past services and recordings from Temple B\'nai Israel. Catch up on sermons, prayers, and community gatherings.',
        bodyView: 'watch/index',
        stylesheets: ['/css/watch.css'],
        viewData: {
            videos,
            degraded,
            facebookPageUrl: FACEBOOK_PAGE_URL
        }
    });
};
