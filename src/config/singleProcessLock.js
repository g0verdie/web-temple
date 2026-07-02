/**
 * singleProcessLock.js — enforce the single-process invariant at boot
 * (docs/plans/2026-07-02-002-feat-single-process-invariant-plan.md, idea I12).
 *
 * DECLARED INVARIANT: web-temple runs as exactly ONE web+worker process. The
 * per-IP rate limiters (express-rate-limit MemoryStore), the WS 50-connection
 * cap, and the hourly reminder scan are all per-process by construction — a
 * second concurrent process silently multiplies limits and doubles worker load.
 * This is a deliberate scaling ceiling, not a bug: single-process is enforced,
 * not worked around.
 *
 * On production boot, before the HTTP listener binds and before any background
 * worker starts, we acquire a session-level Postgres advisory lock on a fixed
 * key using a dedicated client checked out from the shared pool and held for the
 * process lifetime. If a peer already holds it, we log a fatal winston line and
 * exit non-zero — fail-closed, mirroring config/preflight.js runPreflight().
 *
 * Inert unless NODE_ENV === 'production': dev and test boots check out no
 * client, run no query, log nothing, and never exit — respecting the
 * load-bearing NODE_ENV branches elsewhere in the app (the jest suite mocks
 * config/db and runs multiple workers, so any real lock attempt would break it).
 */

const { pool } = require('./db');
const logger = require('../utils/logger');

// Fixed session-level advisory-lock key. Must be a constant so redeploys of the
// same app contend on the same lock. 0x57545350 spells the ASCII bytes
// "WTSP" (Web-Temple Single-Process) and fits comfortably in a signed bigint.
// web-temple holds no other advisory locks, so collision risk is nil.
const SINGLE_PROCESS_LOCK_KEY = 0x57545350;

// The dedicated pooled client whose Postgres session holds the advisory lock for
// this process's lifetime. Null until acquired / after release.
let lockClient = null;

/**
 * Production boot gate. Inert unless NODE_ENV === 'production'.
 *
 * Acquires the session-level advisory lock on SINGLE_PROCESS_LOCK_KEY via a
 * dedicated pooled client held for the process lifetime. On success logs one
 * info line and returns. On contention (a peer holds the lock) or on any error
 * reaching Postgres, logs a fatal line naming the invariant and exits non-zero
 * (fail-closed), so the caller never starts workers or binds the port.
 *
 * @returns {Promise<void>}
 */
async function acquireSingleProcessLock() {
    if (process.env.NODE_ENV !== 'production') {
        return;
    }

    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [SINGLE_PROCESS_LOCK_KEY]);
        const acquired = result && result.rows && result.rows[0] && result.rows[0].locked === true;

        if (!acquired) {
            client.release();
            logger.error(
                'Single-process invariant violated: another web-temple process already holds the boot advisory lock. ' +
                    'web-temple runs as exactly one web+worker process — refusing to start this process.'
            );
            process.exit(1);
            return;
        }

        lockClient = client;
        logger.info('Single-process lock acquired: this process holds the web-temple single-process invariant.');
    } catch (err) {
        if (client && typeof client.release === 'function') {
            client.release();
        }
        logger.error(
            'Single-process invariant guard could not acquire the boot advisory lock (Postgres unreachable at boot?). ' +
                'Refusing to start — fix the database connection and redeploy.',
            { error: err && err.message, stack: err && err.stack }
        );
        process.exit(1);
    }
}

/**
 * Release the advisory lock so the next deploy can acquire it (R8). Safe no-op
 * when no lock is held (test/dev, or already released). The dedicated client's
 * session is also closed by the graceful-shutdown pool.end() as a backstop —
 * session advisory locks auto-release on session close.
 *
 * @returns {Promise<void>}
 */
async function releaseSingleProcessLock() {
    if (!lockClient) {
        return;
    }
    const client = lockClient;
    lockClient = null;
    try {
        await client.query('SELECT pg_advisory_unlock($1)', [SINGLE_PROCESS_LOCK_KEY]);
    } catch (err) {
        // Best-effort: pool.end() closes the session as a backstop.
        logger.warn('Single-process lock release failed; pool.end() will close the session as a backstop.', {
            error: err && err.message,
        });
    } finally {
        client.release();
    }
}

module.exports = { SINGLE_PROCESS_LOCK_KEY, acquireSingleProcessLock, releaseSingleProcessLock };
