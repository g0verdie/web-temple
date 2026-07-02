---
title: "Honor the post-login redirect — and validate it as same-origin - Plan"
type: fix
date: 2026-07-01
topic: honor-post-login-redirect
execution: code
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# Honor the post-login redirect — and validate it as same-origin - Plan

## Goal Capsule

- Objective: after login, send a member to where they were deep-linking, and when there is nowhere to return to, land them on the member directory instead of the homepage — while making the returned path safe against open redirects.
- Product authority: owner decisions of 2026-07-01 (honor a valid redirect; default to /directory on direct login; validate the redirect as a same-origin relative path).
- Open blockers: none. One defense-in-depth question is deferred to planning.

## Product Contract

---

### Summary

On successful login, resolve a landing path from a validated redirect parameter, falling back to the member directory. The redirect value is accepted only when it is a same-origin relative path, closing the noted open-redirect exposure.

### Problem Frame

When a member deep-links to a members-only page while unauthenticated, the app bounces them to /login and preserves their destination in a redirect query parameter. After they authenticate, the client discards that parameter and always sends them to the homepage, so they never reach where they were going. The preserved value is also carried through untrusted, so honoring it naively would let a crafted parameter point a just-logged-in member at an external origin.

### Key Decisions

**Default to the member directory, not the homepage.** A direct login (no redirect parameter) reflects a member coming to use the directory — the main reason members sign in — so /directory is the correct empty-handed destination rather than the marketing homepage.

**Validate by allowlist, not denylist.** Accept only values that are unambiguously same-origin relative paths and reject everything else, so novel absolute-URL or host-injection shapes fail closed instead of requiring an ever-growing block list.

### Requirements

**Post-login destination**

R1. On successful login, resolve a landing path and navigate the member there, rather than always navigating to the homepage.

R2. When the login page carries a redirect parameter whose value passes validation, resolve the landing path to that value.

R3. When no redirect parameter is present, resolve the landing path to /directory.

R4. When a redirect parameter is present but its value fails validation, resolve the landing path to /directory.

**Same-origin validation (security)**

R5. Treat a redirect value as valid only when it is a same-origin relative path that begins with exactly one "/" — a leading slash not immediately followed by another slash.

R6. Reject any value carrying a scheme (for example http: or https:, an absolute URL) as invalid.

R7. Reject any protocol-relative value beginning with "//" (which a browser resolves to an external host) as invalid.

R8. Reject any empty, whitespace-only, or otherwise non-path value as invalid.

### Acceptance Examples

AE1. Covers R2, R5 — When a member deep-links to /directory/42, is bounced to /login?redirect=%2Fdirectory%2F42, and logs in successfully, they land on /directory/42.

AE2. Covers R6 — When the redirect parameter decodes to https://evil.example/phish, login succeeds and the member lands on /directory.

AE3. Covers R7 — When the redirect parameter decodes to //evil.example, login succeeds and the member lands on /directory.

AE4. Covers R3 — When a member logs in with no redirect parameter present, they land on /directory.

### Success Criteria

- No redirect value, however crafted, can navigate an authenticated member to an origin other than the site's own.
- The deep-link → login → land-on-target flow is exercised end-to-end, and AE1–AE4 are covered by automated tests.

### Scope Boundaries

- No new /dashboard or /member landing page is introduced; /directory is the default landing.
- The redirect-parameter encoding in the auth bounce (src/middleware/requireAuth.js:33) is not changed.
- The session-expired redirect (src/middleware/requireAuth.js:87), which intentionally carries no redirect parameter, is not touched.
- No framework, bundler, or inline script is added; validation lives in the existing external client script.
- Non-login entry points and other post-authentication flows are out of scope.

### Dependencies / Assumptions

- public/js/login.js is the login page's client handler, and the redirect value reaches it via the login page URL that requireAuth set.
- The redirect value arrives URL-encoded (encodeURIComponent at src/middleware/requireAuth.js:33) and is decoded before validation.
- /directory is a live authenticated member page (src/routes/directory.js:23, mounted at src/server.js:267).
- Strict CSP (no inline script) and the no-framework SSR-MPA constraint remain in force.

### Outstanding Questions

**Resolve Before Planning**

- None.

**Deferred to Planning**

- Should same-origin validation also be enforced server-side (defense in depth) — in the login API/controller or in requireAuth — in addition to the client-side check in public/js/login.js?
- Should validation operate on the decoded value, and how should exotic encodings (backslashes, encoded slashes) be treated?

### Sources / Research

- src/middleware/requireAuth.js:33 — unauthenticated HTML deep-links are bounced to /login with the encoded original URL as ?redirect.
- public/js/login.js:51 — the success handler hardcodes window.location.href = '/', ignoring the redirect parameter.
- src/routes/directory.js:23 — /directory is the authenticated member directory page.
- src/server.js:267 — /directory router mount point.
- src/routes/pages.js:161 — /account/directory is a 301 redirect stub, not a landing target.
