---
status: ready-for-planning
date: 2026-06-14
actors: [visitor-member, rabbi-admin, admin]
---

# CSP-Compliant Views — Restore Flows Broken by Strict Content-Security-Policy

## Problem Frame

The app ships a strict Content-Security-Policy via `helmet` in `src/server.js` —
`scriptSrc 'self'` + hCaptcha only, **no `'unsafe-inline'`**, `styleSrc` likewise,
applied in **every** environment. The policy was deliberately tightened (a comment
at `src/server.js` notes *"Removed 'unsafe-inline' — check views for compatibility
if broken"*), but several shipped views were never updated. The result is a **latent
regression**: any view that relies on an inline `<script>`, inline `<style>`/`style=`,
an `on*=` event handler, or a non-allowlisted CDN is silently blocked in production
(and in dev) — the markup loads but the code never runs.

Verified firsthand in the 2026-06-14 launch-readiness pass
(see `_bmad-output/implementation-artifacts/launch-readiness-2026-06-14.md`, Blocker B):

- **Password reset is dead** — `src/views/auth/request-password-reset.ejs` and
  `reset-password.ejs` hold their entire submit logic in an inline `<script>` with
  no external fallback → the forms never submit. Public + security-critical.
- **Rabbi onboarding tour broken** — `src/views/admin/dashboard.ejs` loads driver.js
  from `cdn.jsdelivr.net` (not allowlisted) + an inline `<script>` setting
  `window.USER_ONBOARDING_COMPLETE`. (The core dashboard is unaffected.)
- **Page/CMS editor broken** — `src/views/admin/pages/edit.ejs` loads Quill from
  `cdn.quilljs.com` + inline init script + inline `<style>`.
- **Inert admin buttons** — inline `onclick`/`onsubmit` in `admin/recordings/list.ejs`
  and `admin/streaming/index.ejs` silently do nothing in production.
- **Visual breakage** — inline `style=` in `chat-moderation.ejs`, `recordings/show.ejs`,
  `recordings/list.ejs`, and the `404.ejs`/`error.ejs` centering style.
- **Dev artifact exposed** — `src/views/responsive-test.ejs` (pervasive inline styles +
  an inline `<script>`) is publicly routed in production via `src/routes/home.js`.

This is a **public-launch blocker**. The board demo can proceed without it (avoid
demoing the affected flows), but the site cannot go live to replace florencetemple.org
while password reset is broken.

---

## Goals

- Every shipped view complies with the **existing** strict CSP — no inline scripts,
  styles, or handlers; no non-allowlisted CDNs — so all flows work in production.
- **Keep the CSP policy unchanged** (no `'unsafe-inline'`, no new CDN allowlist
  entries). The strong posture is the point.
- **Keep all current features** by self-hosting the two CDN libraries.
- **Prevent recurrence** — this class of bug returned silently once; an automated
  guard should stop it returning again.

## Success Criteria

- Under enforced CSP in production: the password-reset request and reset flows submit
  and complete; the onboarding tour renders and steps; the page editor loads and saves;
  the admin recording/stream buttons fire.
- Zero CSP-blocked console errors on any shipped page.
- The dev `responsive-test` page is not reachable in production.
- An automated check fails if any shipped view reintroduces an inline
  `<script>`/`<style>`/`on*=` handler or a non-allowlisted external script/style URL.

---

## Key Decisions (resolved this brainstorm)

- **D1 — Comply with the strict CSP** (not nonce-based CSP, not policy relaxation):
  move inline scripts to external `/js` files, pass server-rendered values via `data-*`
  attributes, move inline styles to CSS classes. Rationale: keeps the simplest, strongest
  policy with no per-request nonce machinery.
- **D2 — Vendor both CDN libraries** (driver.js for the tour, Quill for the page editor)
  into `public/` so both features keep working from `'self'`. Rationale: preserves shipped
  features; the alternative (drop the tour / downgrade the editor to a `<textarea>`) was
  rejected.
- **D3 — Full sweep, not critical-only.** Fix every CSP-blocked surface in this effort,
  not just password reset. Rationale: they share one fix pattern and are all latent prod
  breakage.

---

## Actors

- **A1 — Visitor / Member:** initiates and completes a password reset.
- **A2 — Rabbi / Admin:** sees the first-login onboarding tour; uses admin recording/stream
  controls.
- **A3 — Admin (`MANAGE_CONTENT`):** edits About/Contact/policy pages in the CMS editor.

## Key Flows

- **F1 — Password reset:** request a reset link → set a new password.
- **F2 — Onboarding tour:** first admin/rabbi login → guided walkthrough.
- **F3 — CMS page editing:** open the page editor → edit rich text → save/publish.
- **F4 — Admin content actions:** publish/load a recording; cancel a scheduled stream
  (confirm dialog).

---

## Requirements

- **R1** — Password-reset views (`auth/request-password-reset.ejs`, `auth/reset-password.ejs`)
  move all submit/fetch logic to external `/js` files served from `'self'`; any server values
  (tokens, endpoints) pass via `data-*` attributes. F1 works end-to-end under CSP.
- **R2** — Vendor driver.js (script + CSS) into `public/`; the tour loads from `'self'`.
  Replace the inline `window.USER_ONBOARDING_COMPLETE` script with a `data-*` attribute read
  by `public/js/adminTour.js`. The tour element ids (`#tour-announcements`, `#tour-calendar`,
  `#tour-messages`, `#replay-tour-btn`) are preserved. F2 works under CSP.
- **R3** — Vendor Quill (script + CSS) into `public/`; move the editor init to an external
  `/js` file; move inline `<style>` blocks to a CSS file. F3 works under CSP.
- **R4** — Rebind inline `onclick`/`onsubmit` handlers (`admin/recordings/list.ejs`,
  `admin/streaming/index.ejs`) via `addEventListener` in external `/js`. F4 works under CSP.
- **R5** — Move inline `style=` attributes in shipped views (`chat-moderation.ejs`,
  `recordings/show.ejs`, `recordings/list.ejs`, `404.ejs`, `error.ejs`) to CSS classes.
- **R6** — Gate the dev `responsive-test` page (and its route in `src/routes/home.js`) to
  non-production, or remove it.
- **R7** — The CSP in `src/server.js` is unchanged: no `'unsafe-inline'`, no new CDN entries
  in `scriptSrc`/`styleSrc`. All restored assets load from `'self'`.
- **R8** — A regression guard fails when a shipped `src/views/**` file contains an inline
  `<script>`/`<style>`/`on*=` handler or a non-allowlisted external script/style URL.

---

## Acceptance Examples

- **AE1 (F1):** With CSP enforced, a user submits the password-reset request form → it posts
  via the external script → confirmation shown; following the emailed link, they set a new
  password → success. No CSP console errors.
- **AE2 (F2):** A rabbi's first login renders the onboarding tour (driver.js from `'self'`) and
  steps through all stops. No CSP errors.
- **AE3 (F3):** An admin opens the page editor → Quill loads from `'self'` → edits and saves
  rich text successfully. No CSP errors.
- **AE4 (F4):** An admin clicks "Publish"/"Load" on a recording and cancels a scheduled stream
  (confirm dialog) → each handler fires.
- **AE5 (R6):** `GET /responsive-test` in production → not served (404 or env-gated).
- **AE6 (R8):** Adding an inline `<script>` to any `src/views` file → the regression guard fails.

---

## Scope Boundaries

**In scope:** R1–R8 above — restore all CSP-blocked flows by complying with the existing
policy, vendor the two CDN libs, gate the dev page, add the regression guard.

**Deferred to follow-up (tracked separately in the launch-readiness report):**
- The `error.ejs` payload-shape mismatch (controllers pass `{ error }`; the view reads
  `{ message, title }`) — a separate should-fix, not CSP-specific. (S1 in the launch report.)

**Out of scope (other launch work / not this effort):**
- Changing the CSP policy itself (nonces, new allowlist entries).
- Production env/secrets configuration; the `/unsubscribe` route + signed token; real PayPal.
- Any feature redesign or new admin functionality.

---

## Dependencies & Assumptions

- The currently-referenced library versions are **driver.js@1.0.1** and **Quill@1.3.6**;
  vendor those exact versions (confirm/upgrade decision belongs in planning).
- `'self'` is already allowlisted in the CSP, so vendored assets need no policy change.
- Grounding was verified firsthand in the 2026-06-14 launch-readiness audit; file:line
  references live in `_bmad-output/implementation-artifacts/launch-readiness-2026-06-14.md`
  and `_bmad-output/implementation-artifacts/deferred-work.md`.

## Outstanding Questions (deferred to planning)

- Regression-guard mechanism — a jest test that scans `src/views/**`, a CI grep, or an
  ESLint rule. (Implementation choice for `ce-plan`.)
- Whether the password-reset fix should ship as a standalone fast PR ahead of the rest,
  given it's a live public blocker. (Sequencing for `ce-plan`.)

---

## Sources & Research

- `_bmad-output/implementation-artifacts/launch-readiness-2026-06-14.md` — Blocker B, verified findings.
- `_bmad-output/implementation-artifacts/deferred-work.md` — CSP-blocked-flows cluster entry.
- `src/server.js` — helmet CSP directives (the policy being complied with).
- `src/views/auth/*`, `src/views/admin/dashboard.ejs`, `src/views/admin/pages/edit.ejs`,
  `src/views/admin/recordings/list.ejs`, `src/views/admin/streaming/index.ejs`,
  `src/views/recordings/show.ejs`, `src/views/responsive-test.ejs`, `src/routes/home.js`.
