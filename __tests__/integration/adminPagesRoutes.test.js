const request = require('supertest');
const jwt = require('jsonwebtoken');
const pageController = require('../../src/controllers/pageController');
const db = require('../../src/config/db');

jest.mock('../../src/controllers/pageController', () => ({
    getPageForAdmin: jest.fn(),
    getAllPagesForAdmin: jest.fn(),
    getVersionHistory: jest.fn(),
    updatePage: jest.fn(),
    publishPage: jest.fn(),
    restoreVersion: jest.fn()
}));

// The NODE_ENV=test auth fallback only injects a hardcoded admin user, so
// role-specific RBAC is exercised with signed auth_token cookies backed by a
// db mock (mirrors directoryRouteProtection.test.js).
jest.mock('../../src/config/db', () => ({ query: jest.fn() }));

const app = require('../../src/server');

const mkToken = (role) => jwt.sign(
    { user_id: `${role}-1`, role, email: `${role}@x.com`, token_version: 1 },
    process.env.JWT_SECRET || 'test-jwt-secret'
);

describe('Admin Pages Routes', () => {
    beforeEach(() => {
        pageController.getPageForAdmin.mockResolvedValue({
            id: 'page-1',
            slug: 'about',
            title: 'About',
            content: '<p>About</p>',
            published: true
        });
        pageController.getAllPagesForAdmin.mockResolvedValue([
            { slug: 'about', title: 'About the Temple', published: false, updated_at: new Date('2026-06-01') },
            { slug: 'privacy', title: 'Privacy Policy', published: true, updated_at: new Date('2026-06-01') }
        ]);
        pageController.getVersionHistory.mockResolvedValue([]);
        pageController.updatePage.mockResolvedValue({ id: 'page-1', title: 'About' });
        pageController.publishPage.mockResolvedValue({ id: 'page-1', title: 'About', published: true });
        pageController.restoreVersion.mockResolvedValue({ id: 'page-1', title: 'About' });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('GET /admin/pages lists the static pages with edit links', async () => {
        const res = await request(app).get('/admin/pages');

        expect(res.status).toBe(200);
        expect(res.text).toContain('About the Temple');
        expect(res.text).toContain('Privacy Policy');
        expect(res.text).toContain('/admin/pages/about');
        expect(res.text).toContain('/admin/pages/privacy');
        expect(pageController.getAllPagesForAdmin).toHaveBeenCalled();
    });

    it('GET /admin/pages/:slug renders edit page', async () => {
        const res = await request(app).get('/admin/pages/about');

        expect(res.status).toBe(200);
        expect(res.text).toContain('Edit About');
        expect(pageController.getPageForAdmin).toHaveBeenCalledWith('about');
    });

    it('POST /admin/pages/:slug validates required fields', async () => {
        const res = await request(app)
            .post('/admin/pages/about')
            .send({ title: '', content: '' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual(expect.objectContaining({ error: 'Title and content are required' }));
    });

    it('POST /admin/pages/:slug/publish validates boolean payload', async () => {
        const res = await request(app)
            .post('/admin/pages/about/publish')
            .send({ published: 'yes' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual(expect.objectContaining({ error: 'Published must be a boolean value' }));
    });

    it('GET /admin/pages/:slug/versions returns versions', async () => {
        const res = await request(app).get('/admin/pages/about/versions');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ success: true, versions: [] }));
    });

    it('POST /admin/pages/:slug/restore/:versionNumber restores version', async () => {
        const res = await request(app).post('/admin/pages/about/restore/2');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ success: true }));
        expect(pageController.restoreVersion).toHaveBeenCalledWith('about', 2, expect.any(String));
    });

    // KTD4: the Rabbi role holds MANAGE_CONTENT, and the grant deliberately
    // spans every CMS page (the permission is all-or-nothing across /admin/pages/*).
    describe('RBAC: role reach on /admin/pages/*', () => {
        let rabbiToken;
        let memberToken;

        beforeAll(() => {
            rabbiToken = mkToken('rabbi');
            memberToken = mkToken('member');
        });

        beforeEach(() => {
            db.query.mockImplementation((sql, params) => {
                const id = params && params[0];
                const role = String(id || '').split('-')[0];
                return Promise.resolve({ rows: [{ id, token_version: 1, role, email: `${role}@x.com` }] });
            });
        });

        it('a rabbi can open the About edit page', async () => {
            const res = await request(app)
                .get('/admin/pages/about')
                .set('Cookie', [`auth_token=${rabbiToken}`]);
            expect(res.status).toBe(200);
            expect(pageController.getPageForAdmin).toHaveBeenCalledWith('about');
        });

        it('a rabbi can save and publish a page', async () => {
            const saveRes = await request(app)
                .post('/admin/pages/about')
                .set('Cookie', [`auth_token=${rabbiToken}`])
                .send({ title: 'About', content: '<p>About</p>' });
            expect(saveRes.status).toBe(200);
            expect(pageController.updatePage).toHaveBeenCalled();

            const publishRes = await request(app)
                .post('/admin/pages/about/publish')
                .set('Cookie', [`auth_token=${rabbiToken}`])
                .send({ published: true });
            expect(publishRes.status).toBe(200);
            expect(pageController.publishPage).toHaveBeenCalled();
        });

        it('a rabbi also reaches the legal pages (full documented reach of the grant)', async () => {
            const res = await request(app)
                .get('/admin/pages/privacy')
                .set('Cookie', [`auth_token=${rabbiToken}`]);
            expect(res.status).toBe(200);
            expect(pageController.getPageForAdmin).toHaveBeenCalledWith('privacy');
        });

        it('a member still receives 403 on /admin/pages/*', async () => {
            const res = await request(app)
                .get('/admin/pages/about')
                .set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(403);
            expect(pageController.getPageForAdmin).not.toHaveBeenCalled();
        });
    });
});
