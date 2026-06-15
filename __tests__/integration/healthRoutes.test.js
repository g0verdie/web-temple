/**
 * U3 — /ready deep-health probe (and /health stays liveness-only).
 *
 * /ready runs db.query('SELECT 1') + redis.ping(); 200 when both succeed, 503
 * with per-check status when either fails. db + redis are mocked per the
 * existing integration-test pattern.
 */

const request = require('supertest');

const mockQuery = jest.fn();
const mockPing = jest.fn();

jest.mock('../../src/config/db', () => ({ query: mockQuery, pool: { end: jest.fn() } }));
jest.mock('../../src/config/redis', () => ({
  ping: mockPing,
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  quit: jest.fn()
}));

const app = require('../../src/server');

describe('GET /ready (deep readiness probe, U3)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockPing.mockReset();
  });

  test('200 ready when both DB and Redis succeed', async () => {
    mockQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    mockPing.mockResolvedValue('PONG');

    const res = await request(app).get('/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready', checks: { db: 'ok', redis: 'ok' } });
  });

  test('503 degraded with db failed when the DB query rejects', async () => {
    mockQuery.mockRejectedValue(new Error('connection refused'));
    mockPing.mockResolvedValue('PONG');

    const res = await request(app).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks).toEqual({ db: 'failed', redis: 'ok' });
  });

  test('503 degraded with redis failed when the Redis ping rejects', async () => {
    mockQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    mockPing.mockRejectedValue(new Error('redis down'));

    const res = await request(app).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks).toEqual({ db: 'ok', redis: 'failed' });
  });

  test('503 with both failed when DB and Redis are both down', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    mockPing.mockRejectedValue(new Error('redis down'));

    const res = await request(app).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body.checks).toEqual({ db: 'failed', redis: 'failed' });
  });
});

describe('GET /health remains liveness-only (U3 leaves it unchanged)', () => {
  test('returns 200 with uptime regardless of downstream state', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    mockPing.mockRejectedValue(new Error('redis down'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ status: 'ok' }));
    expect(typeof res.body.uptime).toBe('number');
  });
});
