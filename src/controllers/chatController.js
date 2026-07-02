/**
 * src/controllers/chatController.js
 * Controller for chat endpoints (REST polling, posting, and moderation).
 */

const ChatService = require('../services/ChatService');
const chatSocketServer = require('../services/chatSocketServer');
const db = require('../config/db');
const logger = require('../utils/logger');
const { mapError } = require('../errors');

/**
 * Helper to resolve user's display name for database insertions
 */
const resolveUserDisplayName = async (userId) => {
    if (!userId) return null;
    try {
        const result = await db.query(
            'SELECT first_name, last_name, email FROM users WHERE id = $1',
            [userId]
        );
        if (result.rows.length > 0) {
            const u = result.rows[0];
            const firstName = (u.first_name || '').trim();
            const lastName = (u.last_name || '').trim();
            if (firstName) {
                return lastName ? `${firstName} ${lastName}` : firstName;
            }
            return u.email.split('@')[0];
        }
    } catch (e) {
        logger.error(`Error resolving display name in controller: ${e.message}`);
    }
    return null;
};

/**
 * POST /api/chat/post
 * REST fallback for posting a message
 */
exports.postMessage = async (req, res) => {
    try {
        const { streamId, displayName, messageText } = req.body || {};
        const userId = req.user ? req.user.id : null;

        let finalDisplayName = displayName;
        if (userId) {
            finalDisplayName = await resolveUserDisplayName(userId) || 'Member';
        }

        if (!streamId) {
            return res.status(400).json({ error: 'Stream ID is required' });
        }

        const message = await ChatService.createMessage({
            streamId,
            userId,
            displayName: finalDisplayName,
            messageText
        });

        // Broadcast to WebSocket clients
        if (message.status === 'approved') {
            chatSocketServer.broadcastMessage(streamId, {
                type: 'message_approved',
                data: message
            });
        } else if (message.status === 'pending') {
            chatSocketServer.broadcastToModerators(streamId, {
                type: 'message_pending',
                data: message
            });
        }

        return res.status(201).json({
            success: true,
            data: message
        });
    } catch (error) {
        logger.error(`REST postMessage error: ${error.message}`);
        const { statusCode, clientMessage } = mapError(error);
        return res.status(statusCode).json({ error: clientMessage });
    }
};

/**
 * GET /api/chat/poll
 * REST fallback for polling approved messages
 */
exports.getMessagesPoll = async (req, res) => {
    try {
        const { streamId, since } = req.query;

        if (!streamId || isNaN(parseInt(streamId, 10))) {
            return res.status(400).json({ error: 'Valid streamId is required' });
        }

        const messages = await ChatService.getApprovedMessagesForStream(streamId);

        let filteredMessages = messages;
        if (since) {
            const sinceDate = new Date(isNaN(since) ? since : parseInt(since, 10));
            if (!isNaN(sinceDate.getTime())) {
                filteredMessages = messages.filter(m => new Date(m.created_at) > sinceDate);
            }
        }

        return res.json({
            success: true,
            data: filteredMessages
        });
    } catch (error) {
        logger.error(`REST getMessagesPoll error: ${error.message}`);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * POST /api/chat/message/:id/approve
 * Moderation endpoint to approve a message
 */
exports.approveMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const moderatorUserId = req.user ? req.user.id : null;
        const ip = req.ip || req.connection?.remoteAddress;

        const message = await ChatService.approveMessage(id, moderatorUserId, ip);

        // Broadcast approved event to WebSocket clients
        chatSocketServer.broadcastMessage(message.stream_id, {
            type: 'message_approved',
            data: message
        });

        return res.json({
            success: true,
            data: message
        });
    } catch (error) {
        logger.error(`REST approveMessage error: ${error.message}`);
        const { statusCode, clientMessage } = mapError(error);
        return res.status(statusCode).json({ error: clientMessage });
    }
};

/**
 * POST /api/chat/message/:id/delete
 * Moderation endpoint to delete a message
 */
exports.deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const moderatorUserId = req.user ? req.user.id : null;
        const ip = req.ip || req.connection?.remoteAddress;

        const message = await ChatService.deleteMessage(id, moderatorUserId, ip);

        // Broadcast deleted event to WebSocket clients
        chatSocketServer.broadcastMessage(message.stream_id, {
            type: 'message_deleted',
            data: { id: message.id }
        });

        return res.json({
            success: true,
            data: message
        });
    } catch (error) {
        logger.error(`REST deleteMessage error: ${error.message}`);
        const { statusCode, clientMessage } = mapError(error);
        return res.status(statusCode).json({ error: clientMessage });
    }
};

/**
 * GET /admin/chat-moderation
 * Renders the pending chat moderation queue page
 */
exports.getPendingMessagesPage = async (req, res) => {
    try {
        const messages = await ChatService.getPendingMessages();

        res.render('layout', {
            title: 'Chat Moderation',
            bodyView: 'admin/chat-moderation',
            stylesheets: ['/css/admin.css'],
            viewData: {
                messages
            }
        });
    } catch (error) {
        logger.error(`Error loading chat moderation page: ${error.message}`);
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load chat moderation.' });
    }
};
