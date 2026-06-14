/**
 * src/services/chatSocketServer.js
 * Manages the WebSocket server for real-time live chat during streams.
 */

const ws = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const redis = require('../config/redis');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret' : null);
const MAX_CONCURRENT_CONNECTIONS = 50;

// Per-connection flood guard for post_message. The connection cap limits the
// number of sockets, NOT the per-socket write rate, so without this one accepted
// socket could insert unbounded rows into chat_messages (and the audit log).
// Anti-flood, not human throttling: a lively chatter won't approach 20 posts /
// 10s, but a flood loop will.
const MAX_POSTS_PER_WINDOW = 20;
const POST_WINDOW_MS = 10000;

// How long a raw upgrade socket may sit half-open during the async auth/DB
// window before we reclaim it.
const UPGRADE_AUTH_TIMEOUT_MS = 10000;

// Keep track of active WebSocket connections: streamId -> Set of ws clients
const connections = {};

// In-flight upgrade reservations: streamId -> count of sockets that have passed
// the capacity check but are not yet in `connections` (the async auth/DB window).
// Counted against the cap so concurrent upgrades cannot collectively exceed it.
const reservedCounts = {};

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

// Format a display name from a users row: first+last → first → email local-part.
const formatDisplayName = (u) => {
    const firstName = (u.first_name || '').trim();
    const lastName = (u.last_name || '').trim();
    if (firstName) {
        return lastName ? `${firstName} ${lastName}` : firstName;
    }
    return (u.email || '').split('@')[0] || 'Member';
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
                    // Per-connection flood guard: a single socket can otherwise
                    // flood chat_messages and the audit log (the 50-conn cap
                    // limits socket count, not per-socket write rate).
                    const nowTs = Date.now();
                    wsClient._postTimes = (wsClient._postTimes || []).filter((t) => nowTs - t < POST_WINDOW_MS);
                    if (wsClient._postTimes.length >= MAX_POSTS_PER_WINDOW) {
                        wsClient.send(JSON.stringify({
                            type: 'error',
                            message: 'You are sending messages too quickly. Please slow down.'
                        }));
                        return;
                    }
                    wsClient._postTimes.push(nowTs);

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

        if (pathname !== '/ws/chat') {
            // Drop unknown upgrade paths so half-open sockets don't accumulate.
            socket.destroy();
            return;
        }

        const query = parsedUrl.query;
        const streamId = parseInt(query.streamId, 10);

        if (!streamId || isNaN(streamId)) {
            socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
            socket.destroy();
            return;
        }

        // Capacity check counts live connections AND in-flight reservations.
        // We reserve a slot synchronously below (before the async auth/DB
        // window), so concurrent upgrades can't all read an under-cap count and
        // then each add a socket — the TOCTOU that previously let the cap be
        // exceeded by N simultaneous handshakes.
        const activeCount = getActiveConnectionCount(streamId);
        const reserved = reservedCounts[streamId] || 0;
        if (activeCount + reserved >= MAX_CONCURRENT_CONNECTIONS) {
            socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
            socket.destroy();
            return;
        }

        // Authentication — all synchronous. There is no `await` between the
        // capacity check above and the reservation below, so check-and-reserve
        // is atomic on the single-threaded event loop.
        let userId = null;
        let role = 'guest';
        let tokenJti = null;
        let tokenVersion = 0;

        const cookies = parseCookies(request.headers ? request.headers.cookie : null);
        const token = cookies.auth_token || query.auth_token;

        if (token && JWT_SECRET) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.user_id;
                role = decoded.role;
                tokenJti = decoded.jti || null;
                tokenVersion = decoded.token_version || 0;
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

        // Reserve the slot before entering the async window, and arrange to
        // release it on every exit path (successful upgrade, error, timeout).
        reservedCounts[streamId] = (reservedCounts[streamId] || 0) + 1;
        let released = false;
        let authTimeout = null;
        const releaseReservation = () => {
            if (released) return;
            released = true;
            const n = (reservedCounts[streamId] || 1) - 1;
            if (n <= 0) {
                delete reservedCounts[streamId];
            } else {
                reservedCounts[streamId] = n;
            }
        };

        // A raw socket with no 'error' listener throws on a client RST; with no
        // process-level uncaughtException handler that would crash the process.
        // Attach a handler for the auth/DB window before we await anything.
        const onSocketError = () => {
            if (authTimeout) clearTimeout(authTimeout);
            releaseReservation();
            socket.destroy();
        };
        socket.on('error', onSocketError);

        // Reclaim sockets that never finish the handshake (e.g. a stalled DB
        // lookup) so half-open sockets don't accumulate.
        authTimeout = setTimeout(() => {
            socket.removeListener('error', onSocketError);
            releaseReservation();
            socket.destroy();
        }, UPGRADE_AUTH_TIMEOUT_MS);

        const rejectUpgrade = (statusLine) => {
            clearTimeout(authTimeout);
            socket.removeListener('error', onSocketError);
            releaseReservation();
            if (!socket.destroyed) {
                socket.write(`HTTP/1.1 ${statusLine}\r\n\r\n`);
                socket.destroy();
            }
        };

        const finalizeUpgrade = async () => {
            let displayName;

            if (userId) {
                // Mirror requireAuth's revocation checks: a blacklisted jti or a
                // token_version mismatch means the session was invalidated upstream
                // (logout / password change / forced logout). Don't honor a stale
                // role — possibly moderator — for the connection's whole lifetime.
                if (tokenJti) {
                    const blacklisted = await redis.get(`invalidated:token:${tokenJti}`);
                    if (blacklisted) {
                        return rejectUpgrade('401 Unauthorized');
                    }
                }
                const result = await db.query(
                    'SELECT first_name, last_name, email, token_version, role FROM users WHERE id = $1',
                    [userId]
                );
                if (result.rows.length === 0) {
                    return rejectUpgrade('401 Unauthorized');
                }
                const u = result.rows[0];
                if (tokenVersion !== (u.token_version || 0)) {
                    return rejectUpgrade('401 Unauthorized');
                }
                // Trust the live DB role over the (older) token role.
                role = u.role || role;
                displayName = formatDisplayName(u);
            } else {
                displayName = (query.guestName && query.guestName.trim()) || 'Guest';
            }

            clearTimeout(authTimeout);
            socket.removeListener('error', onSocketError);
            releaseReservation();
            wss.handleUpgrade(request, socket, head, (wsClient) => {
                wss.emit('connection', wsClient, request, {
                    streamId,
                    userId,
                    displayName,
                    role
                });
            });
        };

        finalizeUpgrade().catch((err) => {
            logger.error(`WS Upgrade finalize error: ${err.message}`);
            rejectUpgrade('500 Internal Server Error');
        });
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
    Object.keys(reservedCounts).forEach((streamId) => {
        delete reservedCounts[streamId];
    });
};

module.exports = {
    initChatSocketServer,
    getActiveConnectionCount,
    broadcastMessage,
    broadcastToModerators,
    closeAllConnections
};
