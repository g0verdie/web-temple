/**
 * noindex coverage — merged from Stream A (U4: error pages + admin setter) and
 * Stream B (U7: auth/account page renders via layout.ejs).
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({
    query: jest.fn(),
    pool: { end: jest.fn(), connect: jest.fn() }
}));
jest.mock('../../src/config/redis', () => ({
    // A fresh "last activity" timestamp keeps sessionTimeout from expiring the
    // member session on the authenticated /account/* page renders.
    get: jest.fn().mockResolvedValue(String(Date.now())),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK')
}));
jest.mock('../../src/services/userService');
jest.mock('../../src/services/MemberDirectoryService');

const db = require('../../src/config/db');
const userService = require('../../src/services/userService');
const MemberDirectoryService = require('../../src/services/MemberDirectoryService');
const app = require('../../src/server');

const NOINDEX = /<meta\s+name=["']robots["']\s+content=["']noindex["']/i;

describe('noindex on error pages (U4)', () => {
    test('a 404 response renders the noindex robots meta', async () => {
        const res = await request(app).get('/this-route-does-not-exist-xyz');
        expect(res.status).toBe(404);
        expect(NOINDEX.test(res.text)).toBe(true);
    });

    test('the error view does NOT render the noindex meta when the local is absent (conditional, not unconditional)', (done) => {
        app.render('error', { title: 'X', message: 'Y' }, (err, html) => {
            expect(err).toBeNull();
            expect(html).not.toContain('content="noindex"');
            done();
        });
    });
});

describe('noindex on auth/account pages (U7)', () => {
    let memberToken;

    beforeAll(() => {
        memberToken = jwt.sign(
            { user_id: 'member-1', role: 'member', email: 'm@x.com', token_version: 1 },
            process.env.JWT_SECRET || 'test-jwt-secret'
        );
    });

    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        db.query.mockResolvedValue({ rows: [{ id: 'member-1', token_version: 1, role: 'member', email: 'm@x.com' }] });
        userService.getAccountSettings.mockResolvedValue({
            email: 'm@x.com', first_name: 'Member', last_name: 'One',
            notification_preferences: { announcements: true, calendar_events: true, messages: true, recordings: true }
        });
        MemberDirectoryService.getMyProfile.mockResolvedValue({
            email: 'm@x.com', listed: false, show_phone: false, show_email: false,
            show_household: false, show_address: false, show_birthday: false,
            phone: '', household: '', bio: '', interests: '', address: '', birthday: ''
        });
    });

    test.each([
        '/login',
        '/register',
        '/auth/request-password-reset',
        '/auth/reset-password',
        '/account/confirm-email'
    ])('public auth page %s emits the noindex meta', async (path) => {
        const res = await request(app).get(path);
        expect(res.status).toBe(200);
        expect(NOINDEX.test(res.text)).toBe(true);
    });

    test.each([
        // /account/directory now 301-redirects into /account/settings#directory-listing,
        // so only the consolidated settings page renders a noindex page directly.
        '/account/settings'
    ])('authenticated account page %s emits the noindex meta', async (path) => {
        const res = await request(app)
            .get(path)
            .set('Cookie', [`auth_token=${memberToken}`]);
        expect(res.status).toBe(200);
        expect(NOINDEX.test(res.text)).toBe(true);
    });

    test('a public page (contact) does NOT emit the noindex meta', async () => {
        const res = await request(app).get('/contact');
        expect(res.status).toBe(200);
        expect(NOINDEX.test(res.text)).toBe(false);
    });
});
