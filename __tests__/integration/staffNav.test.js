/**
 * Staff nav link (R1) — the Admin link shows for every staff role (any role that
 * holds a permission) and for nobody else. Hits a simple public page (/contact) so only the global
 * chrome middleware and the layout nav are exercised.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    pool: { end: jest.fn(), connect: jest.fn() }
}));
jest.mock('../../src/services/StreamingService');
jest.mock('../../src/services/EventService');

const StreamingService = require('../../src/services/StreamingService');
const EventService = require('../../src/services/EventService');
const app = require('../../src/server');

const cookieFor = (role) => {
    const token = jwt.sign(
        { user_id: `${role}-1`, role, email: `${role}@x.com`, token_version: 1 },
        process.env.JWT_SECRET || 'test-jwt-secret'
    );
    return [`auth_token=${token}`];
};

const navMenu = (html) => (html.match(/<ul class="nav-menu"[\s\S]*?<\/ul>/) || [''])[0];

beforeEach(() => {
    jest.clearAllMocks();
    StreamingService.getPublicEmbedMetadata.mockResolvedValue({ status: 'offline', embedUrl: null });
    EventService.getNextService.mockResolvedValue(null);
});

describe('Admin nav link (R1)', () => {
    it.each(['social_chair', 'treasurer', 'membership_director', 'rabbi', 'admin'])(
        'shows the Admin link for a signed-in %s',
        async (role) => {
            const res = await request(app).get('/contact').set('Cookie', cookieFor(role));
            expect(res.status).toBe(200);
            expect(navMenu(res.text)).toContain('href="/admin"');
        }
    );

    it('does not show the Admin link for a signed-in member', async () => {
        const res = await request(app).get('/contact').set('Cookie', cookieFor('member'));
        expect(res.status).toBe(200);
        expect(navMenu(res.text)).not.toContain('href="/admin"');
    });

    it('does not show the Admin link for a logged-out visitor', async () => {
        const res = await request(app).get('/contact');
        expect(res.status).toBe(200);
        expect(navMenu(res.text)).not.toContain('href="/admin"');
    });
});
