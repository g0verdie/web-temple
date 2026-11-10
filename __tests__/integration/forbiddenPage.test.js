/**
 * Browser "no access" page (R5) vs the unchanged JSON 403 (R6).
 * RBAC reads the role from the mocked DB row; the layout nav reads it from the
 * token, so both carry the same role.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/StreamingService', () => ({ getPublicEmbedMetadata: jest.fn().mockResolvedValue(null) }));

const app = require('../../src/server');
const db = require('../../src/config/db');

const BROWSER_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

const loginAs = (role) => {
    const id = `${role}-1`;
    db.query.mockResolvedValue({ rows: [{ id, token_version: 1, role, email: `${id}@x.com` }] });
    const token = jwt.sign(
        { user_id: id, role, email: `${id}@x.com`, token_version: 1 },
        process.env.JWT_SECRET || 'test-jwt-secret'
    );
    return [`auth_token=${token}`];
};

describe('403 no-access page', () => {
    afterEach(() => jest.clearAllMocks());

    test('social chair opening /admin/donations in a browser gets the site page with nav and a link to /admin (AE3)', async () => {
        const res = await request(app)
            .get('/admin/donations')
            .set('Cookie', loginAs('social_chair'))
            .set('Accept', BROWSER_ACCEPT);

        expect(res.status).toBe(403);
        expect(res.headers['content-type']).toContain('text/html');
        expect(res.text).toContain('You don&#39;t have access to this page');
        expect(res.text).toContain('Main navigation');
        expect(res.text).toContain('<a class="c-btn c-btn--navigational" href="/admin">Back to admin</a>');
        expect(res.text).toContain('<meta name="robots" content="noindex">');
        expect(res.text).not.toContain('requires one of');
        expect(res.text).not.toContain('Access Denied');
    });

    test('a member opening /admin/donations in a browser gets a link to the homepage, not /admin', async () => {
        const res = await request(app)
            .get('/admin/donations')
            .set('Cookie', loginAs('member'))
            .set('Accept', BROWSER_ACCEPT);

        expect(res.status).toBe(403);
        expect(res.text).toContain('You don&#39;t have access to this page');
        expect(res.text).toContain('<a class="c-btn c-btn--navigational" href="/">Back to the homepage</a>');
        expect(res.text).not.toContain('Back to admin');
    });

    test('a request with no Accept header keeps the JSON 403 body (AE4)', async () => {
        const res = await request(app).get('/admin/donations').set('Cookie', loginAs('social_chair'));

        expect(res.status).toBe(403);
        expect(res.body).toEqual({
            error: 'Access Denied',
            message: 'This resource requires view_donations permission'
        });
    });

    test('Accept: application/json keeps the JSON 403 body (AE4)', async () => {
        const res = await request(app)
            .get('/admin/donations')
            .set('Cookie', loginAs('social_chair'))
            .set('Accept', 'application/json');

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access Denied');
    });

    test('a browser-style request to an RBAC-guarded /api route still gets JSON', async () => {
        const res = await request(app)
            .post('/api/chat/message/1/approve')
            .set('Cookie', loginAs('member'))
            .set('Accept', BROWSER_ACCEPT);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access Denied');
    });
});
