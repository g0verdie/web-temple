/**
 * controllers/adminMessageController.js
 * Admin/Rabbi contact-message inbox (item 9). Gated by MANAGE_MESSAGES in the route.
 */
const messageService = require('../services/messageService');
const { logAudit, AUDIT_ACTIONS } = require('../services/auditService');
const logger = require('../utils/logger');

const FLASH_MAX = 120;
const flash = (m) => (typeof m === 'string' ? m.replace(/<[^>]*>/g, '').slice(0, FLASH_MAX) || null : null);

exports.list = async (req, res) => {
    try {
        const status = messageService.STATUSES.includes(req.query.status) ? req.query.status : undefined;
        const rawPage = parseInt(req.query.page, 10);
        const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
        const result = await messageService.listMessages({ status, page, limit: 20 });
        res.render('layout', {
            title: 'Contact Messages',
            bodyView: 'admin/messages/list',
            stylesheets: ['/css/admin.css'],
            viewData: {
                ...result,
                filterStatus: status || '',
                success: flash(req.query.success),
                error: flash(req.query.error)
            }
        });
    } catch (error) {
        logger.error('Error loading messages inbox', { error });
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load the inbox.' });
    }
};

exports.view = async (req, res) => {
    try {
        const message = await messageService.getMessageById(req.params.id);
        if (!message) {
            return res.status(404).render('404', { title: '404 - Message Not Found' });
        }
        // First open of a 'new' message marks it read.
        if (message.status === 'new') {
            await messageService.updateStatus(message.id, 'read');
            message.status = 'read';
        }
        res.render('layout', {
            title: 'Contact Message',
            bodyView: 'admin/messages/detail',
            stylesheets: ['/css/admin.css'],
            viewData: { message, csrfToken: req.csrfToken ? req.csrfToken() : null }
        });
    } catch (error) {
        logger.error('Error loading message', { error });
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load the message.' });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const status = req.body && req.body.status;
        const ok = await messageService.updateStatus(req.params.id, status);
        if (ok && status === 'replied') {
            logAudit({
                user_id: req.user && req.user.id,
                action: AUDIT_ACTIONS.MESSAGE_REPLIED,
                entity_type: 'message',
                entity_id: req.params.id,
                description: 'Contact message marked replied',
                ip_address: req.ip
            }).catch(err => logger.error('Audit log error', { error: err }));
        }
        return res.redirect(`/admin/messages?${ok ? 'success' : 'error'}=${encodeURIComponent(ok ? 'Message updated' : 'Message not found')}`);
    } catch (error) {
        logger.error('Error updating message status', { error });
        return res.redirect(`/admin/messages?error=${encodeURIComponent('Unable to update the message')}`);
    }
};

exports.remove = async (req, res) => {
    try {
        const ok = await messageService.deleteMessage(req.params.id);
        if (ok) {
            logAudit({
                user_id: req.user && req.user.id,
                action: AUDIT_ACTIONS.MESSAGE_DELETED,
                entity_type: 'message',
                entity_id: req.params.id,
                description: 'Contact message deleted',
                ip_address: req.ip
            }).catch(err => logger.error('Audit log error', { error: err }));
        }
        return res.redirect(`/admin/messages?${ok ? 'success' : 'error'}=${encodeURIComponent(ok ? 'Message deleted' : 'Message not found')}`);
    } catch (error) {
        logger.error('Error deleting message', { error });
        return res.redirect(`/admin/messages?error=${encodeURIComponent('Unable to delete the message')}`);
    }
};
