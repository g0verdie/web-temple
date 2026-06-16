# Requirements: Consolidate the member's directory listing into Account Settings

**Date:** 2026-06-16
**Scope:** Standard (single-page IA consolidation; no data-model change)
**Origin:** Seeded from `docs/ideation/2026-06-16-ia-split-surface-consolidation-ideation.html` (idea #2–#4).

## Problem

A member's own configuration is split across two pages. `/account/settings` ("Account Settings") holds Profile, Notification Preferences, and Change Password. `/account/directory` ("My Directory Listing") holds phone, address, birthday, household, interests, the per-field visibility flags, and the "List me in the member directory" opt-in. Both are "manage my own profile," yet `src/views/account/settings.ejs` has **no link to the directory editor** — it is reachable only from the public `/directory` browse (`src/views/directory/index.ejs:3,9,52`). A member therefore cannot reach their own privacy/visibility settings from their Account page. The save compounds the split: on success the editor redirects to the public `/directory` (`public/js/directory-listing.js:332`), an artifact of the editor having been a standalone surface.

The public `/directory` (browsing *other* members) is a genuinely separate concern and is out of scope.

## Goal

Make `/account/settings` the single surface for everything a member configures about themselves, including their directory listing and privacy, while leaving the public directory browse untouched — answering "there is no reason to split this between two pages" at the lowest risk.

## Requirements

- **R1 — Relocate the editor as a fourth section.** The directory-listing editor moves into `/account/settings` as a fourth section, "Directory Listing & Privacy." The standalone `/account/directory` page (`src/views/account/directory-listing.ejs`) is removed as a destination view.
- **R2 — Collapsed by default.** The section renders collapsed behind a disclosure ("Manage your directory listing & privacy"). The collapsed header reflects current state at a glance (listed vs not listed, and which details are shown). Expanding reveals the full editor in place. Rationale: the editor is far heavier than the three small settings forms, so a collapsed default keeps the page scannable.
- **R3 — One SSR page, jump-nav, no tabs.** The page stays a single scrollable server-rendered page with a top in-page jump-nav (Profile · Notifications · Directory Listing · Password). No tabs or per-tab sub-routes — this preserves the no-bundler / no-framework / no-inline-script constraints.
- **R4 — Editor behavior unchanged.** All current fields, widgets, validation, and the save contract are preserved verbatim: phone, address, birthday (month/day/optional-year), household (modal editor), interests (tag-stack), the per-field visibility flags, the household-consent acknowledgement, and the "List me" opt-in (opt-in ordered before the visibility fieldset; visibility disabled until listed). The save remains the existing `PUT /api/account/directory` JSON API. No field, validation, or API change.
- **R5 — Save stays in Account.** On a successful save the member stays on `/account/settings` with an in-place success message and the section in view, matching how the Profile / Notifications / Password forms behave — replacing the redirect to `/directory`.
- **R6 — Preserve old deep links.** `/account/directory` issues a permanent (301) redirect to `/account/settings#directory-listing`, so registration's directory opt-in flow, the R20 activation nudge, bookmarks, and any emailed links keep working. Arriving via that anchor scrolls to and auto-expands the section.
- **R7 — Repoint the public entry points.** The three `/directory` links — "Manage your own listing," "Add my listing," "Be the first to add your listing" (`src/views/directory/index.ejs:3,9,52`) — point to `/account/settings#directory-listing`. The legitimate "browse others → add myself" path is preserved; it now lands inside Account.
- **R8 — Make Account aware of it.** The Account Settings intro copy (`src/views/account/settings.ejs:3`, currently "Manage your profile, notifications, and password") is updated to include directory/privacy, and the jump-nav surfaces the section.

## Scope boundaries

**In scope:** relocating the editor; the collapsed disclosure UI + state-summary header; the jump-nav; the save-in-place behavior; the 301 redirect + repointed public links; the intro-copy update.

**Out of scope (deferred):**
- Co-locating name/email with their per-field visibility toggles — it tangles two distinct save APIs (`/api/account/profile` vs `/api/account/directory`) and is a deeper redesign.
- Any change to the directory editor's fields, validation, or save contract.
- Reordering fields within the editor beyond what already ships.

**Not touched:** the public `/directory` browse of other members and its data; `/api/account/profile`; the registration opt-in and R20 nudge logic (only their link targets, via R6).

## Success criteria

- A member can reach and edit their directory listing + privacy entirely from `/account/settings`, without going through the public browse.
- Saving the listing keeps the member on the settings page with a visible confirmation (no bounce to `/directory`).
- Every old `/account/directory` reference (registration, nudge, bookmark, email) still lands correctly via the 301 → anchor and the section auto-expands.
- The settings page stays scannable: the heavy editor is collapsed by default.
- No regression to the directory editor's behavior or to the public directory browse.
- The directory account-route and view tests (`__tests__/integration/directoryAccountRoutes.test.js`, `__tests__/views/directoryListingHousehold.test.js`) are updated for the new location and stay green; a redirect test for `/account/directory` → `/account/settings#directory-listing` is added.

## Outstanding questions

- **Collapsed-header summary copy** — how much state to surface ("Listed · phone, email shown" vs a simpler "Listed / Not listed"). Resolve during implementation.
- **Section order** — default is Directory Listing after Notifications, before Password; confirm if a different order is wanted.

## Dependencies / notes

- Honors the project's hard constraints: no bundler/framework, no inline `<script>`/`<style>` (strict CSP), CSRF global (the editor's existing `CSRF-Token` header pattern is unchanged), services own SQL.
- The editor's client script (`public/js/directory-listing.js`) moves with the section; a disclosure toggle is added; the save-success change is the redirect at `directory-listing.js:332`. The household modal dialog must continue to work once the section is expanded.
- The directory-listing markup is already `container.account-settings > section.settings-section` on the same `public/css/account.css` as the three existing sections, so it is structurally isomorphic to a fourth section — the relocation is markup-move + disclosure wrapper, not a rebuild.
