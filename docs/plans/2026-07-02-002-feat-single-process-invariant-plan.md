---
title: Enforce single-process via a boot advisory lock - Plan
type: feat
date: 2026-07-02
topic: single-process-advisory-lock
execution: code
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# Enforce single-process via a boot advisory lock - Plan

## Goal Capsule

Objective: turn web-temple's silent single-process assumption into an enforced, declared invariant — a boot-time Postgres advisory lock that refuses to start a second web+worker process in production, plus one committed line declaring the invariant.

Product authority: idea I12 in `docs/ideation/2026-07-01-full-project-review-ideation.html` — "Make single-process an enforced, declared invariant (boot advisory lock)."

Open blockers: none. Two questions (below) should be answered before planning but do not block scoping.

## Product Contract

### Summary

The code assumes one process everywhere but nothing enforces it, so a routine second deploy silently multiplies the per-IP rate limits and doubles worker load. Acquire a session-level `pg_try_advisory_lock` on a fixed key at boot; if a peer already holds it, log a fatal winston line and exit non-zero. Gate worker and listener startup on holding the lock, keep it inert under `NODE_ENV==='test'`, and commit one line declaring the invariant.

### Problem Frame

Verification against the current code confirms the multi-process failure surface, with one correction to the review's framing:

Rate limiters are the clean, undefended failure. Seven route files construct eight `express-rate-limit` limiters with no `store:` option, so every one uses the default in-process `MemoryStore` — counters are per-process and reset on restart. Under N processes the effective limit is N times the configured `max` (e.g. auth's 20/15min becomes 20N). There is no cross-process backstop.

The reminder worker is only partly at risk. `src/server.js` starts the email and reminder workers unconditionally at module load (gated only on `NODE_ENV!=='test'` and an `*_ENABLED` flag), and the reminder worker registers an hourly Bull repeatable job, so N processes do schedule N scans. But double-fire is already defended: `runReminderScan` claims each event with an atomic `UPDATE ... WHERE reminder_sent_at IS NULL` before fan-out, and Bull's Redis job-locking means one consumer runs a given job. So the lock's hard win here is eliminating redundant scan load and racing, not preventing a known double-email bug.

The WS cap is per-process by construction: `MAX_CONCURRENT_CONNECTIONS = 50` is a module constant, so total capacity is N times 50 rather than the declared 50.

For a single self-hosted box, single-process is a legitimate choice. The point is to make it loud and guarded instead of silent.

### Key Decisions

This is the deliberate opposite lane to externalizing coordination state to Redis/Postgres (cut as C20). We are declaring and enforcing single-process, not making the app multi-process-safe.

The advisory lock is a Postgres session-level lock held for the process lifetime on a dedicated pooled client — no schema, no migration, no new table. It mirrors the existing fail-closed, production-only boot gate `runPreflight` (`src/config/preflight.js`).

### Requirements

**Boot advisory lock**

R1. On production boot, before the HTTP listener binds and before any background worker starts, acquire a session-level Postgres advisory lock on a fixed constant key using a dedicated client checked out from the existing pool (`src/config/db.js` exports `pool`) and held for the process lifetime.

R2. If the lock is not acquired because a peer process already holds it, log a fatal message via the winston logger (`src/utils/logger.js`) that names the single-process invariant, and exit non-zero so the second process refuses to start — fail-closed, mirroring `runPreflight`.

R3. If the lock is acquired, log one info line confirming this process holds the single-process lock, then continue normal startup.

**Boot sequencing (src/server.js)**

R4. The email and reminder workers must not start until the lock is held. A lock-less or lock-losing process must never register the hourly reminder repeatable job or the email consumer. This requires moving the current module-load worker-start blocks so they run only after acquisition succeeds.

R5. Lock acquisition, worker startup, and listener bind must be sequenced together in the production boot path (the `require.main === module` block) so exactly one process runs web plus workers.

**Inertness under test and dev**

R6. Under `NODE_ENV==='test'` the lock path is fully inert: it checks out no client, runs no query, logs nothing, and never exits the process. Integration tests mock `src/config/db` and run multiple jest workers, so any real lock attempt would break the suite.

R7. The guard is active only when `NODE_ENV==='production'` (matching `runPreflight` and I12's stated scope). Development boots are never blocked and attempt no lock.

**Shutdown**

R8. Graceful shutdown must release the lock so the next deploy can acquire it — release the dedicated client and/or rely on the existing `pool.end()` closing the session as the backstop (session advisory locks auto-release on session close).

**Declared invariant**

R9. Commit one line declaring the single-process invariant to a git-tracked location — `AGENTS.md` is gitignored, so use a committed doc and/or the lock module's header comment — stating that web-temple runs as exactly one web+worker process, enforced by the boot advisory lock.

### Acceptance Examples

AE1. Given `NODE_ENV=production` and no peer holds the lock, when the process boots, then the advisory lock is acquired, one info line is logged, and the listener and workers start. Covers R1, R3, R4, R5.

AE2. Given `NODE_ENV=production` and a first process already holds the lock, when a second process boots, then acquisition returns false, a fatal winston line naming the invariant is logged, and the process exits non-zero without binding the port or registering the reminder/email workers. Covers R2, R4, R5.

AE3. Given `NODE_ENV=test`, when the app module loads under jest, then no advisory-lock query runs, nothing is logged by the guard, and the process never exits. Covers R6.

AE4. Given `NODE_ENV=development`, when the dev server boots, then the guard attempts no lock and startup proceeds normally. Covers R7.

AE5. Given the lock-holding process receives SIGTERM, when graceful shutdown runs, then the lock is released (or its session closed via `pool.end()`) so a subsequent boot can acquire it. Covers R8.

### Scope Boundaries

Out of scope:
- Externalizing rate-limit counters or WS state to Redis/Postgres (the opposite lane; C20 was cut).
- Any change to the eight rate limiters, the WS 50-connection cap, or the reminder claim/scan logic.
- Horizontal scaling or multi-process support — the lock is a deliberate scaling ceiling.
- Any schema, migration, or new table (advisory locks need none).
- Leader election, health-based failover, or a distributed coordinator.

### Dependencies / Assumptions

- This edits the `src/server.js` boot path, the same file I14 (AppError + error middleware) edits. Schedule I12 and I14 in one shared worktree/stream to avoid conflicting edits to `src/server.js`.
- Assumes Postgres is reachable at production boot (the pool is already required by `src/server.js`). If the DB is unreachable, acquisition cannot succeed — treatment is an Outstanding Question below.
- Uses `pg` session-level `pg_try_advisory_lock` via a dedicated `pool.connect()` client; no bull/redis involvement.
- The rate limiters have no cross-process backstop, so they are the concrete hard win; the reminder double-fire is already defended by the atomic claim (`EventService.markReminderSent`) plus Bull job-locking, so I12's reminder value is redundancy/racing removal, not a bug fix.
- The lock key must be a fixed constant so redeploys of the same app contend on the same key; it must be documented.

### Outstanding Questions

Resolve Before Planning:
- If Postgres is unreachable at boot, is that a fail-closed exit (recommended, consistent with the fail-closed posture) or a warn-and-proceed lock-less boot?
- Where does the committed one-line invariant live, given `AGENTS.md` is gitignored — a tracked doc, the lock module header, or both?

Deferred to Planning:
- The exact 64-bit lock key constant / namespace.
- Rolling-deploy overlap: a new process may boot before the old one exits and lose the lock — immediate exit, or a short bounded retry-with-timeout before giving up?
- Whether to hang the async acquisition off the existing (synchronous) `runPreflight` call site or add a separate async boot gate.
- Whether to also guard dev boots (default: production-only).

### Sources / Research

- `docs/ideation/2026-07-01-full-project-review-ideation.html:446-454` — idea I12 (product authority); `:500` — C20 (externalize-state) cut, "covered more honestly by I12."
- `src/routes/auth.js:8`, `src/routes/directory.js:13`, `src/routes/contact.js:10`, `src/routes/donations.js:9`, `src/routes/api.js:42`, `src/routes/api.js:55`, `src/routes/admin/directory.js:26`, `src/routes/admin/donations.js:22` — the 8 `express-rate-limit` limiters across 7 files; no `store:` configured anywhere in `src/`, so all use the default per-process `MemoryStore`.
- `src/server.js:53-59` — email + reminder workers started unconditionally at module load (gated only on `NODE_ENV!=='test'` and `*_ENABLED`).
- `src/workers/reminderWorker.js:15` hourly `REPEAT_EVERY_MS`; `:143-145` registers the repeatable job; `:68-77` atomic claim-then-send; `:73` `markReminderSent`.
- `src/services/EventService.js:272-278` — `markReminderSent` = `UPDATE events SET reminder_sent_at = NOW() WHERE id=$1 AND reminder_sent_at IS NULL RETURNING id` (atomic double-fire guard).
- `src/services/chatSocketServer.js:15` `MAX_CONCURRENT_CONNECTIONS = 50` (per-process constant); `:238` cap check.
- `src/config/preflight.js:134-157` `runPreflight()` — production-only, fail-closed `process.exit(1)`, winston logging (the pattern to mirror); `src/server.js:537` its call site inside the `require.main === module` guard.
- `src/config/db.js:14` `pool = new Pool(...)`; `:32-35` exports `{ query, pool }` — `pool.connect()` available for a dedicated lock-holding session.
- `src/server.js:463-464` shutdown `await pool.end()` — closes pool sessions and thus auto-releases the advisory lock.
