const MemberDirectoryService = require('../services/MemberDirectoryService');
const logger = require('../utils/logger');
const { logAudit, AUDIT_ACTIONS } = require('../services/auditService');

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
        logger.error('Error loading admin directory', { error });
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
        logger.error('Error moderating directory profile', { error });
        return res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to moderate this profile.' });
    }
};

/**
 * GET /admin/directory/export.csv — member-visible export of all LISTED members.
 * Mirrors the donations CSV export: audit-logged, attachment download, no CSRF
 * (read-only GET). Respects each member's show_* flags (MemberDirectoryService).
 */
exports.exportCsv = async (req, res) => {
    try {
        const profiles = await MemberDirectoryService.listAllForExport();
        const csv = MemberDirectoryService.toCsv(profiles);
        logAudit({
            user_id: req.user && req.user.id,
            action: AUDIT_ACTIONS.DIRECTORY_EXPORTED,
            entity_type: 'member_profile',
            description: `Exported member directory (CSV, ${profiles.length} listed members)`
        }).catch((err) => logger.error('Audit log error:', err));
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="member-directory.csv"');
        return res.send(csv);
    } catch (error) {
        logger.error('Error exporting member directory CSV', { error });
        return res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to export the member directory.' });
    }
};

/**
 * GET /admin/directory/export.json — same member-visible records as the CSV.
 */
exports.exportJson = async (req, res) => {
    try {
        const profiles = await MemberDirectoryService.listAllForExport();
        const records = MemberDirectoryService.toExportJson(profiles);
        logAudit({
            user_id: req.user && req.user.id,
            action: AUDIT_ACTIONS.DIRECTORY_EXPORTED,
            entity_type: 'member_profile',
            description: `Exported member directory (JSON, ${profiles.length} listed members)`
        }).catch((err) => logger.error('Audit log error:', err));
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="member-directory.json"');
        return res.send(JSON.stringify(records, null, 2));
    } catch (error) {
        logger.error('Error exporting member directory JSON', { error });
        return res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to export the member directory.' });
    }
};

/**
 * GET /admin/directory/:userId/edit — admin/rabbi edit form for ANY member's listing
 * (item 8). Backed by getProfileForAdmin (full decrypted profile; returns defaults for
 * a member with no profile row yet).
 */
exports.editForm = async (req, res) => {
    try {
        const profile = await MemberDirectoryService.getProfileForAdmin(req.params.userId);
        if (!profile) {
            return res.status(404).render('404', { title: '404 - Member Not Found' });
        }
        res.render('layout', {
            title: 'Edit Member Listing - Admin',
            bodyView: 'admin/directory-edit',
            stylesheets: ['/css/directory.css', '/css/account.css'],
            viewData: {
                profile,
                error: null,
                saved: req.query.saved === '1',
                csrfToken: req.csrfToken ? req.csrfToken() : null
            }
        });
    } catch (error) {
        logger.error('Error loading admin directory edit form', { error });
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load the edit form.' });
    }
};

/**
 * POST /admin/directory/:userId — save an admin edit to any member's listing (item 8).
 * Maps HTML-form checkbox values ("on") to booleans, preserves the structured household
 * via the hidden field, and writes through saveProfileForAdmin (audited as the admin).
 */
exports.update = async (req, res) => {
    const toBool = (v) => v === 'on' || v === 'true' || v === true;
    const targetUserId = req.params.userId;
    const body = req.body || {};
    try {
        await MemberDirectoryService.saveProfileForAdmin(targetUserId, {
            listed: toBool(body.listed),
            show_phone: toBool(body.show_phone),
            show_email: toBool(body.show_email),
            show_household: toBool(body.show_household),
            show_address: toBool(body.show_address),
            show_birthday: toBool(body.show_birthday),
            household_consent: toBool(body.household_consent),
            phone: body.phone,
            address: body.address,
            birthday: body.birthday,
            bio: body.bio,
            interests: body.interests,
            household: body.household
        }, req.user && req.user.id);
        return res.redirect(`/admin/directory/${encodeURIComponent(targetUserId)}/edit?saved=1`);
    } catch (error) {
        logger.warn('Admin directory edit rejected', { error: error.message });
        try {
            const profile = await MemberDirectoryService.getProfileForAdmin(targetUserId);
            if (!profile) {
                return res.status(404).render('404', { title: '404 - Member Not Found' });
            }
            return res.status(400).render('layout', {
                title: 'Edit Member Listing - Admin',
                bodyView: 'admin/directory-edit',
                stylesheets: ['/css/directory.css', '/css/account.css'],
                viewData: { profile, error: error.message, saved: false, csrfToken: req.csrfToken ? req.csrfToken() : null }
            });
        } catch (e) {
            return res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to update the listing.' });
        }
    }
};
