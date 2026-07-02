---
title: Delete the WebSocket query-string token fallback - Plan
type: fix
date: 2026-07-01
topic: ws-query-token-fallback-removal
execution: code
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# Delete the WebSocket query-string token fallback - Plan

## Goal Capsule

- Objective: Remove the query-string branch of WebSocket authentication so the chat upgrade trusts only the httpOnly `auth_token` cookie, eliminating a credential-exposure surface.
- Product authority: Idea I7 in `docs/ideation/2026-07-01-full-project-review-ideation.html`.
- Open blockers: None. The pre-planning grep is resolved below (no legitimate consumer sends a token in the WS query).

## Product Contract

### Summary

The WebSocket upgrade will authenticate identity and moderator status from the cookie alone. A JWT passed in the WS query string will be ignored, closing off a path that leaks credentials into access logs, proxy history, and `Referer` headers.

---

### Problem Frame

A JWT gates chat identity and moderator status. Accepting that JWT from the URL query string means the credential can surface in access logs, proxy caches, and referrer headers wherever the URL is recorded. The shipped browser client never uses this path; it relies on the cookie the browser attaches automatically to same-origin upgrades. The query branch therefore carries risk without serving any live consumer.

---

### Requirements

R1. The WebSocket upgrade handler must derive the authentication token exclusively from the `auth_token` cookie on the upgrade request.

R2. A token supplied in the WebSocket URL query string must not be used for authentication; such a connection must be treated as if no token were present.

R3. Behavior for the real browser client must be unchanged: a valid `auth_token` cookie still yields the correct user identity and role, and the guest path (no cookie, valid `guestName`) still applies.

R4. The removal must not alter unrelated query-string handling on the same upgrade (`streamId`, `guestName`).

---

### Acceptance Examples

- AE1. Covers-R2: When a client opens the WS upgrade with a valid JWT only in the query string (`?...&auth_token=<jwt>`) and no `auth_token` cookie, then the connection is authenticated as a guest (or rejected if no valid `guestName`), never as the JWT's user.
- AE2. Covers-R1,R3: When a client opens the WS upgrade with a valid `auth_token` cookie, then the connection resolves to that user's id and role.

### Success Criteria

- The existing chat socket suite (`__tests__/integration/chatSocket.test.js`) stays green.
- A regression test asserts a query-string token is not accepted for authentication (AE1).
- A repo grep confirms no client or test helper sends `auth_token` inside a WS query string.

### Scope Boundaries

- OUT: Changing the cookie parsing, JWT verification, `jti`/`token_version` checks, or the guest-name path.
- OUT: Any change to `public/js/live-chat.js` (it already sends no token in the query).
- OUT: Touching `NODE_ENV === 'test'` branches or any other auth/middleware surface.
- OUT: Broadening the fix to other query-string parameters or other sockets/routes.

### Dependencies / Assumptions

- Assumes same-origin WS upgrades carry the httpOnly `auth_token` cookie automatically, which is how the shipped client authenticates.

### Outstanding Questions

Resolve Before Planning:
- Confirm nothing legitimate depends on `auth_token` in a WS query — Resolved: a repo-wide grep found the single query read at `src/services/chatSocketServer.js:253`; every test in `__tests__/integration/chatSocket.test.js` and the browser client pass the token via cookie header only, so the branch has no live consumer.

Deferred to Planning:
- None.

### Sources / Research

- `src/services/chatSocketServer.js:253` — the `cookies.auth_token || query.auth_token` line to reduce to cookie-only.
- `src/services/chatSocketServer.js:222` — `query` origin (`parsedUrl.query`), also feeding `streamId` and `guestName`.
- `public/js/live-chat.js:163` — client WS URL builds `streamId` + `guestName` only, no `auth_token`.
- `__tests__/integration/chatSocket.test.js:165,191,214,317,348,379,418` — existing tests authenticate via `cookie: auth_token=...`; regression test lands here.
