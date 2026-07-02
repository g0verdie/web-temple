const request = require('supertest');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/config/redis', () => ({ get: jest.fn(), set: jest.fn(), setex: jest.fn(), del: jest.fn(), keys: jest.fn() }));

const app = require('../../src/server');

describe('Password-reset views are CSP-compliant (U1)', () => {
    test('GET /auth/request-password-reset uses the external script, no inline <script>', async () => {
        const res = await request(app).get('/auth/request-password-reset');
        expect(res.status).toBe(200);
        expect(res.text).toContain('/js/auth-request-password-reset.js');
        // A bare "<script>" (no src) would be an inline block blocked by CSP.
        expect(res.text).not.toContain('<script>');
    });

    test('GET /auth/reset-password uses the external script, no inline <script>', async () => {
        const res = await request(app).get('/auth/reset-password?token=abc');
        expect(res.status).toBe(200);
        expect(res.text).toContain('/js/auth-reset-password.js');
        expect(res.text).not.toContain('<script>');
    });
});
