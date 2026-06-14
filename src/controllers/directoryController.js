const MemberDirectoryService = require('../services/MemberDirectoryService');

// Normalize query values to strings to avoid array/object edge cases (mirrors recordingController).
const queryString = (value) => (typeof value === 'string' ? value : '');

/**
 * GET /directory — paginated browse + name/interest search of LISTED members.
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

        const limit = 20;
        const search = queryString(req.query.search);
        const result = await MemberDirectoryService.listListedProfiles({ search, page, limit });

        res.render('layout', {
            title: 'Member Directory',
            bodyView: 'directory/index',
            stylesheets: ['/css/directory.css'],
            viewData: {
                profiles: result.profiles,
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                totalCount: result.totalCount,
                filters: { search }
            }
        });
    } catch (error) {
        console.error('Error loading member directory:', error);
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
        console.error('Error loading member profile:', error);
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load this profile.' });
    }
};
