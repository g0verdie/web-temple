/**
 * src/services/chatSocketServer.js
 * Manages the WebSocket server for real-time live chat during streams.
 */

const ws = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret' : null);
const MAX_CONCURRENT_CONNECTIONS = 50;

// Keep track of active WebSocket connections: streamId -> Set of ws clients
const connections = {};

// Helper to parse cookies from header
const parseCookies = (cookieHeader) => {
    const list = {};
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURIComponent(parts.join('='));
    });
    return list;
};

// Helper to extract IP
const getIp = (req) => {
    if (req.headers && req.headers['x-forwarded-for']) {
        return req.headers['x-forwarded-for'].split(',')[0].trim();
    }
    return req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1';
};

// Check if role is authorized to moderate
const hasModeratorPermission = (role) => {
    return ['admin', 'rabbi', 'social_chair'].includes(role);
};

// Resolve display name for logged-in user or guest fallback
const resolveUserDisplayName = async (userId, guestNameFallback) => {
    if (!userId) {
        return guestNameFallback || 'Guest';
    }
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
        logger.error(`Error resolving display name for WS: ${e.message}`);
    }
    return guestNameFallback || 'Member';
};

let wss = null;

/**
 * Initialize the WebSocket server
 */
const initChatSocketServer = (server) => {
    if (wss) {
        return wss;
    }

    wss = new ws.Server({ noServer: true });

    wss.on('connection', (wsClient, request, connectionContext) => {
        const { streamId, userId, displayName, role } = connectionContext;

        wsClient.streamId = streamId;
        wsClient.userId = userId;
        wsClient.displayName = displayName;
        wsClient.role = role;

        if (!connections[streamId]) {
            connections[streamId] = new Set();
        }
        connections[streamId].add(wsClient);

        // Send confirmation
        wsClient.send(JSON.stringify({
            type: 'connection_established',
            data: {
                displayName,
                role,
                streamId
            }
        }));

        wsClient.on('message', async (messageBuffer) => {
            try {
                const message = JSON.parse(messageBuffer.toString());

                if (message.type === 'post_message') {
                    const { text } = message;
                    const { createMessage } = require('./ChatService');

                    const created = await createMessage({
                        streamId,
                        userId,
                        displayName,
                        messageText: text
                    });

                    // Send receipt to poster
                    wsClient.send(JSON.stringify({
                        type: 'message_posted',
                        data: created
                    }));

                    // If approved immediately (e.g. passed spam filter / auto-approve), broadcast
                    if (created.status === 'approved') {
                        broadcastMessage(streamId, {
                            type: 'message_approved',
                            data: created
                        });
                    } else if (created.status === 'pending') {
                        // Notify moderators of pending message
                        broadcastToModerators(streamId, {
                            type: 'message_pending',
                            data: created
                        });
                    }
                } else if (message.type === 'approve_message') {
                    if (!hasModeratorPermission(role)) {
                        wsClient.send(JSON.stringify({ type: 'error', message: 'Unauthorized action' }));
                        return;
                    }
                    const { approveMessage } = require('./ChatService');
                    const approved = await approveMessage(message.messageId, userId, getIp(request));

                    broadcastMessage(streamId, {
                        type: 'message_approved',
                        data: approved
                    });
                } else if (message.type === 'delete_message') {
                    if (!hasModeratorPermission(role)) {
                        wsClient.send(JSON.stringify({ type: 'error', message: 'Unauthorized action' }));
                        return;
                    }
                    const { deleteMessage } = require('./ChatService');
                    const deleted = await deleteMessage(message.messageId, userId, getIp(request));

                    broadcastMessage(streamId, {
                        type: 'message_deleted',
                        data: { id: deleted.id }
                    });
                } else if (message.type === 'pause_chat') {
                    if (!hasModeratorPermission(role)) {
                        wsClient.send(JSON.stringify({ type: 'error', message: 'Unauthorized action' }));
                        return;
                    }
                    broadcastMessage(streamId, {
                        type: 'chat_paused',
                        data: { paused: !!message.paused }
                    });
                }
            } catch (err) {
                logger.error(`WS message processing failed: ${err.message}`);
                wsClient.send(JSON.stringify({
                    type: 'error',
                    message: err.message
                }));
            }
        });

        wsClient.on('close', () => {
            if (connections[streamId]) {
                connections[streamId].delete(wsClient);
                if (connections[streamId].size === 0) {
                    delete connections[streamId];
                }
            }
        });

        wsClient.on('error', (err) => {
            logger.error(`WS client error: ${err.message}`);
        });
    });

    // Hook up the upgrade listener
    server.on('upgrade', (request, socket, head) => {
        const parsedUrl = url.parse(request.url, true);
        const pathname = parsedUrl.pathname;

        if (pathname === '/ws/chat') {
            const query = parsedUrl.query;
            const streamId = parseInt(query.streamId, 10);

            if (!streamId || isNaN(streamId)) {
                socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
                socket.destroy();
                return;
            }

            // Check connection limit
            const activeCount = getActiveConnectionCount(streamId);
            if (activeCount >= MAX_CONCURRENT_CONNECTIONS) {
                socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
                socket.destroy();
                return;
            }

            // Perform authentication
            let userId = null;
            let role = 'guest';

            const cookies = parseCookies(request.headers ? request.headers.cookie : null);
            const token = cookies.auth_token || query.auth_token;

            if (token && JWT_SECRET) {
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    userId = decoded.user_id;
                    role = decoded.role;
                } catch (err) {
                    // Ignore token and treat as guest
                }
            }

            if (!userId) {
                const guestName = query.guestName;
                if (!guestName || typeof guestName !== 'string' || guestName.trim() === '') {
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                    return;
                }
                if (guestName.length > 50) {
                    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
                    socket.destroy();
                    return;
                }
            }

            resolveUserDisplayName(userId, query.guestName)
                .then((displayName) => {
                    wss.handleUpgrade(request, socket, head, (wsClient) => {
                        wss.emit('connection', wsClient, request, {
                            streamId,
                            userId,
                            displayName,
                            role
                        });
                    });
                })
                .catch((err) => {
                    logger.error(`WS Upgrade resolve error: ${err.message}`);
                    socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
                    socket.destroy();
                });
        } else {
            // Drop unknown upgrade paths so half-open sockets don't accumulate.
            socket.destroy();
        }
    });

    return wss;
};

/**
 * Get active connections for a stream
 */
const getActiveConnectionCount = (streamId) => {
    return connections[streamId] ? connections[streamId].size : 0;
};

/**
 * Broadcast message to all connected clients in a stream
 */
const broadcastMessage = (streamId, payload) => {
    const clients = connections[streamId];
    if (clients) {
        const messageString = typeof payload === 'string' ? payload : JSON.stringify(payload);
        for (const client of clients) {
            if (client.readyState === ws.OPEN) {
                client.send(messageString);
            }
        }
    }
};

/**
 * Broadcast message to moderators connected to a stream
 */
const broadcastToModerators = (streamId, payload) => {
    const clients = connections[streamId];
    if (clients) {
        const messageString = typeof payload === 'string' ? payload : JSON.stringify(payload);
        for (const client of clients) {
            if (client.readyState === ws.OPEN && hasModeratorPermission(client.role)) {
                client.send(messageString);
            }
        }
    }
};

/**
 * Close all active socket connections
 */
const closeAllConnections = () => {
    Object.keys(connections).forEach((streamId) => {
        connections[streamId].forEach((client) => {
            if (client.readyState === ws.OPEN) {
                client.close();
            }
        });
        delete connections[streamId];
    });
};

module.exports = {
    initChatSocketServer,
    getActiveConnectionCount,
    broadcastMessage,
    broadcastToModerators,
    closeAllConnections
};
