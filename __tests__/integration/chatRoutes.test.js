process.env.JWT_SECRET = 'test-jwt-secret';

const request = require('supertest');
const app = require('../../src/server');
const jwt = require('jsonwebtoken');

// Mock database config
jest.mock('../../src/config/db', () => {
    const mPool = {
        query: jest.fn(),
        connect: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
    };
    return {
        query: jest.fn(),
        pool: mPool
    };
});

const db = require('../../src/config/db');

// Mock audit service
jest.mock('../../src/services/auditService', () => ({
    log: jest.fn().mockResolvedValue(true),
    logAudit: jest.fn().mockResolvedValue(true),
    AUDIT_ACTIONS: {
        CHAT_MESSAGE_APPROVED: 'CHAT_MESSAGE_APPROVED',
        CHAT_MESSAGE_DELETED: 'CHAT_MESSAGE_DELETED',
        UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS'
    }
}));

// Mock chat socket server to prevent real broadcast attempts
jest.mock('../../src/services/chatSocketServer', () => ({
    broadcastMessage: jest.fn(),
    broadcastToModerators: jest.fn(),
    getActiveConnectionCount: jest.fn().mockReturnValue(5)
}));

// Mock express session middleware to bypass timeouts during tests
jest.mock('../../src/middleware/sessionTimeout', () => {
    return jest.fn((options) => {
        return (req, res, next) => next();
    });
});

const chatSocketServer = require('../../src/services/chatSocketServer');

const JWT_SECRET = process.env.JWT_SECRET;

describe('Chat Routes Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Robust mock database query handler
        db.query.mockImplementation((sql, params) => {
            const queryStr = sql.toLowerCase();
            
            // requireAuth user lookup
            if (queryStr.includes('token_version')) {
                const userId = params[0];
                let role = 'member';
                if (userId === 'admin-001') role = 'admin';
                else if (userId === 'rabbi-001') role = 'rabbi';
                
                return Promise.resolve({
                    rows: [{ token_version: 1, role, email: `${role}@example.com` }],
                    rowCount: 1
                });
            }

            // resolveUserDisplayName lookup
            if (queryStr.includes('first_name')) {
                return Promise.resolve({
                    rows: [{ first_name: 'Rachel', last_name: 'Cohen', email: 'rachel@example.com' }],
                    rowCount: 1
                });
            }

            // getApprovedMessagesForStream
            if (queryStr.includes("status = 'approved'") && queryStr.includes('stream_id = $1')) {
                return Promise.resolve({
                    rows: [
                        { id: 1, stream_id: 10, display_name: 'David', message_text: 'Shabbat Shalom', status: 'approved', created_at: '2026-05-22T10:00:00.000Z' },
                        { id: 2, stream_id: 10, display_name: 'Sarah', message_text: 'Good morning!', status: 'approved', created_at: '2026-05-22T10:05:00.000Z' }
                    ],
                    rowCount: 2
                });
            }

            // INSERT INTO chat_messages
            if (queryStr.includes('insert into chat_messages')) {
                return Promise.resolve({
                    rows: [{
                        id: 101,
                        stream_id: params[0],
                        user_id: params[1],
                        display_name: params[2],
                        message_text: params[3],
                        status: params[4] || 'approved',
                        created_at: new Date().toISOString()
                    }],
                    rowCount: 1
                });
            }

            // UPDATE chat_messages (approve or delete)
            if (queryStr.includes('update chat_messages')) {
                const id = parseInt(params[0], 10);
                if (id === 999) {
                    return Promise.resolve({ rows: [], rowCount: 0 });
                }
                const status = queryStr.includes('approved') ? 'approved' : 'deleted';
                return Promise.resolve({
                    rows: [{
                        id,
                        stream_id: 12,
                        display_name: 'Alice',
                        message_text: status === 'approved' ? 'Hello' : 'Spam text',
                        status
                    }],
                    rowCount: 1
                });
            }

            return Promise.resolve({ rows: [], rowCount: 0 });
        });
    });

    describe('GET /api/chat/poll', () => {
        it('should return error if streamId query param is missing', async () => {
            const res = await request(app).get('/api/chat/poll');
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Valid streamId is required');
        });

        it('should return error if streamId query param is non-numeric', async () => {
            const res = await request(app).get('/api/chat/poll?streamId=abc');
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Valid streamId is required');
        });

        it('should return approved messages for streamId', async () => {
            const res = await request(app).get('/api/chat/poll?streamId=10');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].display_name).toBe('David');
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("WHERE stream_id = $1 AND status = 'approved'"),
                [10]
            );
        });

        it('should filter messages by since timestamp', async () => {
            const sinceTimestamp = new Date('2026-05-22T10:02:00.000Z').getTime();
            const res = await request(app).get(`/api/chat/poll?streamId=10&since=${sinceTimestamp}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].display_name).toBe('Sarah');
        });
    });

    describe('POST /api/chat/post', () => {
        it('should create message as guest with pending status and notify moderators', async () => {
            const res = await request(app)
                .post('/api/chat/post')
                .send({
                    streamId: 10,
                    displayName: 'GuestBob',
                    messageText: 'Hello temple!'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('pending');
            expect(chatSocketServer.broadcastToModerators).toHaveBeenCalledWith(10, expect.any(Object));
        });

        it('should return error if streamId is missing', async () => {
            const res = await request(app)
                .post('/api/chat/post')
                .send({
                    displayName: 'GuestBob',
                    messageText: 'Hello temple!'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Stream ID is required');
        });

        it('should resolve display name if posted by an authenticated member', async () => {
            const memberToken = jwt.sign({ user_id: 'member-001', role: 'member', token_version: 1 }, JWT_SECRET);

            const res = await request(app)
                .post('/api/chat/post')
                .set('Accept', 'application/json')
                .set('Cookie', [`auth_token=${memberToken}`])
                .send({
                    streamId: 10,
                    messageText: 'Beautiful service!'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.display_name).toBe('Rachel Cohen');
        });
    });

    describe('POST /api/chat/message/:id/approve', () => {
        it('should require authentication and deny members without Permission.MODERATE_CHAT', async () => {
            const memberToken = jwt.sign({ user_id: 'member-001', role: 'member', token_version: 1 }, JWT_SECRET);

            const res = await request(app)
                .post('/api/chat/message/45/approve')
                .set('Accept', 'application/json')
                .set('Cookie', [`auth_token=${memberToken}`]);

            expect(res.statusCode).toBe(403);
            expect(res.body.error).toBe('Access Denied');
        });

        it('should allow Rabbi/Social Chair/Admin to approve message', async () => {
            const rabbiToken = jwt.sign({ user_id: 'rabbi-001', role: 'rabbi', token_version: 1 }, JWT_SECRET);

            const res = await request(app)
                .post('/api/chat/message/45/approve')
                .set('Accept', 'application/json')
                .set('Cookie', [`auth_token=${rabbiToken}`]);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('approved');
            expect(chatSocketServer.broadcastMessage).toHaveBeenCalledWith(12, {
                type: 'message_approved',
                data: expect.objectContaining({ id: 45, status: 'approved' })
            });
        });

        it('should return 404 if message does not exist', async () => {
            const adminToken = jwt.sign({ user_id: 'admin-001', role: 'admin', token_version: 1 }, JWT_SECRET);

            const res = await request(app)
                .post('/api/chat/message/999/approve')
                .set('Accept', 'application/json')
                .set('Cookie', [`auth_token=${adminToken}`]);

            expect(res.statusCode).toBe(404);
            expect(res.body.error).toBe('Message not found');
        });
    });

    describe('POST /api/chat/message/:id/delete', () => {
        it('should allow Moderator to delete message', async () => {
            const adminToken = jwt.sign({ user_id: 'admin-001', role: 'admin', token_version: 1 }, JWT_SECRET);

            const res = await request(app)
                .post('/api/chat/message/46/delete')
                .set('Accept', 'application/json')
                .set('Cookie', [`auth_token=${adminToken}`]);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('deleted');
            expect(chatSocketServer.broadcastMessage).toHaveBeenCalledWith(12, {
                type: 'message_deleted',
                data: { id: 46 }
            });
        });
    });
});
