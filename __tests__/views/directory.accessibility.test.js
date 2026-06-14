/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.setImmediate = global.setImmediate || process.nextTick;

const request = require('supertest');
const { axe, toHaveNoViolations } = require('jest-axe');
const jwt = require('jsonwebtoken');
const app = require('../../src/server');
const db = require('../../src/config/db');
const MemberDirectoryService = require('../../src/services/MemberDirectoryService');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../../src/services/MemberDirectoryService');

expect.extend(toHaveNoViolations);

const AXE_OPTS = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } };

describe('Member directory accessibility (WCAG AA, R19)', () => {
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
    });

    it('browse list (with search form + nudge) has no WCAG AA violations', async () => {
        MemberDirectoryService.listListedProfiles.mockResolvedValue({
            profiles: [{ user_id: 'u2', first_name: 'Ada', last_name: 'Lovelace', initials: 'AL', bio: 'b', interests: 'Youth Committee', email: 'ada@x.com' }],
            totalCount: 1, totalPages: 1, currentPage: 1
        });
        MemberDirectoryService.getNudgeState.mockResolvedValue({ showNudge: true });

        const res = await request(app).get('/directory').set('Cookie', [`auth_token=${token}`]);
        expect(res.status).toBe(200);
        const results = await axe(res.text, AXE_OPTS);
        expect(results).toHaveNoViolations();
    });

    it('member profile page has no WCAG AA violations', async () => {
        MemberDirectoryService.getListedProfile.mockResolvedValue({
            user_id: 'u2', first_name: 'Ada', last_name: 'Lovelace', initials: 'AL',
            bio: 'About Ada', interests: 'choir', household: 'Spouse', email: 'ada@x.com', phone: '555-0001'
        });
        const res = await request(app).get('/directory/u2').set('Cookie', [`auth_token=${token}`]);
        expect(res.status).toBe(200);
        const results = await axe(res.text, AXE_OPTS);
        expect(results).toHaveNoViolations();
    });
});
