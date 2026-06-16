const MemberDirectoryService = require('../services/MemberDirectoryService');
const logger = require('../utils/logger');

// Normalize query values to strings to avoid array/object edge cases (mirrors recordingController).
const queryString = (value) => (typeof value === 'string' ? value : '');

// The browse page renders ALL listed members on one page so directory-search.js can
// filter live (as-you-type) across everyone — pagination is dropped (a single
// congregation is small). This bounds one page; if a congregation ever exceeds it we
// log so the cap is never silent.
const BROWSE_LIMIT = 500;

/**
 * GET /directory — full browse + name/interest search of LISTED members. Renders every
 * listed member (up to BROWSE_LIMIT) for client-side live filtering; the server-side
 * ?search= path remains as the no-JS fallback.
 */
exports.getDirectory = async (req, res) => {
    try {
        if (Array.isArray(req.query.page)) {
            return res.status(400).render('error', { title: '400 - Invalid Request', message: 'Invalid page number' });
        }
        const rawPage = queryString(req.query.page);
        if (rawPage && !/^[1-9]\d{0,3}$/.test(rawPage)) {
            return res.status(400).render('error', { title: '400 - Invalid Request', message: 'Invalid page number' });
        }
        const page = rawPage ? parseInt(rawPage, 10) : 1;
        if (isNaN(page) || !Number.isInteger(page) || page < 1 || page > 1000) {
            return res.status(400).render('error', { title: '400 - Invalid Request', message: 'Invalid page number' });
        }

        const limit = BROWSE_LIMIT;
        const search = queryString(req.query.search);
        const result = await MemberDirectoryService.listListedProfiles({ search, page, limit });
        if (result.totalCount > BROWSE_LIMIT) {
            logger.warn('Directory listing exceeds the single-page browse cap; some members are not rendered', {
                totalCount: result.totalCount, cap: BROWSE_LIMIT
            });
        }

        // Activation nudge (R20): only for members not yet listed and not dismissed.
        let showNudge = false;
        try {
            const nudge = await MemberDirectoryService.getNudgeState(req.user.id);
            showNudge = !!(nudge && nudge.showNudge);
        } catch (nudgeErr) {
            showNudge = false; // never block the directory on the nudge lookup
        }

        res.render('layout', {
            title: 'Member Directory',
            bodyView: 'directory/index',
            stylesheets: ['/css/directory.css'],
            viewData: {
                profiles: result.profiles,
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                totalCount: result.totalCount,
                filters: { search },
                showNudge,
                csrfToken: req.csrfToken ? req.csrfToken() : null
            }
        });
    } catch (error) {
        logger.error('Error loading member directory', { error });
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load the directory.' });
    }
};

/**
 * GET /directory/:id — a single LISTED member's profile. 404 when not listed.
 */
exports.getProfile = async (req, res) => {
    try {
        const profile = await MemberDirectoryService.getListedProfile(req.params.id);
        if (!profile) {
            return res.status(404).render('404', { title: '404 - Page Not Found' });
        }
        const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Member Profile';
        res.render('layout', {
            title: name,
            bodyView: 'directory/profile',
            stylesheets: ['/css/directory.css'],
            viewData: { profile }
        });
    } catch (error) {
        logger.error('Error loading member profile', { error });
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load this profile.' });
    }
};

/**
 * POST /directory/nudge/dismiss — persist that the member dismissed the activation
 * nudge, then return to the directory.
 */
exports.dismissNudge = async (req, res) => {
    try {
        if (req.user && req.user.id) {
            await MemberDirectoryService.dismissNudge(req.user.id);
        }
    } catch (error) {
        logger.error('Error dismissing directory nudge', { error });
    }
    res.redirect('/directory');
};
