/**
 * controllers/adminMembersController.js
 * Admin/Rabbi member-approval queue (two-gate registration, backlog item 6).
 * Gated by MANAGE_MEMBERS in the route.
 */
const memberAdminService = require('../services/memberAdminService');
const logger = require('../utils/logger');

const FLASH_MAX = 120;
const flash = (msg) => (typeof msg === 'string' ? msg.replace(/<[^>]*>/g, '').slice(0, FLASH_MAX) || null : null);

exports.listPending = async (req, res) => {
    try {
        const members = await memberAdminService.listPendingApproval();
        res.render('layout', {
            title: 'Pending Members',
            bodyView: 'admin/members/list',
            stylesheets: ['/css/admin.css'],
            viewData: {
                members,
                success: flash(req.query.success),
                error: flash(req.query.error)
            }
        });
    } catch (error) {
        logger.error('Error loading pending members', { error });
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load pending members.' });
    }
};

exports.approve = async (req, res) => {
    try {
        const ok = await memberAdminService.approveMember(req.params.id, req.user ? req.user.id : null, req.ip);
        const key = ok ? 'success' : 'error';
        const msg = ok ? 'Member approved' : 'Member was no longer pending approval';
        res.redirect(`/admin/members?${key}=${encodeURIComponent(msg)}`);
    } catch (error) {
        logger.error('Error approving member', { error });
        res.redirect(`/admin/members?error=${encodeURIComponent('Unable to approve member')}`);
    }
};

exports.reject = async (req, res) => {
    try {
        const ok = await memberAdminService.rejectMember(req.params.id, req.user ? req.user.id : null, req.ip);
        const key = ok ? 'success' : 'error';
        const msg = ok ? 'Member rejected' : 'Member was no longer pending';
        res.redirect(`/admin/members?${key}=${encodeURIComponent(msg)}`);
    } catch (error) {
        logger.error('Error rejecting member', { error });
        res.redirect(`/admin/members?error=${encodeURIComponent('Unable to reject member')}`);
    }
};
