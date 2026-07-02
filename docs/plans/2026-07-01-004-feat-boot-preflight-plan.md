---
title: "Fail-Closed Boot Preflight - Plan"
type: feat
date: 2026-07-01
topic: fail-closed-boot-preflight
execution: code
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# Fail-Closed Boot Preflight - Plan

## Goal Capsule
- Objective: add a production-only startup preflight that refuses to boot on any launch-fatal security misconfiguration and warns on content misconfigurations.
- Product authority: owner decision, 2026-07-01 — two-tier preflight (security = fatal, content = warn).
- Open blockers: whether `src/config/db.js` must be made TLS-configurable is a resolve-before-planning question (see Outstanding Questions); the Postgres TLS check is otherwise unsatisfiable.

## Product Contract

### Summary
Boot becomes a Minimum-Equipment-List gate: in production, the process asserts each enumerated config check before accepting connections, exits with a named reason on any security failure, and logs a prominent warning on any content failure. Dev and test boots are untouched.

---

### Problem Frame
Several launch-fatal misconfigurations currently surface only at runtime, and quietly. A placeholder `JWT_SECRET` or a localhost `APP_URL` produces broken tokens and broken email links long after boot; `src/config/db.js` disables Postgres certificate verification in production; a non-numeric `FACEBOOK_PAGE_ID` renders blank video cards with nothing in the logs. None of these are caught by the 1183-test suite, so a red config reaches production undetected.

---

### Key Decisions
- **Two severity tiers.** A security misconfiguration must never reach production, so it is fatal and refuses the boot. A content typo should not take the whole site down, so it warns and boot proceeds. The tiers are fixed by owner decision, not left to the planner.
- **Production-only, fail-closed.** The preflight runs only when `NODE_ENV === 'production'` and defaults to refusing the boot on fatal failure. It must not fire in dev or test, where it would block legitimate boots and fight the load-bearing `NODE_ENV` branches.

---

### Requirements

**Preflight behavior**
- R1. In production the preflight runs during boot, before the HTTP listener starts accepting connections.
- R2. The preflight does not run when `NODE_ENV` is `test` or `development` (or unset); it must respect the existing `NODE_ENV` branches and never block a dev or test boot.
- R3. The preflight evaluates every check and aggregates results; it reports all failures rather than stopping at the first.
- R4. Any security-tier (fatal) failure refuses the boot: the process exits non-zero and the HTTP listener never starts.
- R5. Every failure message names the specific failed check and states what is wrong, so an operator can act without reading source.
- R6. Content-tier failures do not block boot; each logs a prominent startup warning naming the failed check.
- R7. All preflight output goes through `src/utils/logger.js` (winston); no `console.log` and no new logging dependency.

**Security tier — fatal**
- R8. `JWT_SECRET` must be non-empty and must not be a known placeholder value.
- R9. `ENCRYPTION_KEY` must be non-empty and must not be a known placeholder value.
- R10. `APP_URL` must be set and must not point at localhost.
- R11. The effective Postgres TLS configuration must verify the server certificate: `rejectUnauthorized` is true in production, or a CA certificate is supplied.

**Content tier — warn**
- R12. If `FACEBOOK_PAGE_ID` is set, it must be numeric; a non-numeric value warns.
- R13. `TEMPLE_EIN` must be present; its absence warns.

### Acceptance Examples
- AE1. Covers R4, R8 — When `NODE_ENV=production` and `JWT_SECRET` is the committed placeholder, boot is refused with a message naming `JWT_SECRET`.
- AE2. Covers R4, R10 — When `NODE_ENV=production` and `APP_URL` is `http://localhost:3000`, boot is refused with a message naming `APP_URL`.
- AE3. Covers R4, R11 — When `NODE_ENV=production` and the Postgres SSL config has `rejectUnauthorized:false` with no CA certificate, boot is refused with a message naming the Postgres TLS check.
- AE4. Covers R6, R12 — When `NODE_ENV=production` and `FACEBOOK_PAGE_ID` is non-numeric, boot proceeds and a startup warning names `FACEBOOK_PAGE_ID`.
- AE5. Covers R1 — When `NODE_ENV=production` and every check passes, boot proceeds normally with no fatal exit and no warnings.
- AE6. Covers R2 — When `NODE_ENV=test`, the preflight does not run and boot proceeds regardless of any red config.
- AE7. Covers R3, R5 — When `NODE_ENV=production` and both `JWT_SECRET` is a placeholder and `APP_URL` is localhost, the refusal message names both checks.

### Success Criteria
- The existing 1183-test suite still passes, and no test triggers the preflight (it stays inert under `NODE_ENV=test`).
- Each fatal failure message is actionable on its own: it identifies the check and the reason, not merely that "config is invalid."

### Scope Boundaries
- Not a general config-validation framework; only the enumerated MEL checks (R8–R13) are in scope.
- No admin dashboard or health-panel surfacing of content warnings in this scope (the owner marked that "may," not required).
- No new secrets manager, key rotation, or `.env` loader changes.
- No change to how these env vars are consumed at runtime, except the Postgres TLS knob if the resolve-before-planning question decides it in.

### Dependencies / Assumptions
- The winston logger at `src/utils/logger.js` is the only logging surface.
- The boot entrypoint is `src/server.js`; the preflight hooks the production boot path guarded by `require.main === module` before `app.listen`.
- "Placeholder" requires a concrete definition — at minimum the committed `.env` value (`your_jwt_secret_key` style) and empty; `ENCRYPTION_KEY` already has a length rule in `src/utils/encryptionHelper.js` that the check should not contradict.

### Outstanding Questions

**Resolve Before Planning**
- The Postgres TLS check (R11) can only pass if the system exposes a signal that verification is enabled, but `src/config/db.js:16` currently hardcodes `rejectUnauthorized:false` in production. Must this work also change `db.js` to default `rejectUnauthorized:true` (or accept a CA cert / env override) so the check is satisfiable, rather than making every production boot refuse? (This is the flagged planning question.)
- What is the exact placeholder set and any minimum-strength rule for `JWT_SECRET` / `ENCRYPTION_KEY` (R8, R9), given `encryptionHelper` already enforces a ≥32-char `ENCRYPTION_KEY`?

**Deferred to Planning**
- Whether and how to also surface content-tier warnings on the admin dashboard / health panel.
- Where the preflight module lives and how it is invoked relative to the existing production boot guard in `src/server.js`.
- Whether `APP_URL` "non-localhost" (R10) should also reject `127.0.0.1`, `0.0.0.0`, and empty hosts, and whether an http (non-https) production URL should warn.

### Sources / Research
- `src/config/db.js:16` — production SSL hardcodes `rejectUnauthorized:false`, disabling hostname verification (drives R11 and the resolve-before-planning question).
- `src/server.js:480-481` — production boot guard (`NODE_ENV !== 'test' && require.main === module`) then `app.listen`; the preflight hook point.
- `src/server.js:167` — `JWT_SECRET` resolution with the `test-jwt-secret` fallback pattern to respect.
- `src/utils/encryptionHelper.js:8,17,20` — `ENCRYPTION_KEY` presence and length rules.
- `src/services/userService.js:217`, `src/services/authService.js:34`, `src/services/AnnouncementService.js:66`, `src/services/emailTemplateService.js:141` — `APP_URL` silently falls back to `http://localhost:3000`.
- `src/services/pastVideos/GraphApiSource.js:23,37` — existing non-numeric `FACEBOOK_PAGE_ID` handling, at fetch time rather than boot.
- `src/services/receiptPdfService.js:11` — `TEMPLE_EIN` falls back to a placeholder string.
- `src/utils/logger.js` — the winston logger the preflight must use.
