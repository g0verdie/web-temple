/**
 * U2 — process-level crash handlers (KTD8).
 *
 * uncaughtException: arm a non-unref force-exit(1) FIRST, then attempt the
 * shared graceful shutdown (best-effort). unhandledRejection: log + capture,
 * no force-exit. Both exported for direct invocation (registration is
 * suppressed under NODE_ENV==='test').
 */

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { end: jest.fn(() => Promise.resolve()) } }));
jest.mock('../../src/config/redis', () => ({ quit: jest.fn(() => Promise.resolve()) }));
jest.mock('../../src/services/chatSocketServer', () => ({
  initChatSocketServer: jest.fn(),
  closeAllConnections: jest.fn()
}));
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  stream: { write: jest.fn() }
}));
jest.mock('../../src/config/sentry', () => ({
  initSentry: jest.fn(),
  attachErrorHandler: jest.fn(),
  captureException: jest.fn()
}));

const logger = require('../../src/utils/logger');
const sentry = require('../../src/config/sentry');
const app = require('../../src/server');

describe('process crash handlers (U2)', () => {
  beforeEach(() => {
    logger.error.mockClear();
    sentry.captureException.mockClear();
    // No real runtime handles → shutdown only touches the mocked pool/redis.
    app._setShutdownHandles({ shuttingDown: false });
  });

  test('unhandledRejection logs + captures and does NOT force-exit', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const reason = new Error('escaped rejection');

    app.handleUnhandledRejection(reason);

    expect(logger.error).toHaveBeenCalled();
    expect(logger.error.mock.calls[0][0]).toMatch(/unhandled rejection/i);
    expect(sentry.captureException).toHaveBeenCalledWith(reason);
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  test('unhandledRejection wraps a non-Error reason into an Error', () => {
    jest.spyOn(process, 'exit').mockImplementation(() => {});
    app.handleUnhandledRejection('a string reason');
    const captured = sentry.captureException.mock.calls[0][0];
    expect(captured).toBeInstanceOf(Error);
    expect(captured.message).toBe('a string reason');
    process.exit.mockRestore();
  });

  test('uncaughtException arms a force-exit(1) timeout BEFORE shutdown, and does not hang', () => {
    jest.useFakeTimers();
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const err = new Error('fatal');

    app.handleUncaughtException(err);

    expect(logger.error).toHaveBeenCalled();
    expect(logger.error.mock.calls[0][0]).toMatch(/uncaught exception/i);
    expect(sentry.captureException).toHaveBeenCalledWith(err);

    // The force-exit is scheduled (armed before the async shutdown runs).
    jest.advanceTimersByTime(11000);
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    jest.useRealTimers();
  });
});
