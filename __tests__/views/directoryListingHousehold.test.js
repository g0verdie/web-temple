const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/server');
const db = require('../../src/config/db');
const MemberDirectoryService = require('../../src/services/MemberDirectoryService');
const userService = require('../../src/services/userService');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../../src/services/MemberDirectoryService');
// The editor is now a section of /account/settings, which also loads account settings.
jest.mock('../../src/services/userService');

describe('Directory listing edit view: structured household markup', () => {
    let token;

    beforeAll(() => {
        token = jwt.sign(
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
    });

    const render = async () =>
        request(app).get('/account/settings').set('Cookie', [`auth_token=${token}`]);

    test('renders the household table and the add-person modal (no textarea)', async () => {
        MemberDirectoryService.getMyProfile.mockResolvedValue({
            first_name: 'Member', last_name: 'One', email: 'm@x.com',
            listed: false, show_phone: false, show_email: false, show_household: false, show_address: false,
            phone: '', address: '', household: [], bio: '', interests: ''
        });

        const res = await render();
        expect(res.status).toBe(200);
        // Structured table replaces the old free-text textarea.
        expect(res.text).toContain('id="householdTable"');
        expect(res.text).toContain('id="householdRows"');
        expect(res.text).toContain('Add person');
        // Modal markup present (a hidden div toggled by JS, role=dialog).
        expect(res.text).toContain('id="householdModal"');
        expect(res.text).toMatch(/role="dialog"/);
        expect(res.text).not.toContain('<textarea id="household"');
        // External, CSP-clean client JS is referenced.
        expect(res.text).toContain('/js/directory-listing.js');
    });

    test('renders existing household members as table rows (escaped)', async () => {
        MemberDirectoryService.getMyProfile.mockResolvedValue({
            first_name: 'Member', last_name: 'One', email: 'm@x.com',
            listed: true, show_phone: false, show_email: false, show_household: true, show_address: false,
            phone: '', address: '',
            household: [{ name: 'Dana <Q>', relationship: 'Spouse', birthday: '1980-05-01' }],
            bio: '', interests: ''
        });

        const res = await render();
        expect(res.status).toBe(200);
        expect(res.text).toContain('data-cell="name"');
        expect(res.text).toContain('Spouse');
        expect(res.text).toContain('1980-05-01');
        // EJS <%= %> escapes — the angle brackets must not appear raw.
        expect(res.text).toContain('Dana &lt;Q&gt;');
        expect(res.text).not.toContain('Dana <Q>');
    });

    test('the edit view has no inline <script> or <style> (CSP)', async () => {
        MemberDirectoryService.getMyProfile.mockResolvedValue({
            first_name: 'Member', last_name: 'One', email: 'm@x.com',
            listed: false, show_phone: false, show_email: false, show_household: false, show_address: false,
            phone: '', address: '', household: [], bio: '', interests: ''
        });

        const res = await render();
        // Only external scripts (src=) and CSP-safe application/ld+json data blocks (KTD9) are allowed; no executable inline script bodies.
        expect(res.text).not.toMatch(/<script(?![^>]*\ssrc=)(?![^>]*\stype=["']application\/ld\+json["'])[^>]*>/i);
        expect(res.text).not.toMatch(/<style[\s>]/i);
        expect(res.text).not.toMatch(/\sstyle\s*=\s*["']/i);
        expect(res.text).not.toMatch(/\son[a-z]+\s*=\s*["']/i);
    });
});
