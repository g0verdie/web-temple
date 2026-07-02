/**
 * Single-process boot advisory lock
 * (docs/plans/2026-07-02-002-feat-single-process-invariant-plan.md).
 *
 * A production-only boot gate that acquires a session-level Postgres advisory
 * lock so exactly one web+worker process runs. Fail-closed: a second process
 * that cannot acquire the lock logs a fatal winston line and exits non-zero.
 * Fully inert under NODE_ENV=test/development — no client checkout, no query,
 * no log, no exit — so the jest suite (multiple workers, mocked db) is safe.
 */

const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest.fn();

jest.mock('../../src/config/db', () => ({
    query: jest.fn(),
    pool: {
        connect: (...args) => mockConnect(...args),
        end: jest.fn(),
    },
}));

jest.mock('../../src/utils/logger', () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
}));

const logger = require('../../src/utils/logger');

const ORIGINAL_ENV = process.env;
let exitSpy;

// Load a fresh module instance so the module-scoped lockClient does not leak
// between tests.
function loadLock() {
    let mod;
    jest.isolateModules(() => {
        mod = require('../../src/config/singleProcessLock');
    });
    return mod;
}

const errorMessages = () => logger.error.mock.calls.map((c) => c[0]).join(' | ');
const infoMessages = () => logger.info.mock.calls.map((c) => c[0]).join(' | ');

describe('singleProcessLock', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...ORIGINAL_ENV };
        mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
        exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env = ORIGINAL_ENV;
        exitSpy.mockRestore();
    });

    test('AE1 (R1, R3): production + no peer holds → acquires, logs info, retains client, no exit', async () => {
        process.env.NODE_ENV = 'production';
        mockClientQuery.mockResolvedValueOnce({ rows: [{ locked: true }] });

        const lock = loadLock();
        await lock.acquireSingleProcessLock();

        expect(mockConnect).toHaveBeenCalledTimes(1);
        expect(mockClientQuery).toHaveBeenCalledWith(
            expect.stringMatching(/pg_try_advisory_lock/),
            [lock.SINGLE_PROCESS_LOCK_KEY]
        );
        expect(infoMessages()).toMatch(/single-process/i);
        expect(exitSpy).not.toHaveBeenCalled();
        // The lock-holding client is held for the process lifetime (not released).
        expect(mockClientRelease).not.toHaveBeenCalled();
    });

    test('AE2 (R2): production + peer already holds → fatal line naming the invariant, exit(1), no info', async () => {
        process.env.NODE_ENV = 'production';
        mockClientQuery.mockResolvedValueOnce({ rows: [{ locked: false }] });

        const lock = loadLock();
        await lock.acquireSingleProcessLock();

        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(errorMessages()).toMatch(/single-process|invariant/i);
        expect(logger.info).not.toHaveBeenCalled();
        // The non-lock-holding client is returned to the pool.
        expect(mockClientRelease).toHaveBeenCalledTimes(1);
    });

    test('R2 (fail-closed): production + Postgres unreachable at boot → fatal + exit(1)', async () => {
        process.env.NODE_ENV = 'production';
        mockConnect.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const lock = loadLock();
        await lock.acquireSingleProcessLock();

        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(errorMessages()).toMatch(/single-process|invariant|advisory lock/i);
    });

    test('AE3 (R6): under NODE_ENV=test the lock path is fully inert', async () => {
        process.env.NODE_ENV = 'test';

        const lock = loadLock();
        await lock.acquireSingleProcessLock();

        expect(mockConnect).not.toHaveBeenCalled();
        expect(mockClientQuery).not.toHaveBeenCalled();
        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
        expect(exitSpy).not.toHaveBeenCalled();
    });

    test('AE4 (R7): under NODE_ENV=development the guard attempts no lock and never exits', async () => {
        process.env.NODE_ENV = 'development';

        const lock = loadLock();
        await lock.acquireSingleProcessLock();

        expect(mockConnect).not.toHaveBeenCalled();
        expect(exitSpy).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });

    test('AE5 (R8): after acquiring, release unlocks the advisory lock and returns the client', async () => {
        process.env.NODE_ENV = 'production';
        mockClientQuery.mockResolvedValueOnce({ rows: [{ locked: true }] }); // acquire
        mockClientQuery.mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] }); // release

        const lock = loadLock();
        await lock.acquireSingleProcessLock();
        await lock.releaseSingleProcessLock();

        expect(mockClientQuery).toHaveBeenLastCalledWith(
            expect.stringMatching(/pg_advisory_unlock/),
            [lock.SINGLE_PROCESS_LOCK_KEY]
        );
        expect(mockClientRelease).toHaveBeenCalledTimes(1);
    });

    test('R6/R8: release is a safe no-op when no lock is held (test mode)', async () => {
        process.env.NODE_ENV = 'test';

        const lock = loadLock();
        await expect(lock.releaseSingleProcessLock()).resolves.toBeUndefined();

        expect(mockClientQuery).not.toHaveBeenCalled();
        expect(mockClientRelease).not.toHaveBeenCalled();
    });
});
