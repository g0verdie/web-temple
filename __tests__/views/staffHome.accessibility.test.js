/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.setImmediate = global.setImmediate || process.nextTick;

const request = require('supertest');
const { axe, toHaveNoViolations } = require('jest-axe');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/StreamingService', () => ({ getPublicEmbedMetadata: jest.fn().mockResolvedValue(null) }));

const app = require('../../src/server');
const db = require('../../src/config/db');

expect.extend(toHaveNoViolations);
const AXE = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } };

describe('Staff admin landing accessibility (WCAG AA)', () => {
    afterEach(() => jest.clearAllMocks());

    test('social chair landing has no violations', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'chair-1', token_version: 1, role: 'social_chair', email: 'c@x.com' }] });
        const token = jwt.sign({ user_id: 'chair-1', role: 'social_chair', email: 'c@x.com', token_version: 1 }, process.env.JWT_SECRET || 'test-jwt-secret');

        const res = await request(app).get('/admin').set('Cookie', [`auth_token=${token}`]);

        expect(res.status).toBe(200);
        expect(await axe(res.text, AXE)).toHaveNoViolations();
    });
});
