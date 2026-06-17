const request = require('supertest');
const app = require('../../src/server');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
// Mock Redis so requiring src/server.js doesn't open a real connection whose late
// 'connect' event logs after tests finish (mirrors peer integration tests).
jest.mock('../../src/config/redis', () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([])
}));

describe('Static asset caching', () => {
    it('serves public assets with a Cache-Control max-age so browsers can cache them', async () => {
        const res = await request(app).get('/favicon.svg');

        expect(res.status).toBe(200);
        // A real caching window, not express.static's default max-age=0 (which
        // forces a revalidation round-trip on every asset request).
        const match = /max-age=(\d+)/.exec(res.headers['cache-control'] || '');
        expect(match).not.toBeNull();
        expect(Number(match[1])).toBeGreaterThanOrEqual(3600);
    });

    it('keeps ETag revalidation (correctness on deploy — assets are not fingerprinted)', async () => {
        const res = await request(app).get('/favicon.svg');

        expect(res.status).toBe(200);
        expect(res.headers['etag']).toBeDefined();
    });
});
