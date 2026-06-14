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

describe('Directory listing edit form accessibility (WCAG AA, R19)', () => {
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

    it('edit form has no WCAG AA violations', async () => {
        MemberDirectoryService.getMyProfile.mockResolvedValue({
            first_name: 'Member', last_name: 'One', email: 'm@x.com',
            listed: false, show_phone: false, show_email: false, show_household: false,
            phone: '', household: '', bio: '', interests: ''
        });
        const res = await request(app).get('/account/directory').set('Cookie', [`auth_token=${token}`]);
        expect(res.status).toBe(200);
        const results = await axe(res.text, AXE_OPTS);
        expect(results).toHaveNoViolations();
    });
});
