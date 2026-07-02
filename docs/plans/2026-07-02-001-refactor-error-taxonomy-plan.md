---
title: "Error taxonomy: AppError hierarchy plus serialization middleware - Plan"
type: refactor
date: 2026-07-02
topic: error-taxonomy-apperror-middleware
execution: code
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# Error taxonomy: AppError hierarchy plus serialization middleware

## Goal Capsule

Objective: replace the scattered, per-controller error handling with one typed `AppError` hierarchy and one central serializer so internal strings stop becoming HTTP bodies and WebSocket frames, and every current and future controller inherits safe, consistent errors.

Product authority: idea I14 in `docs/ideation/2026-07-01-full-project-review-ideation.html:466`.

Open blockers: none. The status-code question is resolved (2026-07-02): `ValidationError` maps to 400, preserving the current codes and the 31 dependent test assertions. The taxonomy changes error structure and safety, not status numbers.

## Product Contract

### Summary

Introduce a small typed error hierarchy (`ValidationError`, `NotFoundError`, `AuthError`, `ProviderError`, `InternalError`) with a fixed type→status mapping, one central mapper consumed by both the Express terminal error handler and the chat WebSocket handler, and convert the highest-leak call sites. This is foundational, cross-cutting infrastructure: it touches many controllers, so it should land before other controller-touching work (I10 donation form, PayPal provider, admin CRUD) so those inherit the convention instead of re-inventing it.

### Problem Frame

Services throw 122 bare `throw new Error('...')` across 16 files (`authService` 29, `StreamingService` 22, `userService` 17, `EventService` 13, `ChatService` 11, `AnnouncementService` 10), and controllers reverse-engineer HTTP status from the message text. `userController.js:76` returns `res.status(400).json({ message: error.message })` (raw internal string as body); `userController.js:168` regex-sniffs `/must be|consent|required|invalid/i` to pick 400 vs 500; `announcementController.js:120` and `:140` derive status from `error.message.includes('required')` / `.includes('not found')`; `streamingController.js:161` branches on `error.message.startsWith('Cannot')`. The chat WebSocket handler echoes the raw exception straight to the client: `chatSocketServer.js:192` sends `{ type: 'error', message: err.message }`. The result is a scattered class of leaks (auth internals, decryption-failure strings, provider text) and brittle status logic that breaks whenever a message string is reworded.

### Key Decisions

The typed error is the single source of truth for both HTTP status and the client-safe message; controllers and the WS handler stop inspecting message text. Type→status mapping is fixed: `ValidationError`→400 (preserving current codes), `NotFoundError`→404, `AuthError`→401 or 403, `ProviderError`→502, `InternalError`→500. The mapping lives in one module reused by the Express handler and the WS handler, because the WebSocket path is not Express middleware and cannot reach the terminal handler. Unknown / untyped errors default to 500 with a generic message, which is what makes incremental adoption safe: unconverted call sites keep working, just without a bespoke status.

### Requirements

**Typed hierarchy**

R1. Add a base `AppError` (CommonJS, plain class extending `Error`) carrying: a stable `name`, an HTTP `statusCode`, a client-safe `clientMessage`, an `expose` flag marking whether `clientMessage` may be shown to clients, and an optional `details`/`cause` for logging only. It must capture a stack trace.

R2. Provide the subclasses `ValidationError`, `NotFoundError`, `AuthError`, `ProviderError`, and `InternalError`, each fixing its `statusCode` per the mapping (Validation→400 to preserve current codes, NotFound→404, Auth→401/403, Provider→502, Internal→500) and defaulting `expose` appropriately (operational subclasses expose their message; `InternalError` does not).

R3. `AuthError` must support both 401 (unauthenticated) and 403 (forbidden), either via a status argument or a distinct forbidden variant; the choice is a planning detail, not a contract change.

R4. Every typed error constructed at a converted call site must carry a client-safe `clientMessage` and, where useful, richer internal `details`; the two must be separable so logging can keep detail while responses stay safe.

**Central mapping and Express middleware**

R5. Add one mapping function that, given any thrown value, returns `{ statusCode, clientMessage, expose }`: an `AppError` maps by its own fields; a non-`AppError` maps to 500 with a generic safe message and `expose: false`.

R6. Extend the existing terminal Express error handler at `src/server.js:393` to use that mapping. It must preserve the current `EBADCSRFTOKEN`→403 JSON behavior, set the response status from the mapping, and never emit a raw non-exposed message to the client.

R7. The handler must log full detail — `err.message`, `err.stack`, request id, method, and URL — through `src/utils/logger.js` (winston) for every error, regardless of what the client sees, preserving the current log line at `src/server.js:402`.

R8. The handler must content-negotiate its response body: JSON for `/api` routes and `Accept: application/json` requests, and the existing HTML `error` view (`src/views/error.ejs`) otherwise. Today the terminal handler renders HTML for all non-CSRF errors, so an uncaught error on a JSON route would return an HTML body; the negotiated handler closes that gap.

R9. For untyped / non-exposed errors the client message must be generic (e.g. "Something went wrong"); the existing dev convenience that surfaces `err.message` when `NODE_ENV !== 'production'` (`src/server.js:405`) may be retained but must never apply in production.

**Chat WebSocket parity**

R10. The chat WebSocket catch at `src/services/chatSocketServer.js:188` must stop sending raw `err.message`. It must send a client-safe message derived from the same mapping (R5), falling back to a generic message for untyped errors, so the WS path has the same safety contract as HTTP.

**Incremental conversion of highest-leak call sites**

R11. Convert the identified highest-leak controllers so they no longer derive status from message text or echo raw messages: `userController.js:76/101/120/135` and the regex branch at `:168-172`; `announcementController.js:120-121/140-142/155-156/169-170/191-192`; `streamingController.js:161-163/178-180/195-197`; `chatController.js:80/140-141/169-170`. Each converted path must produce its status and client message from a typed error (via `next(err)` to the central handler or the shared mapping), not from string inspection.

R12. Convert the corresponding highest-leak service throws (in `authService`, `userService`, `StreamingService`, `AnnouncementService`, `ChatService`, `MemberDirectoryService`) to typed errors, preserving any message that is intentionally user-facing (invalid credentials, account-locked, approval-pending at `authService.js:169/188/243`) as the typed error's `clientMessage` so existing user-visible behavior does not regress.

R13. Incremental adoption is explicitly acceptable: unconverted throws continue to surface as `InternalError`→500 with a generic message. No requirement forces converting all 122 throw sites in this change.

R14. The future PayPal provider path (`src/services/payments/PaymentProvider.js:21/30`) must be able to throw `ProviderError`→502 through the same mapping; no PayPal-specific error handling is added here.

**Constraints**

R15. No `console.log` in `src/`; all detail logging goes through `src/utils/logger.js`.

R16. No new framework or dependency; the hierarchy and mapping are plain CommonJS modules.

R17. Do not modify any `NODE_ENV === 'test'` escape-hatch branches in middleware, server, or config.

### Acceptance Examples

AE1. A service throws `new NotFoundError('User not found')`; the controller calls `next(err)`; the client receives HTTP 404 with the safe message and no stack. Covers-R2, R6, R8.

AE2. A service throws a bare `new Error('pg_dump failed: /path/...')` at an unconverted site; the client receives HTTP 500 with a generic "Something went wrong" body while the full message and stack are logged. Covers-R5, R7, R9, R13.

AE3. A chat WebSocket message handler throws inside its try; the client frame is `{ type: 'error', message: <safe generic-or-typed message> }`, never the raw exception text. Covers-R5, R10.

AE4. A converted validation failure returns its configured status (400) and a client-safe message, with no `error.message.includes(...)` / `.startsWith(...)` string logic remaining at that call site. Covers-R11, R12.

AE5. A `ProviderError` thrown from a payment provider maps to HTTP 502 with a safe message. Covers-R2, R14.

### Scope Boundaries

Out: converting all 122 `throw new Error` sites (only the enumerated highest-leak paths are in scope). Out: the second global `res.locals.user` decode, CSRF, or any auth/RBAC middleware changes beyond consuming the new error types. Out: new i18n or user-facing error-copy design. Out: PayPal integration itself (only the `ProviderError` seam is provided). Out: reworking the HTML `error.ejs` / `404.ejs` views.

### Dependencies / Assumptions

This is a substrate that other controller-touching work depends on; it should land before I10 (donation form), the PayPal provider, and further admin CRUD so they inherit the convention. Assumes the existing terminal handler at `src/server.js:393` remains the single Express error sink and is extended rather than duplicated. Assumes winston logger (`src/utils/logger.js`) stays the detail-logging channel. Assumes the chat WS handler and the Express handler can share one mapping module. Assumes intentionally user-facing auth/validation messages must be preserved as `clientMessage` to avoid regressing existing tests and UX.

### Outstanding Questions

Resolve Before Planning:
- Status code for validation: RESOLVED (2026-07-02) — keep `ValidationError`→400. Current controllers return 400 and 31 integration-test assertions reference it; adopting 422 is churn for marginal semantic gain and risks client coupling. The change preserves status codes and is not status-test-breaking.
- `AuthError` shape: single class with a status argument (401/403) versus two variants (`UnauthorizedError`/`ForbiddenError`).

Deferred to Planning:
- Exact JSON error envelope shape (`{ success:false, message }` vs `{ error }`) — controllers currently use both (`userController.js:76` uses `message`, `chatController.js:80` uses `error`); pick one for converted paths.
- Whether unconverted controllers should be nudged to `next(err)` in a follow-up or left as-is under R13.

### Sources / Research

- `docs/ideation/2026-07-01-full-project-review-ideation.html:466-474` — I14 description, basis, and the "land incrementally" downside.
- `src/controllers/userController.js:76` — raw `res.status(400).json({ message: error.message })`; `:168-172` — regex `/must be|consent|required|invalid/i` status sniffing.
- `src/controllers/announcementController.js:120-121`, `:140-142`, `:155-156`, `:169-170`, `:191-192` — status derived from `error.message.includes('required'|'not found')`, raw message echoed.
- `src/controllers/streamingController.js:161-163`, `:178-180`, `:195-197` — `error.message.startsWith('Cannot'|'Stream not found')` branching.
- `src/controllers/chatController.js:80`, `:140-141`, `:169-170` — `res.status(...).json({ error: error.message })`, 404 only when message equals `'Message not found'`.
- `src/services/chatSocketServer.js:188-193` — WS catch echoes raw `err.message` to the client.
- `src/server.js:393-408` — existing terminal error handler: `EBADCSRFTOKEN`→403, else logs and renders the HTML `error` view with 500, message gated by `NODE_ENV !== 'production'`.
- `src/services/authService.js:169/188/240-245` — intentionally user-facing auth messages (invalid credentials, lockout, verification/approval) that must be preserved as `clientMessage`.
- `src/services/DonationService.js:38-64`, `src/services/payments/PaymentProvider.js:21/30` — validation and provider-seam throws; PaymentProvider is the `ProviderError` leverage point.
- Grep totals: 122 `throw new Error(` across 16 service files; 19 controllers; 31 `400` assertions and 0 `422` references in `__tests__`.
