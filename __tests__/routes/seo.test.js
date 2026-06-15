/**
 * SEO route + meta-tag integration tests (issue #12).
 *
 * Boots the real src/server.js, so it MUST mock src/config/redis (an unmocked
 * real Redis connection's late "error" log otherwise leaks into other suites).
 */

const request = require('supertest');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/config/redis', () => ({
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn()
}));

const app = require('../../src/server');

describe('GET /sitemap.xml', () => {
    test('returns 200 as application/xml', async () => {
        const res = await request(app).get('/sitemap.xml');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/xml');
    });

    test('lists the main public URLs with an absolute base', async () => {
        const res = await request(app).get('/sitemap.xml');
        const paths = ['/', '/about', '/contact', '/calendar', '/watch', '/archive', '/privacy', '/terms', '/accessibility'];
        for (const p of paths) {
            // Absolute URLs (host + path) inside <loc>.
            expect(res.text).toContain(`<loc>http://`);
            expect(res.text).toContain(`${p}</loc>`);
        }
        expect(res.text).toContain('<urlset');
    });
});

describe('GET /robots.txt', () => {
    test('returns 200 plain text that allows crawling and points at the sitemap', async () => {
        const res = await request(app).get('/robots.txt');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/plain');
        expect(res.text).toContain('User-agent: *');
        expect(res.text).toContain('Allow: /');
        expect(res.text).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
    });
});

describe('SEO meta tags in the shared layout (rendered on /contact)', () => {
    test('renders Open Graph, Twitter card, and canonical tags', async () => {
        const res = await request(app).get('/contact');
        expect(res.status).toBe(200);
        expect(res.text).toContain('property="og:title"');
        expect(res.text).toContain('property="og:description"');
        expect(res.text).toContain('property="og:type"');
        expect(res.text).toContain('property="og:url"');
        expect(res.text).toContain('property="og:site_name"');
        expect(res.text).toContain('property="og:image"');
        expect(res.text).toContain('name="twitter:card" content="summary_large_image"');
        expect(res.text).toContain('rel="canonical"');
    });

    test('uses the per-page description when a controller supplies one', async () => {
        const res = await request(app).get('/contact');
        // /contact passes a contact-specific description (issue #12 task 3).
        expect(res.text).toContain('Get in touch with Temple B&#39;nai Israel');
    });
});
