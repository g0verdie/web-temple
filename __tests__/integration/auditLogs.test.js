const request = require('supertest');
const app = require('../../src/server');

// Mock db
const db = require('../../src/config/db');
// We need to mock the entire module to track calls
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

// Mock axios for captcha and email service if needed (message controller uses them)
jest.mock('axios', () => ({
    post: jest.fn().mockResolvedValue({ data: { success: true } })
}));

// Mock email service
jest.mock('../../src/services/emailService', () => ({
    sendContactNotification: jest.fn().mockResolvedValue(true)
}));

describe('Audit Logs Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('GET /admin/audit-logs should return 200 and render logs', async () => {
        // Mock audit logs query result
        db.query
            .mockResolvedValueOnce({ rows: [] }) // first call might be for dashboard or something else? auditService.queryLogs calls logs query
            .mockResolvedValueOnce({ rows: [{ count: 0 }] }); // auditService.queryLogs calls count query

        // auditService calls Promise.all([logQuery, countQuery])
        // The mock sequence depends on execution order.
        // Let's just mockResolvedValue for all calls to be safe/simple

        db.query.mockResolvedValue({ rows: [], rowCount: 0 });

        const res = await request(app).get('/admin/audit-logs');

        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('Audit Logs');
        expect(res.text).toContain('Filter Logs');
    });

    it('POST /contact should create an audit log entry', async () => {
        const messageData = {
            name: 'Test User',
            email: 'test@example.com',
            subject: 'Test Subject',
            message: 'Test Message',
            captchaToken: 'dummy-token'
        };

        // Mock message insertion
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, created_at: new Date() }] });

        // Mock audit insertion (second call)
        db.query.mockResolvedValueOnce({ rowCount: 1 });

        const res = await request(app)
            .post('/contact')
            .send(messageData);

        expect(res.statusCode).toBe(201);

        // Check if DB query was called for audit log
        // The first call is INSERT messages
        // The second call is INSERT audit_logs

        // We can check if any call matches audit log pattern
        const calls = db.query.mock.calls;
        const auditCall = calls.find(call => call[0].includes('INSERT INTO audit_logs'));

        expect(auditCall).toBeDefined();
        expect(auditCall[1]).toContain('MESSAGE_RECEIVED');
        expect(auditCall[1]).toContain('Message from Test User (test@example.com)');
    });

    it('GET /api/admin/audit-logs should return JSON', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ count: 0 }] });

        const res = await request(app).get('/api/admin/audit-logs');

        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toContain('application/json');
        expect(res.body).toEqual(
            expect.objectContaining({
                logs: expect.any(Array),
                total: expect.any(Number),
                limit: expect.any(Number),
                offset: expect.any(Number)
            })
        );
    });
});
