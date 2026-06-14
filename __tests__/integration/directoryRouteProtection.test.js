const request = require('supertest');
const app = require('../../src/server');
const db = require('../../src/config/db');
const MemberDirectoryService = require('../../src/services/MemberDirectoryService');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../../src/services/MemberDirectoryService');

const mkToken = (role) => jwt.sign(
    { user_id: `${role}-1`, role, email: `${role}@x.com`, token_version: 1 },
    process.env.JWT_SECRET || 'test-jwt-secret'
);

// Route-protection matrix (Epic 2 retro recommendation): every directory route
// asserts the right auth/authz boundary.
describe('Directory route protection matrix', () => {
    let memberToken;
    let adminToken;

    beforeAll(() => {
        memberToken = mkToken('member');
        adminToken = mkToken('admin');
    });

    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        db.query.mockImplementation((sql, params) => {
            const id = params && params[0];
            const role = String(id || '').startsWith('admin') ? 'admin' : 'member';
            return Promise.resolve({ rows: [{ id, token_version: 1, role, email: `${role}@x.com` }] });
        });
        MemberDirectoryService.listListedProfiles.mockResolvedValue({ profiles: [], totalCount: 0, totalPages: 0, currentPage: 1 });
        MemberDirectoryService.getNudgeState.mockResolvedValue({ showNudge: false });
        MemberDirectoryService.listAllMembersForAdmin.mockResolvedValue({ members: [], totalCount: 0, totalPages: 0, currentPage: 1 });
    });

    const whenUnauthenticated = async (method, path) => {
        // The test-mode auth fallback injects an admin when no token; flip to
        // development so the real redirect path runs (mirrors archiveRoutes.test.js).
        const orig = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const res = await request(app)[method](path);
        process.env.NODE_ENV = orig;
        return res;
    };

    describe('member-facing routes require authentication (R15)', () => {
        it('GET /directory redirects an unauthenticated visitor to login', async () => {
            const res = await whenUnauthenticated('get', '/directory');
            expect(res.status).toBe(302);
            expect(res.header.location).toMatch(/\/login/);
        });

        it('GET /directory/:id redirects an unauthenticated visitor to login', async () => {
            const res = await whenUnauthenticated('get', '/directory/some-id');
            expect(res.status).toBe(302);
            expect(res.header.location).toMatch(/\/login/);
        });

        it('GET /directory returns 200 for an authenticated member', async () => {
            const res = await request(app).get('/directory').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(200);
        });
    });

    describe('admin routes require MANAGE_DIRECTORY (R16/R17)', () => {
        it('GET /admin/directory: 403 for a member, 200 for an admin', async () => {
            const memberRes = await request(app).get('/admin/directory').set('Cookie', [`auth_token=${memberToken}`]);
            expect(memberRes.status).toBe(403);
            expect(MemberDirectoryService.listAllMembersForAdmin).not.toHaveBeenCalled();

            const adminRes = await request(app).get('/admin/directory').set('Cookie', [`auth_token=${adminToken}`]);
            expect(adminRes.status).toBe(200);
            expect(MemberDirectoryService.listAllMembersForAdmin).toHaveBeenCalled();
        });

        it('POST /admin/directory/moderate: 403 for a member', async () => {
            const res = await request(app)
                .post('/admin/directory/moderate')
                .set('Cookie', [`auth_token=${memberToken}`])
                .send({ user_id: 'u2', unlist: 'on' });
            expect(res.status).toBe(403);
            expect(MemberDirectoryService.moderateProfile).not.toHaveBeenCalled();
        });
    });
});
