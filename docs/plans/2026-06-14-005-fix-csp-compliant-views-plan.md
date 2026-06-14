---
date: 2026-06-14
type: fix
origin: docs/brainstorms/2026-06-14-csp-compliant-views-requirements.md
---

# fix: CSP-Compliant Views — Restore Flows Broken by Strict Content-Security-Policy

## Summary

The strict CSP in `src/server.js` (`scriptSrc`/`styleSrc` = `'self'` + hCaptcha,
no `'unsafe-inline'`, applied in every environment) silently breaks any view that
relies on an inline `<script>`, inline `<style>`/`style=`, an `on*=` handler, or a
non-allowlisted CDN. The markup loads but the code never runs. Most severe: the
**password-reset flow is dead** in production. This plan restores every affected
flow by making the views **comply** with the existing policy — the policy itself is
not changed — and adds a regression guard so the whole class can't silently return.

Fix pattern, one unit per surface:

| Surface | What's broken | Fix |
|---|---|---|
| Password reset (`auth/*`) | inline `<script>` submit logic | extract to external `/js` |
| Onboarding tour (`admin/dashboard.ejs`) | driver.js CDN + inline bootstrap | vendor driver.js; bootstrap via `data-*` |
| Page editor (`admin/pages/edit.ejs`) | Quill CDN + inline init/`<style>` | vendor Quill; externalize init; thread content via hidden element |
| Admin buttons (`recordings/list`, `streaming/index`) | inline `onclick`/`onsubmit` | `addEventListener` + `data-*` in external `/js` |
| Inline styles (several views) | `style=` attributes | CSS classes |
| Dev `responsive-test` page | inline styles + script, served in prod | gate route to non-production |
| (recurrence) | — | Jest guard scanning views vs the CSP allowlist |

---

## Problem Frame

The CSP was deliberately tightened — a comment in `src/server.js` notes *"Removed
'unsafe-inline' — check views for compatibility if broken"* — but several shipped
views were never updated, making this a **latent regression**. All findings were
verified firsthand in the 2026-06-14 launch-readiness pass
(`_bmad-output/implementation-artifacts/launch-readiness-2026-06-14.md`, Blocker B).
Helmet applies the policy in all environments, so the breakage is present in dev as
well as production; it has gone unnoticed because the affected flows weren't
exercised after the policy change. Password reset is public and security-critical,
so this is a public-launch blocker.

---

## Requirements

Traceability to the origin requirements doc (R1–R8, F1–F4, AE1–AE6):

- **R1** — Password-reset views move all submit logic to external `/js`; flow works
  under CSP (F1, AE1). Delivered by U1.
- **R2** — Vendor driver.js; tour loads from `'self'`; onboarding flag via `data-*`;
  tour ids preserved (F2, AE2). U2.
- **R3** — Vendor Quill; editor init external; inline `<style>` → CSS; content threaded
  via a hidden element (F3, AE3). U3.
- **R4** — Inline `onclick`/`onsubmit` rebound via `addEventListener` (F4, AE4). U4.
- **R5** — Inline `style=` attributes → CSS classes. U5.
- **R6** — Dev `responsive-test` page gated out of production (AE5). U6.
- **R7** — CSP policy in `src/server.js` unchanged: no `'unsafe-inline'`, no new CDN
  allowlist entries; restored assets load from `'self'`. Honored across U1–U7.
- **R8** — Regression guard fails on any reintroduced inline script/style/handler or
  non-allowlisted external asset (AE6). U7.

---

## Key Technical Decisions

- **KTD1 — Comply with the strict CSP, not nonces** (origin D1). Move inline code to
  external files; do not add `'unsafe-inline'` or a nonce machinery. Rationale: keeps
  the simplest, strongest policy with no per-request plumbing.
- **KTD2 — Vendor driver.js@1.0.1 and Quill@1.3.6 into `public/vendor/`** (origin D2),
  served from `'self'`. Pin the currently-referenced versions; the libraries are
  swapped from CDN to local with no behavior change. (Version-upgrade is out of scope;
  see Open Questions.)
- **KTD3 — Thread server values into scripts via the DOM, never inline interpolation.**
  Most scripts read what they need from existing DOM (CSRF from `meta`/hidden input,
  reset token from the URL) and need no threading. The one exception is the page editor,
  which currently interpolates `<%- page.content %>` into its inline init — that value
  moves into a hidden, escaped element the external script reads.
- **KTD4 — Regression guard is a Jest view-scanner mirroring the CSP allowlist**
  (resolves origin Open Question 1). It runs inside the existing `npm test` gate; it
  reads the allowlisted hosts from the CSP intent (hCaptcha, Facebook, YouTube, Google
  frames) so legitimate embeds pass while inline code and rogue CDNs fail.
- **KTD5 — `src/server.js` CSP directives are not modified** (R7). This plan only
  changes views, client assets, one route guard, and a controller render call.
- **KTD6 — `responsive-test.ejs` is gated out of production (U6) and excluded from the
  U7 guard** — it never ships to prod, so cleaning its inline styles isn't required.

---

## Implementation Units

### U1. Externalize the password-reset scripts (ship-first)

- **Goal:** Restore the password-reset request and completion flows under CSP by moving
  their inline submit logic to external files.
- **Requirements:** R1, R7 (F1, AE1).
- **Dependencies:** none.
- **Files:**
  - `src/views/auth/reset-password.ejs` (modify)
  - `src/views/auth/request-password-reset.ejs` (modify)
  - `public/js/auth-reset-password.js` (new)
  - `public/js/auth-request-password-reset.js` (new)
  - `__tests__/integration/authViewsCsp.test.js` (new)
- **Approach:** Move each view's `<script>…</script>` body verbatim into the matching
  new `/js` file and replace it with `<script src="/js/auth-…js"></script>`. The
  reset-password script reads CSRF from the existing `meta[name="csrf-token"]` / hidden
  `_csrf` input and the token from the URL query, so no server value is interpolated into
  the JS — a clean extraction. Confirm the request-reset script is likewise self-contained
  during execution; if it interpolates a server value, thread it via a `data-*` attribute.
- **Patterns to follow:** `public/js/account-settings.js` (external fetch-submit module);
  `src/views/admin/dashboard.ejs` includes a bodyView `<script src="/js/…">`.
- **Execution note:** Behavior-preserving — the existing `POST /api/auth/reset-password`
  flow must stay green. This unit is independently shippable/deployable ahead of the rest
  (it is the live public blocker).
- **Test scenarios:**
  - Covers AE1. `GET /reset-password?token=…` renders with `<script src="/js/auth-reset-password.js">`
    and zero inline `<script>` blocks.
  - `GET /request-password-reset` renders with its external script and no inline `<script>`.
  - Integration: the existing reset-password API flow tests still pass unchanged (behavior preserved).
  - Edge: `/reset-password` with no token still loads the external script (the no-token UI
    is JS-driven; assert the tag is present).
- **Verification:** both pages submit under enforced CSP with no CSP console errors; auth
  view + flow tests green.

### U2. Vendor driver.js and make the onboarding tour CSP-safe

- **Goal:** Restore the Rabbi onboarding tour by self-hosting driver.js and removing its
  inline bootstrap.
- **Requirements:** R2, R7 (F2, AE2).
- **Dependencies:** none.
- **Files:**
  - `public/vendor/driver.js` (new — vendored driver.js@1.0.1 IIFE build)
  - `public/vendor/driver.css` (new — vendored driver.css@1.0.1)
  - `src/views/admin/dashboard.ejs` (modify)
  - `public/js/adminTour.js` (modify)
  - `__tests__/views/adminDashboard.accessibility.test.js` (extend)
- **Approach:** Swap the two `cdn.jsdelivr.net` refs for `/vendor/driver.js` and
  `/vendor/driver.css`. Remove the inline `<script>window.USER_ONBOARDING_COMPLETE=…</script>`
  and instead set `data-onboarding-complete="<%= user.onboarding_complete || false %>"` on a
  rabbi-tools element; update `adminTour.js` to read it via `dataset.onboardingComplete`.
  Preserve the tour element ids (`#tour-announcements`, `#tour-calendar`, `#tour-messages`,
  `#replay-tour-btn`).
- **Patterns to follow:** `public/js/admin-dashboard.js` (reads a `data-*` attribute via
  `dataset`); `express.static` already serves `public/`.
- **Test scenarios:**
  - Covers AE2. Rendered `/admin` (rabbi) contains `/vendor/driver.js` (not jsdelivr) and no
    inline `<script>` in the rabbi-tools block; the onboarding value is on a `data-*` attribute.
  - The four tour ids are still present in the rendered output.
  - Regression: the existing dashboard accessibility test still passes.
- **Verification:** tour loads and steps in a browser under CSP (no CSP errors); `/vendor`
  assets return 200.

### U3. Vendor Quill and make the page editor CSP-safe

- **Goal:** Restore the CMS page editor by self-hosting Quill and externalizing its init,
  content threading, and inline styles.
- **Requirements:** R3, R7 (F3, AE3).
- **Dependencies:** none.
- **Files:**
  - `public/vendor/quill.js` (new — quill@1.3.6)
  - `public/vendor/quill.snow.css` (new — quill snow theme)
  - `src/views/admin/pages/edit.ejs` (modify)
  - `public/js/page-editor.js` (new)
  - `public/css/page-editor.css` (new)
  - `src/controllers/pageController.js` (modify — pass `stylesheets` to the editor render)
  - `__tests__/integration/pageEditorCsp.test.js` (new)
- **Approach:** Vendor Quill js + snow css into `public/vendor/`. In `edit.ejs`: replace the
  CDN `<script>`/`<link>` with the vendored paths (CSS via the layout `stylesheets` array);
  remove the inline init `<script>`; put `page.content` into a hidden, escaped element
  (e.g. a hidden `<textarea>` read via `.value`) instead of interpolating it into a script
  (KTD3); move the inline `<style>` blocks into `page-editor.css`. `page-editor.js`
  initializes Quill, loads the hidden content into the editor, and serializes the editor
  HTML back into the form's hidden field on submit. Update `pageController` to pass
  `stylesheets: ['/vendor/quill.snow.css', '/css/page-editor.css']`.
- **Patterns to follow:** the `stylesheets` array include (`src/views/layout.ejs` head);
  `public/js/account-settings.js` (external module).
- **Test scenarios:**
  - Covers AE3. `GET /admin/pages/:slug` renders with `/vendor/quill.js` + `/vendor/quill.snow.css`
    (no quilljs CDN), no inline `<script>`, no inline `<style>`; `page.content` is present in a
    hidden non-script element.
  - The hidden source element carries the saved page HTML (content round-trips into the editor).
  - Error: page content containing quotes/markup is attribute/text-escaped in the hidden element
    (no script-context or attribute-breakout injection).
  - Regression: existing page edit/save/publish tests pass.
- **Verification:** editor loads and saves rich text in a browser under CSP; no CSP errors.

### U4. Externalize admin inline event handlers

- **Goal:** Restore the inert admin buttons (recording publish/load, stream-cancel confirm)
  by replacing inline `on*=` handlers with `addEventListener` bindings.
- **Requirements:** R4, R7 (F4, AE4).
- **Dependencies:** none.
- **Files:**
  - `src/views/admin/recordings/list.ejs` (modify)
  - `public/js/admin-recordings.js` (new)
  - `src/views/admin/streaming/index.ejs` (modify)
  - `public/js/admin-streaming.js` (new — or extend an existing streaming module; confirm
    during execution)
  - `__tests__/integration/adminViewsCsp.test.js` (new)
- **Approach:** In `recordings/list.ejs`, replace `onclick="loadRecording('<%= … %>')"` with a
  `data-recording='<%= … %>'` attribute (HTML-attribute-escaped) plus a class hook, and move the
  inline `<script>` defining `loadRecording`/`publishRecording` into `admin-recordings.js`, which
  binds handlers via `addEventListener` and parses the `data-*` payload. In `streaming/index.ejs`,
  replace `onsubmit="return confirm('…')"` with a `data-confirm="…"` attribute and an external
  submit handler that intercepts and confirms.
- **Patterns to follow:** `public/js/live-chat.js` / `admin-dashboard.js` (delegated
  `addEventListener` + `dataset`).
- **Test scenarios:**
  - Covers AE4. Rendered `/admin/recordings` has no `onclick=` and references `/js/admin-recordings.js`;
    the recording payload sits in a `data-*` attribute.
  - Rendered `/admin/streaming` has no `onsubmit=`; the confirm message is in a `data-*` attribute.
  - Edge: the serialized recording `data-*` value is attribute-escaped (no attribute breakout).
  - Regression: existing recordings/streaming tests pass.
- **Verification:** publish/load and cancel-confirm work in a browser under CSP.

### U5. Move inline styles to CSS classes

- **Goal:** Remove `style=` attributes (and any `<style>` blocks) from shipped views so
  styleSrc compliance holds and visuals render in production.
- **Requirements:** R5, R7.
- **Dependencies:** none.
- **Files:**
  - `src/views/admin/chat-moderation.ejs`, `src/views/recordings/show.ejs`,
    `src/views/admin/recordings/list.ejs`, `src/views/404.ejs`, `src/views/error.ejs` (modify)
  - `public/css/main.css` (modify — add the equivalent classes)
- **Approach:** For each inline `style=`, add an equivalent class in `main.css` (utility classes
  for the 404/error centering) and swap the attribute for the class. Confirm no `<style>` blocks
  remain in these views.
- **Test scenarios:** Test expectation: none (pure presentation) — covered by U7 (the guard asserts
  zero `style=`/`<style>` in shipped views) and the existing a11y render tests (no structural
  regression).
- **Verification:** pages render styled correctly under CSP; U7 guard passes.

### U6. Gate the dev responsive-test page out of production

- **Goal:** Stop serving the dev-only `responsive-test` page (inline styles + script) in production.
- **Requirements:** R6 (AE5).
- **Dependencies:** none.
- **Files:**
  - `src/routes/home.js` (modify)
  - `__tests__/integration/responsiveTestGate.test.js` (new)
- **Approach:** Register the `/responsive-test` route only when `process.env.NODE_ENV !== 'production'`,
  so dev/test keep it and production returns 404 via the catch-all.
- **Test scenarios:**
  - Covers AE5. With the app loaded under `NODE_ENV=production`, `GET /responsive-test` → 404.
  - In the test environment the route remains reachable (200) so it stays usable in dev.
- **Verification:** `GET /responsive-test` 404s in production; still serves in dev.

### U7. CSP-compliance regression guard (Jest view-scanner)

- **Goal:** Fail the suite if any shipped view reintroduces an inline script/style/handler or a
  non-allowlisted external asset host.
- **Requirements:** R8 (AE6).
- **Dependencies:** U1–U6 (the guard only passes once the surfaces are fixed; sequence last).
- **Files:**
  - `__tests__/security/cspViewCompliance.test.js` (new)
- **Approach:** Scan `src/views/**/*.ejs` (excluding `responsive-test.ejs`, gated out of prod per
  U6 — KTD6). Fail a file that contains: an inline `<script>` without `src`, a `<style>` block, a
  `style=` attribute, an `on\w+=` handler attribute, or a `<script src>`/`<link href>` whose host
  is neither relative/`'self'` nor in the CSP allowlist (hCaptcha; plus the `frameSrc` hosts —
  Facebook, YouTube, Google — for `<iframe>`s). Mirror the allowlist from the `src/server.js` CSP
  directives. Failure messages name the file and the offending snippet.
- **Patterns to follow:** existing `__tests__` structure; read the helmet CSP directives in
  `src/server.js` for the allowlist.
- **Test scenarios:**
  - Covers AE6. The guard passes against the current (post-U1–U6) view tree.
  - Detector unit test: strings containing an inline `<script>`, a `<style>` block, a `style=`
    attribute, an `onclick=` handler, and a `jsdelivr` `<script src>` are each flagged; a
    `<script src="/js/x.js">` and an hCaptcha `api.js` src each pass.
  - Edge: allowlisted embeds (hCaptcha api.js, Google Maps frame, Facebook frame) do not trigger
    failure.
- **Verification:** `npx jest cspViewCompliance` green; deliberately adding an inline script to any
  view makes it fail.

---

## Scope Boundaries

**In scope:** R1–R8 — restore all CSP-blocked flows by complying with the existing policy, vendor
driver.js + Quill, gate the dev page, add the regression guard.

### Deferred to Follow-Up Work
- The `error.ejs` payload-shape mismatch (controllers pass `{ error }`; the view reads
  `{ message, title }`) — a separate should-fix tracked in the launch-readiness report (S1), not
  CSP-specific.
- Upgrading driver.js / Quill beyond the currently-pinned versions.

**Out of scope:** changing the CSP policy itself (nonces, new allowlist entries); production
env/secrets; the `/unsubscribe` route + signed token; real PayPal; any feature redesign.

---

## Risks & Dependencies

- **R-A — Behavior drift during extraction.** Moving inline scripts out could subtly change a flow.
  *Mitigation:* the auth scripts were read and confirmed self-contained; the page-editor value is
  threaded via a hidden element; every unit keeps the existing flow tests green.
- **R-B — Page-editor content round-trip.** The Quill init refactor must still load saved HTML and
  serialize edits back. *Mitigation:* explicit U3 round-trip + escaping tests.
- **R-C — Hidden-element injection.** `page.content` moving into a hidden element must be properly
  escaped to avoid a new injection vector. *Mitigation:* escaped textarea/text node, tested.
- **R-D — Guard false-positives.** The U7 scanner must allow legitimate embeds (hCaptcha, Maps,
  Facebook). *Mitigation:* mirror the CSP allowlist; detector unit tests cover allow/deny.
- **R-E — Vendored-lib drift.** *Mitigation:* pin versions; upgrades are deferred.
- **Dependencies (present):** strict CSP in `src/server.js`; the `stylesheets` array include in
  `layout.ejs`; `express.static` serving `public/`; the existing external-JS module pattern.

---

## System-Wide Impact

- **Views** in `src/views/auth/` and `src/views/admin/` lose all inline scripts/styles/handlers.
- **New client assets** under `public/js/`, `public/css/`, and `public/vendor/`.
- **`src/routes/home.js`** — one env guard on the dev route.
- **`src/controllers/pageController.js`** — one render call gains a `stylesheets` array.
- **`__tests__/`** — new CSP-focused integration tests + the regression guard.
- **No change** to the `src/server.js` CSP policy, to auth/RBAC, to migrations, or to the DB.

---

## Open Questions (deferred to implementation)

- Exact vendored filenames/build variants under `public/vendor/` (driver.js IIFE build; Quill
  build flavor).
- Whether `streaming/index.ejs` has an existing external JS module to extend vs. a new file.
- Whether `request-password-reset.ejs`'s inline script interpolates any server value (read during
  execution; thread via `data-*` if so).

---

## Sources & Research

- Origin: `docs/brainstorms/2026-06-14-csp-compliant-views-requirements.md`.
- `_bmad-output/implementation-artifacts/launch-readiness-2026-06-14.md` — Blocker B (verified findings).
- `src/server.js` — helmet CSP directives (the policy being complied with).
- Verified surfaces: `src/views/auth/reset-password.ejs` (+ `request-password-reset.ejs`),
  `src/views/admin/dashboard.ejs`, `src/views/admin/pages/edit.ejs`,
  `src/views/admin/recordings/list.ejs`, `src/views/admin/streaming/index.ejs`,
  `src/views/recordings/show.ejs`, `src/views/responsive-test.ejs`, `src/routes/home.js`.
- Pattern references: `public/js/admin-dashboard.js`, `public/js/account-settings.js`,
  `src/views/layout.ejs` (stylesheets array + bodyView script include).
