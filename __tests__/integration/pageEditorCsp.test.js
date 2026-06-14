const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/controllers/pageController', () => ({
    getPageForAdmin: jest.fn().mockResolvedValue({
        id: 1, slug: 'about', title: 'About', content: '<p>Hello <b>world</b></p>',
        published: true, created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-02')
    }),
    getVersionHistory: jest.fn().mockResolvedValue([]),
    updatePage: jest.fn(),
    publishPage: jest.fn(),
    restoreVersion: jest.fn()
}));

const app = require('../../src/server');
const db = require('../../src/config/db');

const adminToken = jwt.sign(
    { user_id: 'admin-1', role: 'admin', email: 'admin-1@x.com', token_version: 1 },
    process.env.JWT_SECRET || 'test-jwt-secret'
);

describe('Page editor is CSP-compliant (U3)', () => {
    beforeEach(() => {
        db.query.mockResolvedValue({ rows: [{ id: 'admin-1', token_version: 1, role: 'admin', email: 'admin-1@x.com' }] });
    });
    afterEach(() => jest.clearAllMocks());

    test('editor loads vendored Quill from /self, no CDN, no inline script/style', async () => {
        const res = await request(app).get('/admin/pages/about').set('Cookie', [`auth_token=${adminToken}`]);
        expect(res.status).toBe(200);
        // Vendored assets served from 'self'
        expect(res.text).toContain('/vendor/quill.js');
        expect(res.text).toContain('/vendor/quill.snow.css');
        expect(res.text).toContain('/css/page-editor.css');
        expect(res.text).toContain('/js/page-editor.js');
        // No blocked CDN, no inline script/style
        expect(res.text).not.toContain('cdn.quilljs.com');
        expect(res.text).not.toContain('<script>');
        expect(res.text).not.toContain('<style>');
    });

    test('existing page content is threaded via an escaped hidden element (not raw, not in a script)', async () => {
        const res = await request(app).get('/admin/pages/about').set('Cookie', [`auth_token=${adminToken}`]);
        expect(res.text).toContain('id="page-content-source"');
        // HTML-escaped in the textarea source...
        expect(res.text).toContain('&lt;p&gt;Hello &lt;b&gt;world&lt;/b&gt;&lt;/p&gt;');
        // ...and NOT interpolated raw into the page markup.
        expect(res.text).not.toContain('<p>Hello <b>world</b></p>');
    });
});
