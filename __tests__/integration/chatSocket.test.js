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

// Mock ChatService
jest.mock('../../src/services/ChatService', () => ({
    createMessage: jest.fn(),
    approveMessage: jest.fn(),
    deleteMessage: jest.fn()
}));
const ChatService = require('../../src/services/ChatService');

// Mock audit service
jest.mock('../../src/services/auditService', () => ({
    log: jest.fn().mockResolvedValue(true),
    logAudit: jest.fn().mockResolvedValue(true)
}));

const chatSocketServer = require('../../src/services/chatSocketServer');
const JWT_SECRET = process.env.JWT_SECRET;

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
    const emitUpgradeAsync = async (req, socket = { write: jest.fn(), destroy: jest.fn() }) => {
        mockServer.emit('upgrade', req, socket, Buffer.alloc(0));
        // Wait for event loop ticks to process promises
        await new Promise(resolve => setImmediate(resolve));
        await new Promise(resolve => setImmediate(resolve));
    };

    describe('WebSocket Upgrade Handshake & Authentication', () => {
        it('should reject upgrade if streamId is missing or invalid', async () => {
            const req = { url: '/ws/chat' };
            const socket = { write: jest.fn(), destroy: jest.fn() };
            
            await emitUpgradeAsync(req, socket);

            expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('HTTP/1.1 400 Bad Request'));
            expect(socket.destroy).toHaveBeenCalled();
        });

        it('should reject guest connection if guestName is missing', async () => {
            const req = { url: '/ws/chat?streamId=10' };
            const socket = { write: jest.fn(), destroy: jest.fn() };

            await emitUpgradeAsync(req, socket);

            expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('HTTP/1.1 401 Unauthorized'));
            expect(socket.destroy).toHaveBeenCalled();
        });

        it('should reject guest connection if guestName is too long (>50 chars)', async () => {
            const req = { url: `/ws/chat?streamId=10&guestName=${'a'.repeat(51)}` };
            const socket = { write: jest.fn(), destroy: jest.fn() };

            await emitUpgradeAsync(req, socket);

            expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('HTTP/1.1 400 Bad Request'));
            expect(socket.destroy).toHaveBeenCalled();
        });

        it('should allow guest connection with valid guestName and upgrade successfully', async () => {
            const req = { url: '/ws/chat?streamId=10&guestName=Bob' };
            const socket = { write: jest.fn(), destroy: jest.fn() };

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
            const socket = { write: jest.fn(), destroy: jest.fn() };

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

        it('should enforce concurrency limit of 50 connections per stream', async () => {
            const socket = { write: jest.fn(), destroy: jest.fn() };
            
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
            const socket = { write: jest.fn(), destroy: jest.fn() };

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
    });
});
