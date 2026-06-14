const MemberDirectoryService = require('../services/MemberDirectoryService');

const queryString = (value) => (typeof value === 'string' ? value : '');

/**
 * GET /admin/directory — list ALL members (listed or not) for admins (R16).
 */
exports.getDirectoryAdmin = async (req, res) => {
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
        const result = await MemberDirectoryService.listAllMembersForAdmin({ search, page, limit });

        res.render('layout', {
            title: 'Admin - Member Directory',
            bodyView: 'admin/directory',
            stylesheets: ['/css/directory.css'],
            viewData: {
                members: result.members,
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                totalCount: result.totalCount,
                filters: { search },
                csrfToken: req.csrfToken ? req.csrfToken() : null
            }
        });
    } catch (error) {
        console.error('Error loading admin directory:', error);
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load the member directory.' });
    }
};

/**
 * POST /admin/directory/moderate — unlist and/or clear offending free-text (R17).
 * clearFields is validated against the service's MODERATABLE_FIELDS allow-list.
 */
exports.moderate = async (req, res) => {
    try {
        const userId = (req.body && req.body.user_id) || null;
        if (!userId) {
            return res.status(400).render('error', { title: '400 - Invalid Request', message: 'A member is required for moderation.' });
        }
        const unlist = req.body.unlist === 'on' || req.body.unlist === 'true' || req.body.unlist === true;
        let clearFields = (req.body && req.body.clearFields) || [];
        if (typeof clearFields === 'string') clearFields = [clearFields];

        await MemberDirectoryService.moderateProfile(userId, {
            unlist,
            clearFields,
            actorId: req.user && req.user.id
        });
        return res.redirect('/admin/directory');
    } catch (error) {
        console.error('Error moderating directory profile:', error);
        return res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to moderate this profile.' });
    }
};
