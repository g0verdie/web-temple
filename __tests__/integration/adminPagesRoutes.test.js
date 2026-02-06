const request = require('supertest');
const pageController = require('../../src/controllers/pageController');

jest.mock('../../src/controllers/pageController', () => ({
    getPageForAdmin: jest.fn(),
    getVersionHistory: jest.fn(),
    updatePage: jest.fn(),
    publishPage: jest.fn(),
    restoreVersion: jest.fn()
}));

const app = require('../../src/server');

describe('Admin Pages Routes', () => {
    beforeEach(() => {
        pageController.getPageForAdmin.mockResolvedValue({
            id: 'page-1',
            slug: 'about',
            title: 'About',
            content: '<p>About</p>',
            published: true
        });
        pageController.getVersionHistory.mockResolvedValue([]);
        pageController.updatePage.mockResolvedValue({ id: 'page-1', title: 'About' });
        pageController.publishPage.mockResolvedValue({ id: 'page-1', title: 'About', published: true });
        pageController.restoreVersion.mockResolvedValue({ id: 'page-1', title: 'About' });
    });

    afterEach(() => {
        jest.clearAllMocks();
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
});
