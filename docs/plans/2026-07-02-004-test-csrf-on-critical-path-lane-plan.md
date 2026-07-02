---
title: "Production-Parity CSRF-On Critical-Path Test Lane - Plan"
type: test
date: 2026-07-02
topic: csrf-on-critical-path-test-lane
execution: code
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# Production-Parity CSRF-On Critical-Path Test Lane - Plan

## Goal Capsule

Objective: Close a permanent, known blind spot — client-side `_csrf` token-wiring regressions that are invisible to the entire Jest suite — by adding a thin, dedicated test lane that boots with CSRF actually enforced and drives the real mint-token-then-submit flow for the highest-value forms, while leaving the load-bearing `NODE_ENV==='test'` bypass untouched.

Product authority: Idea I11 ("A production-parity 'CSRF-on' critical-path test lane") in `docs/ideation/2026-07-01-full-project-review-ideation.html:436`.

Open blockers: One — the mechanism for enabling CSRF in just this lane without weakening the global hatch is unresolved (see Outstanding Questions Q1). It gates the lane's whole design and must be settled before planning.

## Product Contract

### Summary

Keep the global CSRF bypass exactly as-is; add a separate, opt-in Jest lane that runs CSRF-enforced. In that lane, fetch a server-minted token the same way the client reads it, submit the state-changing request the same way the client transports it, and assert the request succeeds — plus assert a token-less request is rejected, proving enforcement is real. Scope to contact, donation checkout, and admin writes.

### Problem Frame

`src/server.js:142` short-circuits CSRF whenever `NODE_ENV==='test'` (`if (process.env.NODE_ENV === 'test') return next();`), mounted globally at `src/server.js:152`. This hatch is load-bearing and must stay: the ~1,250-test suite relies on it (together with the db mock and disabled workers) to POST to state-changing endpoints without minting tokens. The side effect is that no test ever exercises the real CSRF path, so a whole bug class ships undetected — the contact-form 403, the admin Retry button, and the page-editor Save/Publish 403 all escaped the suite for exactly this reason.

The wiring is heterogeneous, which is why regressions recur. Two token transports coexist: a hidden body field `input[name="_csrf"]` (donation views, `src/views/donations/index.ejs:6`, `src/views/donations/checkout.ejs:14`) which `csurf` reads from `req.body._csrf`; and a `meta[name="csrf-token"]` tag (`src/views/layout.ejs:48`) that client JS reads and resends as a `CSRF-Token` header (`public/js/contact-form.js:40`, `public/js/page-editor.js:53`, `public/js/adminTour.js:83`), which `csurf` reads from `req.headers['csrf-token']` (`node_modules/csurf/index.js:133`). A regression in either half — view stops emitting the token, or endpoint stops accepting that transport — is silent today.

### Key Decisions

The lane verifies the server-side token contract and its transport, not client-side JavaScript execution. It GETs the page, extracts the token from the exact element the production client reads, then submits via the exact transport the production client uses. That catches the view/transport half where all three shipped regressions actually lived. Reproducing full client-JS behavior (a selector typo in a `.js` file) is E2E/browser territory and is out of scope here.

### Requirements

**Lane guarantees**

R1. The global CSRF bypass at `src/server.js:142` and its behavior when the new lane is not active must remain byte-for-byte identical to today; the default `npm test` run, coverage thresholds (`jest.config.js:13`), and every other `NODE_ENV==='test'` hatch (db mock, disabled workers, JWT test-secret, no real Redis) are unchanged.

R2. Add a dedicated CSRF-enforced Jest lane, separate from the default suite (its own config/project or a distinctly-tagged, separately-invoked suite), that leaves every non-CSRF test hatch intact so tests still mock `src/config/db` and start no workers.

R3. For each covered form the lane must drive the real mint-then-submit flow: first obtain a server-minted token, then submit the state-changing request carrying that token, and assert the response is a success (2xx/3xx), not 403.

R4. For each covered form the lane must also assert the negative: the same state-changing request with a missing or wrong token is rejected with 403 — proving CSRF is genuinely enforced in the lane rather than silently bypassed.

R5. The lane must extract the token from the same element the production client reads and resend it via the same transport the client uses, covering both conventions: the hidden `input[name="_csrf"]` body field and the `meta[name="csrf-token"]` → `CSRF-Token` header.

**Coverage (highest-value forms only)**

R6. Cover contact submit — POST `/contact` (`src/routes/contact.js:33`) via the meta-tag → `CSRF-Token` header transport.

R7. Cover donation checkout — POST `/donations/checkout` (`src/routes/donations.js:21`) via the hidden `input[name="_csrf"]` body-field transport, keeping the existing mock payment provider.

R8. Cover at least the admin writes with known regressions — page-editor Save (POST `/admin/pages/:slug`, `src/routes/admin/pages.js:75`) and Publish (POST `/admin/pages/:slug/publish`, `src/routes/admin/pages.js:106`) via the header transport, plus the admin Retry action (`public/js/adminTour.js:83`).

**Constraints**

R9. Add no new production (runtime) dependency; reuse `supertest` (already a devDependency, used across `__tests__/integration/`) and the exported app singleton (`src/server.js:560`).

R10. Follow existing Jest integration patterns — mock `src/config/db`, mock external services, and mint auth via `JWT_SECRET='test-jwt-secret'` — as in `__tests__/integration/donationRoutes.test.js`.

R11. Preserve the `/unsubscribe` CSRF exemption (`src/server.js:148`); the lane must not require a token on that endpoint.

### Acceptance Examples

AE1. GET the donations page, read the value of `input[name="_csrf"]`, POST `/donations/checkout` with that value in the body → response is not 403 (checkout starts). Covers-R3, R5, R7.

AE2. GET a page that renders the layout, read `meta[name="csrf-token"]`, POST `/contact` with that value in a `CSRF-Token` header → response is not 403. Covers-R3, R5, R6.

AE3. POST `/admin/pages/:slug` as an authorized admin with no `CSRF-Token` header → 403. Covers-R4, R8.

AE4. POST `/donations/checkout` with an omitted or garbage `_csrf` body field → 403. Covers-R4, R7.

### Success Criteria

Reintroducing any of the three historical regressions makes the lane fail: removing the hidden `_csrf` field from a donation view, removing the `csrf-token` meta tag from `src/views/layout.ejs`, or changing an admin write so it no longer accepts the `CSRF-Token` header each turns a lane test red — while the default `npm test` run stays green and unchanged.

### Scope Boundaries

Out: executing client-side JavaScript / a real browser (a `.js` selector typo that the server-side token contract can't observe belongs to a separate E2E lane). Out: any change to the semantics of the global `NODE_ENV==='test'` bypass. Out: forms beyond contact, donation checkout, and the named admin writes (no exhaustive coverage of every POST). Out: real PayPal — the mock provider stays. Out: new production dependencies or a second full boot of real Postgres/Redis/workers.

### Dependencies / Assumptions

- `supertest`, `jest`, and `jsonwebtoken` are already available; no install needed.
- The app is a module-singleton (`src/server.js:560`). `conditionalCsrf` reads `NODE_ENV` per request (`src/server.js:142`), but `JWT_SECRET` (`src/server.js:163`), worker startup (`src/server.js:53`, `:57`), and the tests' db mock are all decided at module-eval time keyed on `NODE_ENV==='test'`. Therefore simply setting `NODE_ENV` to a non-test value to turn CSRF on is not viable — it would drop the JWT test-secret fallback, start workers, and un-mock the db. The enabling mechanism must flip only the CSRF short-circuit while keeping every other test hatch on.
- `csurf` accepts the token from `req.body._csrf` (default) or `req.headers['csrf-token']` (`node_modules/csurf/index.js:133`); both must work in the lane.

### Outstanding Questions

Resolve Before Planning:
- Q1. How to enable CSRF for just this lane without weakening the global hatch. Candidates: (a) a narrow env flag gating only the short-circuit, e.g. `if (process.env.NODE_ENV === 'test' && !process.env.CSRF_TEST_LANE) return next();` — keeps all other hatches on, but edits the exact bypass line, so default behavior must be proven identical when the flag is unset; (b) a per-test app instance in the lane that mounts `csrfProtection` directly and never hits the global singleton, leaving `src/server.js` completely untouched; (c) a separate Jest project/config whose setup sets the flag from (a). A full `NODE_ENV` swap is explicitly rejected (see Dependencies). Pick before planning — it determines the lane's shape.
- Q2. Where the lane lives and runs: a separate `jest.config.csrf.js` project vs a `testPathPattern` tag, and whether CI runs it as a distinct step or folds it into an extended `npm test`.

Deferred to Planning:
- Exact admin-write set beyond page Save/Publish and Retry.
- Whether to factor a shared "extract-token-then-submit" helper covering both transports, or inline it per test.

### Sources / Research

- `docs/ideation/2026-07-01-full-project-review-ideation.html:436` — idea I11 (product authority).
- `src/server.js:141` — `conditionalCsrf` definition; `:142` — the load-bearing `NODE_ENV==='test'` bypass; `:148` — `/unsubscribe` exemption; `:152` — global mount; `:163` — eval-time `JWT_SECRET` test fallback; `:53`,`:57` — eval-time worker startup; `:560` — `module.exports = app` singleton.
- `jest.config.js:9` — `testMatch`; `:13` — coverage thresholds.
- `src/views/layout.ejs:47` — `meta[name="csrf-token"]` emission.
- `src/views/donations/index.ejs:6`, `src/views/donations/checkout.ejs:14` — hidden `input[name="_csrf"]`.
- `src/routes/contact.js:33` — POST `/contact`.
- `src/routes/donations.js:21` — POST `/donations/checkout`.
- `src/routes/admin/pages.js:75`,`:106` — admin page Save / Publish writes.
- `public/js/contact-form.js:40`, `public/js/page-editor.js:9`,`:53`, `public/js/adminTour.js:75`,`:83` — client reads the meta tag and sends a `CSRF-Token` header; `public/js/account-settings.js:5` — client reads the hidden `_csrf` input.
- `node_modules/csurf/index.js:133` — token accepted from `req.headers['csrf-token']`; default value from `req.body._csrf`.
- `__tests__/integration/donationRoutes.test.js:1` — existing supertest + db-mock integration pattern to follow (`const app = require('../../src/server')`).
