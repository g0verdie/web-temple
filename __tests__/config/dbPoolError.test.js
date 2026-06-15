/**
 * U2 — pg-pool 'error' handler.
 *
 * An idle-client 'error' (e.g. a DB failover dropping a connection) must be
 * logged + reported, not re-thrown to crash the process. Mirrors the existing
 * redis.on('error') listener.
 */

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));
jest.mock('../../src/config/sentry', () => ({
  initSentry: jest.fn(),
  captureException: jest.fn()
}));

const logger = require('../../src/utils/logger');
const sentry = require('../../src/config/sentry');
const { pool } = require('../../src/config/db');

describe('pg pool error handler (U2)', () => {
  beforeEach(() => {
    logger.error.mockClear();
    sentry.captureException.mockClear();
  });

  test('an idle-client error is logged at error level and reported, process survives', () => {
    const err = new Error('Connection terminated unexpectedly');

    // Emitting on a pool with a registered 'error' listener does not throw.
    expect(() => pool.emit('error', err)).not.toThrow();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][0]).toMatch(/pool error/i);
    expect(sentry.captureException).toHaveBeenCalledWith(err);
  });
});
