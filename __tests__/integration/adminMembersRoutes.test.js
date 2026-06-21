const request = require('supertest');
const app = require('../../src/server');
const db = require('../../src/config/db');
const memberAdminService = require('../../src/services/memberAdminService');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../../src/services/memberAdminService');

const mkToken = (role) => jwt.sign(
    { user_id: `${role}-1`, role, email: `${role}@x.com`, token_version: 1 },
    process.env.JWT_SECRET || 'test-jwt-secret'
);

describe('Admin members approval routes (item 6, MANAGE_MEMBERS)', () => {
    let adminToken, rabbiToken, memberToken;

    beforeAll(() => {
        adminToken = mkToken('admin');
        rabbiToken = mkToken('rabbi');
        memberToken = mkToken('member');
    });

    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        // requireAuth token_version check: echo a row matching the requesting user's role.
        db.query.mockImplementation((sql, params) => {
            const id = params && params[0];
            const idStr = String(id || '');
            const role = idStr.startsWith('admin') ? 'admin' : idStr.startsWith('rabbi') ? 'rabbi' : 'member';
            return Promise.resolve({ rows: [{ id, token_version: 1, role, email: `${role}@x.com` }] });
        });
    });

    describe('MANAGE_MEMBERS gate (privilege escalation prevention)', () => {
        it('blocks a member from the pending list (403)', async () => {
            const res = await request(app).get('/admin/members').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(403);
            expect(memberAdminService.listPendingApproval).not.toHaveBeenCalled();
        });

        it('blocks a member from approving (403)', async () => {
            const res = await request(app).post('/admin/members/u9/approve').set('Cookie', [`auth_token=${memberToken}`]).send({});
            expect(res.status).toBe(403);
            expect(memberAdminService.approveMember).not.toHaveBeenCalled();
        });

        it('blocks a member from rejecting (403)', async () => {
            const res = await request(app).post('/admin/members/u9/reject').set('Cookie', [`auth_token=${memberToken}`]).send({});
            expect(res.status).toBe(403);
            expect(memberAdminService.rejectMember).not.toHaveBeenCalled();
        });
    });

    describe('admin / rabbi access', () => {
        it('admin sees the pending list', async () => {
            memberAdminService.listPendingApproval.mockResolvedValue([
                { id: 'p1', email: 'pend@x.com', first_name: 'Pen', last_name: 'Ding', created_at: new Date() }
            ]);
            const res = await request(app).get('/admin/members').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).toContain('pend@x.com');
        });

        it('rabbi can also reach the pending list (MANAGE_MEMBERS granted)', async () => {
            memberAdminService.listPendingApproval.mockResolvedValue([]);
            const res = await request(app).get('/admin/members').set('Cookie', [`auth_token=${rabbiToken}`]);
            expect(res.status).toBe(200);
        });

        it('admin approve redirects with success', async () => {
            memberAdminService.approveMember.mockResolvedValue(true);
            const res = await request(app).post('/admin/members/p1/approve').set('Cookie', [`auth_token=${adminToken}`]).send({});
            expect(res.status).toBe(302);
            expect(res.header.location).toMatch(/\/admin\/members\?success=/);
            expect(memberAdminService.approveMember).toHaveBeenCalledWith('p1', 'admin-1', expect.anything());
        });

        it('approve no-op redirects with error (idempotent)', async () => {
            memberAdminService.approveMember.mockResolvedValue(false);
            const res = await request(app).post('/admin/members/p1/approve').set('Cookie', [`auth_token=${adminToken}`]).send({});
            expect(res.status).toBe(302);
            expect(res.header.location).toMatch(/\/admin\/members\?error=/);
        });

        it('admin reject redirects with success', async () => {
            memberAdminService.rejectMember.mockResolvedValue(true);
            const res = await request(app).post('/admin/members/p1/reject').set('Cookie', [`auth_token=${adminToken}`]).send({});
            expect(res.status).toBe(302);
            expect(res.header.location).toMatch(/\/admin\/members\?success=/);
        });
    });
});
