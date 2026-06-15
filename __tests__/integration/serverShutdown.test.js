/**
 * U1 — Graceful shutdown (KTD7).
 *
 * The exported shutdown() is invoked directly (signal registration is suppressed
 * under NODE_ENV==='test'). Runtime handles (server, wss, workers) are injected
 * via the _setShutdownHandles test seam so no real port/handle is opened. db and
 * redis are mocked at module load so server.js wires no real client.
 */

const mockPoolEnd = jest.fn(() => Promise.resolve());
const mockRedisQuit = jest.fn(() => Promise.resolve());
const mockCloseAllConnections = jest.fn();

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { end: mockPoolEnd } }));
jest.mock('../../src/config/redis', () => ({ quit: mockRedisQuit }));
jest.mock('../../src/services/chatSocketServer', () => ({
  initChatSocketServer: jest.fn(),
  closeAllConnections: () => mockCloseAllConnections()
}));

const app = require('../../src/server');

// Build a set of mock runtime handles that record call order into `order`.
function buildHandles(order, overrides = {}) {
  const server = {
    close: jest.fn((cb) => { order.push('server.close'); cb(); }),
    removeAllListeners: jest.fn(() => { order.push('server.removeAllListeners'); })
  };
  const wss = {
    close: jest.fn((cb) => { order.push('wss.close'); cb(); })
  };
  const emailWorker = { stop: jest.fn(() => { order.push('email.stop'); return Promise.resolve(); }) };
  const reminderWorker = { stop: jest.fn(() => { order.push('reminder.stop'); return Promise.resolve(); }) };
  return { server, wss, emailWorker, reminderWorker, ...overrides };
}

describe('graceful shutdown (U1)', () => {
  beforeEach(() => {
    mockPoolEnd.mockClear();
    mockRedisQuit.mockClear();
    mockCloseAllConnections.mockClear();
    // Reset the module-scoped shuttingDown guard between tests.
    app._setShutdownHandles({ shuttingDown: false });
  });

  test('happy path: drains then closes in the KTD7 order, each exactly once', async () => {
    const order = [];
    // Wrap the mocked db/redis/chat so they record into the shared order array.
    mockPoolEnd.mockImplementation(() => { order.push('pool.end'); return Promise.resolve(); });
    mockRedisQuit.mockImplementation(() => { order.push('redis.quit'); return Promise.resolve(); });
    mockCloseAllConnections.mockImplementation(() => { order.push('closeAllConnections'); });

    const handles = buildHandles(order);
    app._setShutdownHandles(handles);

    await app.shutdown('SIGTERM');

    expect(handles.server.close).toHaveBeenCalledTimes(1);
    expect(handles.server.removeAllListeners).toHaveBeenCalledWith('upgrade');
    expect(handles.wss.close).toHaveBeenCalledTimes(1);
    expect(mockPoolEnd).toHaveBeenCalledTimes(1);
    expect(mockRedisQuit).toHaveBeenCalledTimes(1);
    expect(handles.emailWorker.stop).toHaveBeenCalledTimes(1);
    expect(handles.reminderWorker.stop).toHaveBeenCalledTimes(1);

    expect(order).toEqual([
      'server.close',
      'server.removeAllListeners',
      'wss.close',
      'closeAllConnections',
      'pool.end',
      'redis.quit',
      'email.stop',
      'reminder.stop'
    ]);
  });

  test('an in-flight request drains (server.close resolves) before pool.end', async () => {
    const order = [];
    mockPoolEnd.mockImplementation(() => { order.push('pool.end'); return Promise.resolve(); });
    const handles = buildHandles(order);
    app._setShutdownHandles(handles);

    await app.shutdown('SIGTERM');

    expect(order.indexOf('server.close')).toBeLessThan(order.indexOf('pool.end'));
  });

  test('edge: a duplicate signal while shutting down does not re-run the sequence', async () => {
    const order = [];
    const handles = buildHandles(order);
    app._setShutdownHandles(handles);

    await app.shutdown('SIGTERM');
    const firstCount = handles.server.close.mock.calls.length;
    await app.shutdown('SIGTERM'); // guard latched → no-op

    expect(handles.server.close.mock.calls.length).toBe(firstCount);
  });

  test('edge: undefined worker/server handles are skipped without throwing (test mode)', async () => {
    app._setShutdownHandles({
      server: undefined,
      wss: undefined,
      emailWorker: undefined,
      reminderWorker: undefined
    });
    await expect(app.shutdown('SIGTERM')).resolves.toBeUndefined();
    // pool + redis still torn down even with no server/workers.
    expect(mockPoolEnd).toHaveBeenCalledTimes(1);
    expect(mockRedisQuit).toHaveBeenCalledTimes(1);
  });

  test('failure: a rejecting close propagates (caller can force-exit) without an unhandled rejection', async () => {
    const order = [];
    const handles = buildHandles(order, {
      emailWorker: { stop: jest.fn(() => Promise.reject(new Error('stop failed'))) }
    });
    app._setShutdownHandles(handles);

    await expect(app.shutdown('SIGTERM')).rejects.toThrow('stop failed');
  });

  test('failure: a hung close still terminates via the force-exit timeout fallback', () => {
    jest.useFakeTimers();
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    // server.close never invokes its callback → shutdown awaits forever.
    const handles = buildHandles([], {
      server: { close: jest.fn(() => {}), removeAllListeners: jest.fn() }
    });
    app._setShutdownHandles(handles);

    app.shutdown('SIGTERM'); // returns a promise that never resolves
    // Advancing past the timeout fires the non-unref force-exit.
    jest.advanceTimersByTime(11000);

    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    jest.useRealTimers();
  });
});
