process.env.JWT_SECRET = 'test-jwt-secret';

const EventEmitter = require('events');
const jwt = require('jsonwebtoken');

// Mock ws library
jest.mock('ws', () => {
    const EventEmitter = require('events');
    class MockServer extends EventEmitter {
        constructor(options) {
            super();
            this.options = options;
            this.handleUpgrade = jest.fn((req, socket, head, cb) => {
                const wsClient = new EventEmitter();
                wsClient.send = jest.fn();
                wsClient.close = jest.fn();
                cb(wsClient);
            });
        }
    }
    return {
        Server: MockServer
    };
});

// Mock database config
jest.mock('../../src/config/db', () => ({
    query: jest.fn()
}));
const db = require('../../src/config/db');

// Mock ChatService. containsReservedName is the real (pure) implementation so
// the upgrade handler's reserved-name gate behaves as in production.
jest.mock('../../src/services/ChatService', () => ({
    createMessage: jest.fn(),
    approveMessage: jest.fn(),
    deleteMessage: jest.fn(),
    containsReservedName: (displayName) => {
        const lower = String(displayName).toLowerCase();
        return ['rabbi', 'cantor', 'admin', 'moderator'].some((w) => lower.includes(w));
    }
}));
const ChatService = require('../../src/services/ChatService');

// Mock audit service
jest.mock('../../src/services/auditService', () => ({
    log: jest.fn().mockResolvedValue(true),
    logAudit: jest.fn().mockResolvedValue(true)
}));

const chatSocketServer = require('../../src/services/chatSocketServer');
const JWT_SECRET = process.env.JWT_SECRET;

// Build a realistic mock upgrade socket: a real EventEmitter (so the upgrade
// handler's socket.on('error') / removeListener calls work) with spy
// write/destroy and a destroyed flag.
const makeSocket = () => {
    const s = new EventEmitter();
    s.write = jest.fn();
    s.destroyed = false;
    s.destroy = jest.fn(() => { s.destroyed = true; });
    return s;
};

describe('Chat WebSocket Server Integration Tests', () => {
    let mockServer;
    let wss;

    beforeAll(() => {
        // Initialize once to reuse across all tests
        mockServer = new EventEmitter();
        wss = chatSocketServer.initChatSocketServer(mockServer);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset connections map inside the socket server
        chatSocketServer.closeAllConnections();
    });

    afterAll(() => {
        chatSocketServer.closeAllConnections();
    });

    // Helper to emit upgrade event and wait for all async handlers
    const emitUpgradeAsync = async (req, socket = makeSocket()) => {
        mockServer.emit('upgrade', req, socket, Buffer.alloc(0));
        // Wait for event loop ticks to process promises
        await new Promise(resolve => setImmediate(resolve));
        await new Promise(resolve => setImmediate(resolve));
    };

    describe('WebSocket Upgrade Handshake & Authentication', () => {
        it('should reject upgrade if streamId is missing or invalid', async () => {
            const req = { url: '/ws/chat' };
            const socket = makeSocket();
            
            await emitUpgradeAsync(req, socket);

            expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('HTTP/1.1 400 Bad Request'));
            expect(socket.destroy).toHaveBeenCalled();
        });

        it('should reject guest connection if guestName is missing', async () => {
            const req = { url: '/ws/chat?streamId=10' };
            const socket = makeSocket();

            await emitUpgradeAsync(req, socket);

            expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('HTTP/1.1 401 Unauthorized'));
            expect(socket.destroy).toHaveBeenCalled();
        });

        it('should reject guest connection if guestName is too long (>50 chars)', async () => {
            const req = { url: `/ws/chat?streamId=10&guestName=${'a'.repeat(51)}` };
            const socket = makeSocket();

            await emitUpgradeAsync(req, socket);

            expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('HTTP/1.1 400 Bad Request'));
            expect(socket.destroy).toHaveBeenCalled();
        });

        it('should reject a guest connection whose guestName contains a reserved role word', async () => {
            const reservedNames = ['Rabbi David', 'cantor sam', 'The ADMIN', 'a moderator'];
            for (const name of reservedNames) {
                const req = { url: `/ws/chat?streamId=10&guestName=${encodeURIComponent(name)}` };
                const socket = makeSocket();

                let connected = false;
                const onConn = () => { connected = true; };
                wss.once('connection', onConn);
                await emitUpgradeAsync(req, socket);
                wss.removeListener('connection', onConn);

                expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('HTTP/1.1 400 Bad Request'));
                expect(socket.destroy).toHaveBeenCalled();
                expect(connected).toBe(false);
            }
        });

        it('should allow guest connection with valid guestName and upgrade successfully', async () => {
            const req = { url: '/ws/chat?streamId=10&guestName=Bob' };
            const socket = makeSocket();

            const connectionPromise = new Promise((resolve) => {
                wss.once('connection', (wsClient, request, connectionContext) => {
                    resolve({ wsClient, connectionContext });
                });
            });

            await emitUpgradeAsync(req, socket);

            const { wsClient, connectionContext } = await connectionPromise;
            expect(connectionContext.streamId).toBe(10);
            expect(connectionContext.role).toBe('guest');
            expect(connectionContext.displayName).toBe('Bob');
            expect(wsClient.send).toHaveBeenCalledWith(expect.stringContaining('connection_established'));
        });

        it('should authenticate user via JWT token and resolve role and name', async () => {
            const token = jwt.sign({ user_id: 'user-001', role: 'rabbi', email: 'rabbi@example.com' }, JWT_SECRET);
            const req = {
                url: '/ws/chat?streamId=10',
                headers: { cookie: `auth_token=${token}` }
            };
            const socket = makeSocket();

            // Mock DB lookup in resolveUserDisplayName
            db.query.mockResolvedValueOnce({
                rows: [{ first_name: 'Abraham', last_name: 'Joshua', email: 'rabbi@example.com' }]
            });

            const connectionPromise = new Promise((resolve) => {
                wss.once('connection', (wsClient, request, connectionContext) => {
                    resolve({ wsClient, connectionContext });
                });
            });

            await emitUpgradeAsync(req, socket);

            const { wsClient, connectionContext } = await connectionPromise;
            expect(connectionContext.userId).toBe('user-001');
            expect(connectionContext.role).toBe('rabbi');
            expect(connectionContext.displayName).toBe('Abraham Joshua');
            expect(wsClient.send).toHaveBeenCalledWith(expect.stringContaining('connection_established'));
        });

        it('ignores a JWT supplied only in the query string and connects as a guest (AE1)', async () => {
            // A valid token in the query string must NOT authenticate the user;
            // with a valid guestName the connection resolves to a guest instead.
            const token = jwt.sign({ user_id: 'attacker-1', role: 'rabbi', email: 'x@e.com' }, JWT_SECRET);
            const req = { url: `/ws/chat?streamId=10&guestName=Mallory&auth_token=${token}` };
            const socket = makeSocket();

            const connectionPromise = new Promise((resolve) => {
                wss.once('connection', (wsClient, request, connectionContext) => {
                    resolve(connectionContext);
                });
            });

            await emitUpgradeAsync(req, socket);

            const connectionContext = await connectionPromise;
            expect(connectionContext.userId).toBeNull();
            expect(connectionContext.role).toBe('guest');
            expect(connectionContext.displayName).toBe('Mallory');
            // The guest path never touches the DB — proves the token was ignored.
            expect(db.query).not.toHaveBeenCalled();
        });

        it('rejects an upgrade whose only credential is a query-string JWT and no guestName (AE1)', async () => {
            const token = jwt.sign({ user_id: 'attacker-2', role: 'admin', email: 'y@e.com' }, JWT_SECRET);
            const req = { url: `/ws/chat?streamId=10&auth_token=${token}` };
            const socket = makeSocket();

            let connected = false;
            const onConn = () => { connected = true; };
            wss.once('connection', onConn);
            await emitUpgradeAsync(req, socket);
            wss.removeListener('connection', onConn);

            expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('HTTP/1.1 401'));
            expect(socket.destroy).toHaveBeenCalled();
            expect(connected).toBe(false);
        });

        it('rejects an authenticated upgrade when token_version is stale (revoked session)', async () => {
            const token = jwt.sign({ user_id: 'user-stale', role: 'rabbi', email: 'r@e.com', token_version: 1 }, JWT_SECRET);
            const req = { url: '/ws/chat?streamId=10', headers: { cookie: `auth_token=${token}` } };
            const socket = makeSocket();

            // DB has a newer token_version → the token was invalidated upstream.
            db.query.mockResolvedValueOnce({
                rows: [{ first_name: 'R', last_name: 'B', email: 'r@e.com', token_version: 2, role: 'rabbi' }]
            });

            let connected = false;
            const onConn = () => { connected = true; };
            wss.once('connection', onConn);
            await emitUpgradeAsync(req, socket);
            wss.removeListener('connection', onConn);

            expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('HTTP/1.1 401'));
            expect(socket.destroy).toHaveBeenCalled();
            expect(connected).toBe(false);
        });

        it('rejects an authenticated upgrade when the token jti is blacklisted', async () => {
            const redis = require('../../src/config/redis');
            await redis.set('invalidated:token:revoked-jti-1', '1');
            const token = jwt.sign({ user_id: 'user-bl', role: 'admin', email: 'a@e.com', jti: 'revoked-jti-1' }, JWT_SECRET);
            const req = { url: '/ws/chat?streamId=10', headers: { cookie: `auth_token=${token}` } };
            const socket = makeSocket();

            let connected = false;
            const onConn = () => { connected = true; };
            wss.once('connection', onConn);
            await emitUpgradeAsync(req, socket);
            wss.removeListener('connection', onConn);

            expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('HTTP/1.1 401'));
            expect(socket.destroy).toHaveBeenCalled();
            expect(connected).toBe(false);
            // Blacklist hit short-circuits before any DB lookup.
            expect(db.query).not.toHaveBeenCalled();
        });

        it('should enforce concurrency limit of 50 connections per stream', async () => {
            const socket = makeSocket();
            
            // Connect 50 guests
            for (let i = 0; i < 50; i++) {
                const req = { url: '/ws/chat?streamId=10&guestName=Guest' };
                await emitUpgradeAsync(req);
            }

            expect(chatSocketServer.getActiveConnectionCount(10)).toBe(50);

            // Attempt 51st connection
            const req51 = { url: '/ws/chat?streamId=10&guestName=Bob' };
            await emitUpgradeAsync(req51, socket);

            expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('HTTP/1.1 503 Service Unavailable'));
            expect(socket.destroy).toHaveBeenCalled();
        });
    });

    describe('WebSocket Message Handling', () => {
        let wsClient;

        beforeEach(async () => {
            const req = { url: '/ws/chat?streamId=10&guestName=Bob' };
            const socket = makeSocket();

            const connectionPromise = new Promise((resolve) => {
                wss.once('connection', resolve);
            });

            await emitUpgradeAsync(req, socket);
            wsClient = await connectionPromise;
        });

        it('should handle post_message from client and call createMessage', async () => {
            const mockMsg = { id: 101, stream_id: 10, display_name: 'Bob', message_text: 'Shabbat Shalom', status: 'approved' };
            ChatService.createMessage.mockResolvedValueOnce(mockMsg);

            wsClient.emit('message', JSON.stringify({
                type: 'post_message',
                text: 'Shabbat Shalom'
            }));

            await new Promise(resolve => setImmediate(resolve));

            expect(ChatService.createMessage).toHaveBeenCalledWith({
                streamId: 10,
                userId: null,
                displayName: 'Bob',
                messageText: 'Shabbat Shalom'
            });
            expect(wsClient.send).toHaveBeenCalledWith(expect.stringContaining('message_posted'));
        });

        it('throttles a single connection that floods post_message (per-connection rate limit)', async () => {
            ChatService.createMessage.mockResolvedValue({
                id: 1, stream_id: 10, display_name: 'Bob', message_text: 'flood', status: 'pending'
            });

            // 25 rapid posts on one socket; only the first 20 within the window
            // reach the service, the rest get a rate-limit error.
            for (let i = 0; i < 25; i++) {
                wsClient.emit('message', JSON.stringify({ type: 'post_message', text: `msg ${i}` }));
            }
            await new Promise(resolve => setImmediate(resolve));

            expect(ChatService.createMessage).toHaveBeenCalledTimes(20);
            expect(wsClient.send).toHaveBeenCalledWith(expect.stringContaining('too quickly'));
        });

        it('should reject moderation commands from guests/non-moderators', async () => {
            wsClient.emit('message', JSON.stringify({
                type: 'approve_message',
                messageId: 99
            }));

            await new Promise(resolve => setImmediate(resolve));

            expect(ChatService.approveMessage).not.toHaveBeenCalled();
            expect(wsClient.send).toHaveBeenCalledWith(expect.stringContaining('Unauthorized action'));
        });

        it('should allow moderator (Rabbi) to approve message', async () => {
            const token = jwt.sign({ user_id: 'rabbi-001', role: 'rabbi', email: 'rabbi@example.com' }, JWT_SECRET);
            const req = {
                url: '/ws/chat?streamId=10',
                headers: { cookie: `auth_token=${token}` }
            };
            
            db.query.mockResolvedValueOnce({
                rows: [{ first_name: 'Rabbi', last_name: 'Test', email: 'rabbi@example.com' }]
            });

            const connectionPromise = new Promise((resolve) => {
                wss.once('connection', resolve);
            });

            await emitUpgradeAsync(req);
            const modClient = await connectionPromise;

            const mockApproved = { id: 99, stream_id: 10, display_name: 'Bob', message_text: 'Hello', status: 'approved' };
            ChatService.approveMessage.mockResolvedValueOnce(mockApproved);

            modClient.emit('message', JSON.stringify({
                type: 'approve_message',
                messageId: 99
            }));

            await new Promise(resolve => setImmediate(resolve));

            expect(ChatService.approveMessage).toHaveBeenCalledWith(99, 'rabbi-001', '127.0.0.1');
        });

        it('should allow moderator (Rabbi) to delete message', async () => {
            const token = jwt.sign({ user_id: 'rabbi-001', role: 'rabbi', email: 'rabbi@example.com' }, JWT_SECRET);
            const req = {
                url: '/ws/chat?streamId=10',
                headers: { cookie: `auth_token=${token}` }
            };
            
            db.query.mockResolvedValueOnce({
                rows: [{ first_name: 'Rabbi', last_name: 'Test', email: 'rabbi@example.com' }]
            });

            const connectionPromise = new Promise((resolve) => {
                wss.once('connection', resolve);
            });

            await emitUpgradeAsync(req);
            const modClient = await connectionPromise;

            const mockDeleted = { id: 99, stream_id: 10, display_name: 'Bob', message_text: 'Spam text', status: 'deleted' };
            ChatService.deleteMessage.mockResolvedValueOnce(mockDeleted);

            modClient.emit('message', JSON.stringify({
                type: 'delete_message',
                messageId: 99
            }));

            await new Promise(resolve => setImmediate(resolve));

            expect(ChatService.deleteMessage).toHaveBeenCalledWith(99, 'rabbi-001', '127.0.0.1');
        });

        it('should allow moderator to pause chat and broadcast state to all clients', async () => {
            const token = jwt.sign({ user_id: 'admin-001', role: 'admin', email: 'admin@example.com' }, JWT_SECRET);
            const req = {
                url: '/ws/chat?streamId=10',
                headers: { cookie: `auth_token=${token}` }
            };
            
            db.query.mockResolvedValueOnce({
                rows: [{ first_name: 'Admin', last_name: 'Test', email: 'admin@example.com' }]
            });

            const connectionPromise = new Promise((resolve) => {
                wss.once('connection', resolve);
            });

            await emitUpgradeAsync(req);
            const adminClient = await connectionPromise;

            adminClient.emit('message', JSON.stringify({
                type: 'pause_chat',
                paused: true
            }));

            await new Promise(resolve => setImmediate(resolve));

            expect(wsClient.send).toHaveBeenCalledWith(expect.stringContaining('chat_paused'));
        });

        it('AE3: sends a safe generic error frame (never the raw exception) when a handler throws an untyped error', async () => {
            ChatService.createMessage.mockRejectedValueOnce(new Error('ECONNREFUSED postgres://secret@db:5432'));

            wsClient.emit('message', JSON.stringify({ type: 'post_message', text: 'hi' }));
            await new Promise(resolve => setImmediate(resolve));

            const errorFrames = wsClient.send.mock.calls
                .map((c) => JSON.parse(c[0]))
                .filter((f) => f.type === 'error');
            expect(errorFrames.length).toBeGreaterThan(0);
            const frame = errorFrames[errorFrames.length - 1];
            expect(frame.message).toBe('Something went wrong');
            expect(JSON.stringify(frame)).not.toContain('ECONNREFUSED');
            expect(JSON.stringify(frame)).not.toContain('secret');
        });

        it('AE3: surfaces a typed ValidationError clientMessage safely over the socket', async () => {
            const { ValidationError } = require('../../src/errors');
            ChatService.createMessage.mockRejectedValueOnce(new ValidationError('Message text is required'));

            wsClient.emit('message', JSON.stringify({ type: 'post_message', text: '' }));
            await new Promise(resolve => setImmediate(resolve));

            const errorFrames = wsClient.send.mock.calls
                .map((c) => JSON.parse(c[0]))
                .filter((f) => f.type === 'error');
            expect(errorFrames[errorFrames.length - 1].message).toBe('Message text is required');
        });
    });

    describe('WebSocket Broadcast Routing', () => {
        let guestClient;
        let modClient;

        beforeEach(async () => {
            // A guest viewer on stream 20...
            const guestReq = { url: '/ws/chat?streamId=20&guestName=Guest' };
            const gP = new Promise((resolve) => wss.once('connection', resolve));
            await emitUpgradeAsync(guestReq);
            guestClient = await gP;

            // ...and a moderator (Rabbi) on the same stream.
            const token = jwt.sign({ user_id: 'rabbi-1', role: 'rabbi', email: 'r@e.com' }, JWT_SECRET);
            db.query.mockResolvedValueOnce({ rows: [{ first_name: 'R', last_name: 'B', email: 'r@e.com' }] });
            const modReq = { url: '/ws/chat?streamId=20', headers: { cookie: `auth_token=${token}` } };
            const mP = new Promise((resolve) => wss.once('connection', resolve));
            await emitUpgradeAsync(modReq);
            modClient = await mP;

            // Drop the connection_established sends so assertions target broadcasts.
            guestClient.send.mockClear();
            modClient.send.mockClear();
        });

        it('routes a pending message to moderators only, not to regular viewers', async () => {
            ChatService.createMessage.mockResolvedValueOnce({
                id: 1, stream_id: 20, display_name: 'Guest', message_text: 'hi', status: 'pending'
            });

            guestClient.emit('message', JSON.stringify({ type: 'post_message', text: 'hi' }));
            await new Promise(resolve => setImmediate(resolve));

            expect(modClient.send).toHaveBeenCalledWith(expect.stringContaining('message_pending'));
            const guestPayloads = guestClient.send.mock.calls.map((c) => c[0]);
            expect(guestPayloads.some((p) => p.includes('message_pending'))).toBe(false);
        });

        it('broadcasts an approved message to every viewer on the stream', async () => {
            ChatService.createMessage.mockResolvedValueOnce({
                id: 2, stream_id: 20, display_name: 'Guest', message_text: 'shalom', status: 'approved'
            });

            guestClient.emit('message', JSON.stringify({ type: 'post_message', text: 'shalom' }));
            await new Promise(resolve => setImmediate(resolve));

            expect(guestClient.send).toHaveBeenCalledWith(expect.stringContaining('message_approved'));
            expect(modClient.send).toHaveBeenCalledWith(expect.stringContaining('message_approved'));
        });

        it('broadcasts moderator approve and delete to every viewer on the stream', async () => {
            ChatService.approveMessage.mockResolvedValueOnce({
                id: 3, stream_id: 20, display_name: 'Guest', message_text: 'x', status: 'approved'
            });
            modClient.emit('message', JSON.stringify({ type: 'approve_message', messageId: 3 }));
            await new Promise(resolve => setImmediate(resolve));
            expect(guestClient.send).toHaveBeenCalledWith(expect.stringContaining('message_approved'));
            expect(modClient.send).toHaveBeenCalledWith(expect.stringContaining('message_approved'));

            guestClient.send.mockClear();
            modClient.send.mockClear();

            ChatService.deleteMessage.mockResolvedValueOnce({
                id: 3, stream_id: 20, display_name: 'Guest', message_text: 'x', status: 'deleted'
            });
            modClient.emit('message', JSON.stringify({ type: 'delete_message', messageId: 3 }));
            await new Promise(resolve => setImmediate(resolve));
            expect(guestClient.send).toHaveBeenCalledWith(expect.stringContaining('message_deleted'));
            expect(modClient.send).toHaveBeenCalledWith(expect.stringContaining('message_deleted'));
        });
    });
});
