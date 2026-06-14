const request = require('supertest');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/config/redis', () => ({ get: jest.fn(), setex: jest.fn(), del: jest.fn(), keys: jest.fn() }));

const app = require('../../src/server');

describe('GET /health (liveness probe for external uptime monitoring, FR67)', () => {
    test('returns a fast 200 with status ok, no auth required', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/json');
        expect(res.body).toEqual(expect.objectContaining({ status: 'ok' }));
        expect(typeof res.body.uptime).toBe('number');
    });
});
