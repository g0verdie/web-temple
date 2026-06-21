const request = require('supertest');
const app = require('../../src/server');
const db = require('../../src/config/db');
const messageService = require('../../src/services/messageService');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../../src/services/messageService');

const mkToken = (role) => jwt.sign(
    { user_id: `${role}-1`, role, email: `${role}@x.com`, token_version: 1 },
    process.env.JWT_SECRET || 'test-jwt-secret'
);

describe('Admin contact-message inbox routes (item 9, MANAGE_MESSAGES)', () => {
    let adminToken, memberToken;

    beforeAll(() => {
        adminToken = mkToken('admin');
        memberToken = mkToken('member');
    });

    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        db.query.mockImplementation((sql, params) => {
            const id = params && params[0];
            const role = String(id || '').startsWith('admin') ? 'admin' : 'member';
            return Promise.resolve({ rows: [{ id, token_version: 1, role, email: `${role}@x.com` }] });
        });
        // The controller reads messageService.STATUSES; jest auto-mock leaves it undefined.
        messageService.STATUSES = ['new', 'read', 'replied', 'archived'];
    });

    describe('MANAGE_MESSAGES gate', () => {
        it('blocks a member from the inbox (403)', async () => {
            const res = await request(app).get('/admin/messages').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(403);
            expect(messageService.listMessages).not.toHaveBeenCalled();
        });

        it('blocks a member from deleting (403)', async () => {
            const res = await request(app).post('/admin/messages/m1/delete').set('Cookie', [`auth_token=${memberToken}`]).send({});
            expect(res.status).toBe(403);
            expect(messageService.deleteMessage).not.toHaveBeenCalled();
        });
    });

    describe('admin access', () => {
        it('lists messages', async () => {
            messageService.listMessages.mockResolvedValue({
                messages: [{ id: 'm1', name: 'A', email: 'a@x.com', subject: 'Hello world', status: 'new', created_at: new Date() }],
                totalCount: 1, totalPages: 1, currentPage: 1
            });
            const res = await request(app).get('/admin/messages').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).toContain('Hello world');
        });

        it('views a message and marks new -> read', async () => {
            messageService.getMessageById.mockResolvedValue({ id: 'm1', name: 'A', email: 'a@x.com', subject: 'Subj', message: 'Body', status: 'new', created_at: new Date() });
            messageService.updateStatus.mockResolvedValue(true);
            const res = await request(app).get('/admin/messages/m1').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(messageService.updateStatus).toHaveBeenCalledWith('m1', 'read');
        });

        it('404s an unknown message', async () => {
            messageService.getMessageById.mockResolvedValue(null);
            const res = await request(app).get('/admin/messages/zzz').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(404);
        });

        it('updates status and redirects with success', async () => {
            messageService.updateStatus.mockResolvedValue(true);
            const res = await request(app).post('/admin/messages/m1/status').set('Cookie', [`auth_token=${adminToken}`]).send({ status: 'replied' });
            expect(res.status).toBe(302);
            expect(res.header.location).toMatch(/\/admin\/messages\?success=/);
            expect(messageService.updateStatus).toHaveBeenCalledWith('m1', 'replied');
        });

        it('deletes and redirects with success', async () => {
            messageService.deleteMessage.mockResolvedValue(true);
            const res = await request(app).post('/admin/messages/m1/delete').set('Cookie', [`auth_token=${adminToken}`]).send({});
            expect(res.status).toBe(302);
            expect(res.header.location).toMatch(/\/admin\/messages\?success=/);
        });
    });
});
