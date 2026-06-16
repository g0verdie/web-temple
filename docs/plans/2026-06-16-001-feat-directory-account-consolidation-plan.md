# feat: Consolidate the member's directory listing into Account Settings

**Type:** feat · **Depth:** Standard · **Date:** 2026-06-16
**Origin:** `docs/brainstorms/2026-06-16-directory-account-consolidation-requirements.md`

---

## Summary

Move the standalone `/account/directory` ("My Directory Listing") editor into `/account/settings` as a fourth, collapsed-by-default "Directory Listing & Privacy" section, so a member configures everything about themselves on one page. The `/account/directory` route becomes a permanent redirect, the three public `/directory` entry-point links repoint to the new anchor, and the editor's save stops bouncing to the public browse. No change to the editor's fields, validation, or save API, and no change to the public `/directory` browse of other members.

---

## Problem Frame

A member's own configuration is split across two pages. `/account/settings` (Profile, Notifications, Password) and `/account/directory` (phone/address/birthday/household/interests + per-field visibility + the "List me" opt-in) are both "manage my own profile," yet `src/views/account/settings.ejs` does not link to the directory editor at all — it is reachable only from the public `/directory` browse (`src/views/directory/index.ejs:3,9,52`). A member therefore cannot reach their own privacy/visibility settings from their Account, and the editor's on-save redirect to `/directory` (`public/js/directory-listing.js:332`) bounces them out of settings — both artifacts of the editor having been a standalone surface (see origin).

---

## Requirements

Carried from the origin requirements doc (R1–R8). Each is advanced by the units below.

| ID | Requirement | Unit |
|----|-------------|------|
| R1 | Directory editor becomes a fourth section on `/account/settings`; standalone view removed | U1, U3 |
| R2 | Section is collapsed by default behind a disclosure; header reflects listed/visibility state | U1 |
| R3 | One scrollable SSR page with a top in-page jump-nav; no tabs | U1 |
| R4 | Editor fields, widgets, validation, and the `PUT /api/account/directory` contract unchanged | U1 |
| R5 | Save stays in `/account/settings` with in-place success (remove the `/directory` redirect) | U2 |
| R6 | `/account/directory` 301-redirects to `/account/settings#directory-listing`; arriving there auto-expands the section | U2, U3 |
| R7 | The three public `/directory` links repoint to the new anchor | U3 |
| R8 | Account Settings gains a path to the section (jump-nav + co-location); intro copy updated | U1 |

**Success criteria** (from origin): a member reaches and edits their listing + privacy entirely from `/account/settings`; saving keeps them there with confirmation; every old `/account/directory` reference still lands correctly (301 → anchor, auto-expanded); the settings page stays scannable (editor collapsed); no regression to the editor or the public browse; the directory test suites are updated for the new location and stay green.

---

## Key Technical Decisions

- **KTD1 — Native `<details>`/`<summary>` for the collapse.** Use a native disclosure, not a JS-toggled button. The toggle needs no script (CSP is strict — no inline handlers), the `<summary>` carries the state line, and the section content (form, household modal, tag-stack) lives in the DOM while collapsed so the existing init JS still wires up. Avoids adding toggle state/ARIA plumbing.
- **KTD2 — Extract the editor into a reusable include; the settings page route loads both data sources.** Move the directory editor markup from `src/views/account/directory-listing.ejs` into a partial (e.g. `src/views/account/partials/directory-listing-section.ejs`) that `account/settings.ejs` includes inside the `<details>`. The `GET /account/settings` page handler (`src/routes/pages.js:70`) must additionally call `MemberDirectoryService.getMyProfile(req.user.id)` and pass `{ settings, profile }` — today it passes only `{ settings }` (`pages.js:72-76`), while `getMyProfile` is loaded by the separate `/account/directory` handler (`pages.js:117`). The partial keeps one source of truth so the standalone view is cleanly deletable.
- **KTD3 — Anchor auto-expand is client-side.** A URL hash (`#directory-listing`) never reaches the server, so the 301 redirect can't tell the server to render the section open. `public/js/directory-listing.js` opens the `<details>` and scrolls to it when `location.hash === '#directory-listing'` on load — covering both the 301 from `/account/directory` and the public `/directory` links.
- **KTD4 — Permanent (301), not 302.** `/account/directory` is referenced by registration's opt-in flow, the R20 activation nudge, bookmarks, and emailed links; a permanent redirect lets search/clients update.
- **KTD5 — Resolve the script global-collision before co-loading.** `src/views/account/settings.ejs:76` already loads `public/js/account-settings.js` (the script that owns the in-place `form-message` success pattern U2 mirrors). Both it and `public/js/directory-listing.js` are classic (non-module) `defer` scripts that declare top-level `const getCsrfToken`, `const requestJson`, `const showMessage` — which share one global lexical scope. Loading both on `/account/settings` would throw a `SyntaxError: Identifier 'getCsrfToken' has already been declared`, and the second script's entire body (the directory editor's init + save handler) would never run, leaving the editor **rendered but inert** (a silent R4 violation). Fix: wrap `public/js/directory-listing.js`'s body in an IIFE so its helpers become file-local — the minimal change (one file; `account-settings.js`'s globals stay global, the directory script's go local, no collision). Verify the page defines each helper exactly once.

---

## Implementation Units

### U1. Merge the directory editor into the Account Settings page

**Goal:** `/account/settings` renders a fourth "Directory Listing & Privacy" section (collapsed `<details>`), with a top jump-nav and updated intro copy; the page route loads the member profile alongside settings.
**Requirements:** R1, R2, R3, R4, R8.
**Dependencies:** none.
**Files:**
- `src/routes/pages.js` — `GET /account/settings` handler (~:70): also `await MemberDirectoryService.getMyProfile(req.user.id)`; pass `viewData: { settings, profile }`. (Import `MemberDirectoryService` if not already in scope in this file — it is used by the `/account/directory` handler below.)
- `src/views/account/partials/directory-listing-section.ejs` — **new**; the editor markup moved verbatim from `src/views/account/directory-listing.ejs` (form `#directoryForm`, fields, household modal, interests tag-stack, birthday selects, the "List me" opt-in, the `visibility-fieldset`). No field/markup changes (R4).
- `src/views/account/settings.ejs` — add `id` attributes to the three existing sections; add a top jump-nav (anchor links: Profile · Notifications · Directory Listing · Password); add a fourth `<details class="settings-section" id="directory-listing">` whose `<summary>` shows the listing state, including the partial; update the intro subtitle (`:3`) to mention directory/privacy; add the `/js/directory-listing.js` (defer) include alongside the existing `/js/account-settings.js` (already at `:76`).
- `public/js/directory-listing.js` — wrap its body in an IIFE per KTD5 (prevents the `const` collision with `account-settings.js`). (This file is also edited in U2; the IIFE wrap and the U2 changes land together.)
- `public/js/account-settings.js` — **reference only** (no change): it is the existing settings script `settings.ejs:76` loads, owns the in-place `form-message` success pattern U2 mirrors, and is the other half of the KTD5 collision. Read it; do not modify it.
**Approach:** `settings.ejs` and `directory-listing.ejs` already share `container.account-settings` + `section.settings-section` on `public/css/account.css`, so the editor drops in as a fourth section (KTD2). Wrap it in a native `<details>` (KTD1); the directory section sits after Notifications, before Password. Note the visibility fieldset already carries `class="settings-section"`, so after the move it nests inside the fourth `<details class="settings-section">` — verify the nested padding/border looks right in U4. The `<summary>` renders one of two states (`getMyProfile` always returns a defaulted object — `listed:false`, empty fields — for a member with no profile row yet, never `null`, so there is no null case): **not listed** → "Directory Listing & Privacy — not listed"; **listed** → "Directory Listing & Privacy — listed (shows phone, birthday…)" from `profile.listed` and the `show_*` flags.
**Patterns to follow:** the three `section.settings-section` blocks in `src/views/account/settings.ejs:7-73`; the editor markup in `src/views/account/directory-listing.ejs`; the household-editor / tag-stack / visibility-toggle init in `public/js/directory-listing.js` (gated on `#directoryForm`, so it self-initializes wherever the form renders).
**Test scenarios:**
- `GET /account/settings` (authed) returns 200 and the page contains the directory editor — assert `id="directoryForm"`, `name="listed"`, `name="household_consent"`, and the `/js/directory-listing.js` include are present (move these assertions from the old `/account/directory` view test).
- The directory section renders collapsed by default — the `<details id="directory-listing">` has no `open` attribute.
- The page renders the other three sections (Profile, Notifications, Password) and the jump-nav with a `#directory-listing` anchor.
- The page route loads the member profile (the rendered section reflects `profile` values, e.g. a seeded listed profile shows "Listed" in the summary).
- `__tests__/views/directoryListingHousehold.test.js` is repointed to render the merged settings view / partial and its household-escaping + markup assertions still pass.

### U2. Save in place + auto-expand on the anchor (client JS)

**Goal:** Saving the listing keeps the member on `/account/settings`; arriving at `#directory-listing` opens and scrolls to the section.
**Requirements:** R5, R6.
**Dependencies:** U1.
**Files:** `public/js/directory-listing.js`.
**Approach:** Three behaviors, all client-side (the `#` hash never reaches the server — KTD3):
1. **Save in place (R5).** Replace the on-success redirect to `/directory` (`:332`) with an in-place success message, mirroring the Profile/Notifications/Password forms in `account-settings.js`. After a successful save, keep the section **open** and update the `<summary>` state line client-side from the submitted values (same pattern as the form already updating `data-initial-listed` on success) so the collapsed header isn't stale until a reload. Keep the CSRF-Token header and the `PUT /api/account/directory` call unchanged (R4).
2. **Auto-expand on arrival (R6).** A helper `expandDirectorySection()` sets the `<details>` `open`, scrolls it into view, and moves focus into the section (the `<details>` element via `tabindex="-1"` + `focus()`, so a screen reader lands inside it rather than at `document.body`). Call it on `DOMContentLoaded` when `location.hash === '#directory-listing'` — covers the 301 from `/account/directory` and the public `/directory` links.
3. **Auto-expand on the in-page jump-nav (R3).** Clicking the "Directory Listing" jump-nav link does NOT re-fire `DOMContentLoaded`, so a plain anchor would scroll to a still-collapsed section showing nothing. Also call `expandDirectorySection()` from a click handler on that jump-nav link (and/or a `hashchange` listener).
**Patterns to follow:** the in-place `form-message` success pattern in `public/js/account-settings.js` (~:74/:85/:108); the existing `getCsrfToken` / `requestJson` helpers in `directory-listing.js` (now IIFE-scoped per KTD5).
**Test scenarios:** `Test expectation: browser-verified` for the interaction behaviors (the redirect, auto-expand, focus, and summary update are client-side and invisible to supertest; the PUT already returns JSON, so the existing `directoryAccountRoutes` PUT assertions are unaffected and must NOT be changed to expect a 302). Verify in the running app: (a) saving stays on `/account/settings`, shows the success message, keeps the section open, and updates the summary; (b) arriving via the 301 (and visiting `/account/settings#directory-listing`) opens + scrolls to the section and lands focus inside it; (c) clicking the "Directory Listing" jump-nav link opens the collapsed section, not just scrolls to it.

### U3. Redirect the old route and repoint the public entry points

**Goal:** `/account/directory` permanently redirects into the consolidated section, the public `/directory` links target the new anchor, and the standalone view is removed.
**Requirements:** R1, R6, R7.
**Dependencies:** U1.
**Files:**
- `src/routes/pages.js` — replace the `GET /account/directory` render handler (~:115-132) with `res.redirect(301, '/account/settings#directory-listing')` (drop the `getMyProfile` + `bodyView: 'account/directory-listing'` render).
- `src/views/directory/index.ejs` — the three links (`:3` "Manage your own listing", `:9` "Add my listing", `:52` "Be the first to add your listing") point to `/account/settings#directory-listing`.
- `src/views/account/directory-listing.ejs` — **delete** (its markup now lives in the U1 partial). Confirm no other reference to `bodyView: 'account/directory-listing'` remains.
**Approach:** A permanent redirect (KTD4) preserves registration opt-in, the R20 nudge, bookmarks, and emailed links — all of which point at `/account/directory`. The public `/directory` browse itself is otherwise untouched (out of scope).
**Test scenarios:**
- `GET /account/directory` (authed) returns 301 with `Location: /account/settings#directory-listing` — add this to `__tests__/integration/directoryAccountRoutes.test.js` (replacing any assertion that it rendered the standalone listing page).
- The public `/directory` page renders the three entry-point links pointing at `/account/settings#directory-listing` (update `__tests__/integration/directoryRoutes.test.js` if it asserts the old target).
- Grep confirms no remaining reference to the deleted `account/directory-listing` view.

### U4. Verification pass — regression + accessibility

**Goal:** Confirm no regression to the editor, the public browse, or a11y after the move.
**Requirements:** R1–R8 (verification of the success criteria).
**Dependencies:** U1, U2, U3.
**Files:**
- `__tests__/views/directoryListing.accessibility.test.js` — **must be repointed.** It currently does `request(app).get('/account/directory')`, asserts `200`, and runs axe on the body; after U3's 301 + view deletion it would get a 301 with no body and fail. Repoint it to render `GET /account/settings` (or fold its assertions into a new account-settings a11y test).
- `__tests__/views/directory.accessibility.test.js` — **confirm untouched** (it covers the *public* `/directory` browse of other members, which this change does not modify — do not confuse it with the file above).
- manual browser pass.
**Approach:** Re-run the directory + account suites and the a11y suite; spot-check the merged page in the running app.
**Test scenarios:**
- `npm test` for the directory/account suites is green (`directoryAccountRoutes`, `directoryListingHousehold`, `directoryRoutes`, `directoryListing.accessibility`, plus any account-settings view test).
- a11y (`npm run test:a11y`) green for the merged settings view: the `<details>`/`<summary>` is keyboard-operable, the jump-nav links resolve, and the section has an accessible name.
- Browser pass: collapsed by default; the jump-nav link opens it; expand → household modal (open/close/Escape — see Risks), tag-stack, birthday selects, and the visibility-fieldset-disabled-until-listed behavior all still work; save stays in place + keeps the section open + updates the summary; the 301 and the public links land on the auto-expanded section with focus inside it.

---

## Scope Boundaries

**In scope:** relocating the editor into a collapsed section; the jump-nav; intro-copy update; save-in-place + anchor auto-expand; the 301 redirect; repointed public links; the test relocations.

**Out of scope (origin):** co-locating name/email with their per-field visibility toggles (tangles `/api/account/profile` and `/api/account/directory`); any change to the editor's fields, validation, or save contract; any change to the public `/directory` browse of other members or its data; reordering fields within the editor.

### Deferred to Follow-Up Work
- None for this change. (The name/email co-location above is an origin non-goal, not deferred sequencing.)

---

## Risks & Dependencies

- **Broken deep links if the 301 is missed.** Registration opt-in, the R20 nudge, and emailed links point at `/account/directory`; U3's redirect is load-bearing. Mitigation: the redirect test in U3.
- **`getMyProfile` failure now affects the whole settings page.** Folding the profile load into `GET /account/settings` means a `getMyProfile` *throw* (it never returns null — it returns a fully-defaulted object for a member with no profile row, or throws "User not found") would 500 the whole settings page, where today it only 500s `/account/directory`. Decision: catch it in the handler, pass a defaulted/empty `profile`, and render the section with a small "couldn't load your listing — try refreshing" notice rather than failing Profile/Notifications/Password too. The defaulted-object behavior means the partial's `profile.*` reads are otherwise nil-safe.
- **Household modal accessibility (pre-existing, now on a busier surface).** The modal is `position: fixed; inset: 0; z-index: 1000`, so it is NOT clipped by the `<details>` — but it has no Escape handler and no focus trap (Tab escapes into the settings page behind it). This is a pre-existing gap that becomes more visible once the editor sits among other settings forms. Add an Escape-to-close and a focus trap to `createHouseholdEditor()` as part of U4, and name them as a11y pass criteria. (Keep this scoped — it's a small addition, not a modal rebuild.)

---

## Open Questions (resolve during implementation)

- **Collapsed-summary copy** — exact wording/detail of the two `<summary>` state lines specified in U1, and whether the *not-listed* state should carry a discoverability hint (e.g. "Directory Listing & Privacy — not listed (tap to manage)") so a first-time, opt-in-default member doesn't overlook the section. Copy decision; default to including a brief manage hint.
- **Partial vs inline** — KTD2 prefers a partial include; if the team prefers inlining the markup directly into `settings.ejs`, the outcome is identical — the standalone view is still deleted.

---

## Sources & Research

- Origin requirements: `docs/brainstorms/2026-06-16-directory-account-consolidation-requirements.md`
- Upstream ideation: `docs/ideation/2026-06-16-ia-split-surface-consolidation-ideation.html` (idea #2–#4)
- Verified repo wiring: `src/routes/pages.js:70` (settings page), `:115` (directory page); `src/controllers/userController.js:139` (`getDirectoryListing` → `getMyProfile`); `src/views/account/settings.ejs:7-73`; `public/js/directory-listing.js:332`; `src/views/directory/index.ejs:3,9,52`.
- Constraints (AGENTS.md): no bundler/framework, no inline `<script>`/`<style>` (strict CSP), CSRF global (the editor's `CSRF-Token` header pattern is unchanged), services own SQL.
