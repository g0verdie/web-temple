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
const BROWSER_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

describe('403 no-access page accessibility (WCAG AA)', () => {
    afterEach(() => jest.clearAllMocks());

    test.each(['social_chair', 'member'])('no-access page for %s has no violations', async (role) => {
        const id = `${role}-1`;
        db.query.mockResolvedValue({ rows: [{ id, token_version: 1, role, email: `${id}@x.com` }] });
        const token = jwt.sign({ user_id: id, role, email: `${id}@x.com`, token_version: 1 }, process.env.JWT_SECRET || 'test-jwt-secret');

        const res = await request(app).get('/admin/donations').set('Cookie', [`auth_token=${token}`]).set('Accept', BROWSER_ACCEPT);

        expect(res.status).toBe(403);
        expect(await axe(res.text, AXE)).toHaveNoViolations();
    });
});
