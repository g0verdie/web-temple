---
title: Shared EJS Component Kit with Action-Color Contract - Plan
type: feat
date: 2026-07-02
topic: shared-ejs-component-kit-action-color-contract
execution: code
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# Shared EJS Component Kit with Action-Color Contract - Plan

## Goal Capsule

Objective: introduce a small shared EJS partial kit (page-header, button, empty-state) plus supporting CSS so interactive chrome stops being hand-rolled per view, and make action color a fixed, class-enforced contract (primary=gold, navigational=navy, destructive=red).

Product authority: idea I15 "Shared EJS component kit with a traffic-signal action-color contract" in `docs/ideation/2026-07-01-full-project-review-ideation.html:476`.

Open blockers: none. The kit sits under later I10 (donation form) and I4 (mobile calendar) work but does not depend on either.

## Product Contract

### Summary

The site has no shared component layer, so headers, buttons, links, and empty states are re-invented per view and primary color has no rule. Build three partials and a native-control reset, bind a three-value action-color contract to CSS tokens so red means danger and nothing else, and convert the worst offenders (admin directory row actions with a real danger treatment for a destructive action, and the directory empty states). A full call-site sweep is explicitly out of scope.

### Problem Frame

Verification against the code confirms the symptoms are one missing abstraction, not five bugs:

- Only one partial exists site-wide (`src/views/partials/initials-avatar.ejs`), a lone `<span>`; there is no header, button, or empty-state partial.
- Four bespoke header/hero treatments live in four stylesheets: `.hero` (`src/views/home.ejs:2`), `.about-hero` (`src/views/about.ejs:3`), `.contact-hero` (`src/views/contact.ejs:3`), `.calendar-page-header` (`src/views/calendar/index.ejs:7`).
- The "primary" CTA flips color with no rule: `.cta-button` is gold-on-navy (`public/css/main.css:544`) while admin `.btn-primary` is navy-on-white (`public/css/admin.css:94`), and `.btn-primary` is independently redefined again in `public/css/streaming.css:25`, `public/css/account.css:49`, and `public/css/auth.css:104`.
- Admin row actions render as raw native buttons: `src/views/admin/directory.ejs:9` (Search) and `:46` (Apply, a destructive moderation submit) are bare `<button type="submit">` with no class, and there is no global button reset in `public/css/main.css`.
- Danger is not a contract: `.btn-danger` is a hardcoded `#b3261e` in `public/css/admin.css:110` (duplicated in `public/css/streaming.css:72`), there is no `--color-danger` token in `:root` (`public/css/main.css:14`), and the whole `.btn*` taxonomy is admin-route-only by design (`public/css/admin.css:1`).
- Links fall back to UA blue: `public/css/main.css` has no global `a{}` color rule (links are styled only per-context), and `.btn-link` is defined only in `public/css/donations.css:111`, so the admin directory's `.btn-link` Export/Edit links (`src/views/admin/directory.ejs:15`, `:16`, `:36`) render as default blue underlined links on admin routes.
- Empty states are duplicated inline, not shared: `src/views/directory/index.ejs:48-53` and `src/views/admin/directory.ejs:57` each hand-roll different empty copy; there is no empty-state partial.

### Key Decisions

The action-color contract is exactly three values, each a semantic name bound to a token, and red is reachable only through the destructive path so a Delete can never render as an unstyled grey box and a decoration can never render red. The kit must be visually consistent with the just-merged I9 two-tier chrome (commit `76268dd`): primary reuses the gold of the `.chrome-give` Give button (`src/views/layout.ejs:159`) and navigational reuses the navy nav.

### Requirements

**Shared partials**

R1. Provide a page-header partial with one variant system that the converted call sites use in place of a bespoke per-page header class.

R2. Provide a button partial whose only semantic variants are primary, navigational, and destructive.

R3. Apply the same variant taxonomy to both form-submit buttons and link actions, so a navigational link and a navigational button read identically and no action falls back to browser defaults.

R4. Provide an empty-state partial that accepts message text (and an optional action) for "no results / nothing here yet" states.

**Action-color contract**

R5. Establish a fixed three-way action-color contract enforced by class: primary=gold, navigational=navy, destructive=red.

R6. Add a `--color-danger` token (and its hover value) to the shared `:root`, and make the destructive variant the only class that emits red so red never appears as decoration.

R7. Map primary to the same gold as the I9 Give button and navigational to the navy nav, so the kit matches the existing two-tier chrome rather than adding a fourth CTA style.

**Native-control reset and CSP**

R8. Add a CSS reset for native form controls so an unclassed `<button>` or submit input never renders OS-default browser chrome.

R9. Ship all kit styling as CSS under `public/`, loaded globally so it reaches admin, public, and footer contexts (closing the admin-only `.btn*` and undefined-`.btn-link` gaps); no inline `<style>`.

R10. Use server-rendered EJS partials only, with no inline `<script>`/`<style>`, no framework, no bundler, and no TypeScript.

**Bounded call-site conversions**

R11. Convert the admin directory-view row actions to the button partial, rendering the destructive moderation action in the destructive variant and the search/navigational actions in their variants.

R12. Convert the admin directory `.btn-link` Export/Edit links to the navigational variant so they no longer render as UA-default blue underlined links.

R13. Convert at least one genuine admin Delete row action (e.g. `src/views/admin/announcements/list.ejs:30` or `src/views/admin/calendar/list.ejs:48`) to the destructive variant so the danger treatment is token-backed, not the hardcoded `admin.css` hex.

R14. Convert the directory empty states in `src/views/directory/index.ejs` and `src/views/admin/directory.ejs` to the empty-state partial, replacing the hand-rolled inline paragraphs.

### Acceptance Examples

AE1. Given the button partial invoked with variant=destructive, the rendered control carries the destructive class and its red comes from `--color-danger`; no non-destructive variant emits red. Covers R2, R5, R6.

AE2. Given the directory query returns zero listed members, the page renders the empty-state partial rather than a bespoke inline `<p class="directory-empty">`. Covers R4, R14.

AE3. Given the admin directory Apply and Search buttons routed through the kit, no control renders as an OS-default grey box even before any page-scoped stylesheet loads. Covers R8, R11.

AE4. Given the admin directory Export CSV link routed through the navigational variant, it renders in navy, not UA-default blue underline. Covers R3, R12.

### Success Criteria

A destructive action can never render as an unstyled native grey box, and its red always traces to `--color-danger`. At the converted sites, the previously divergent header/button/link/empty treatments resolve through the shared partials and the three-value color contract.

### Scope Boundaries

Out of scope: a full sweep of every button, link, header, and empty-state call site across the app (only the named admin-directory and directory sites plus one real Delete are converted here). Out of scope: any visual redesign of the I9 chrome, nav, or footer — the kit must match them, not change them. Out of scope: delivering the I10 donation form or I4 mobile calendar — this is their substrate, not their delivery. Out of scope: new colors beyond the three-value contract, a theming system, and any JavaScript behavior change.

### Dependencies / Assumptions

Assumes the I9 two-tier chrome (commit `76268dd`) is the visual baseline and that primary=gold and navigational=navy are read from it. Assumes strict CSP with no inline script/style and assets served from `public/`. Assumes the existing `:root` tokens in `public/css/main.css` (navy `--color-primary`, `--color-gold`) are reused and only `--color-danger` is added. Assumes the kit CSS is loaded globally (`src/views/layout.ejs:71` links `main.css` on every page), so the kit reaching admin routes requires either extending that global stylesheet or globally linking a new one.

### Outstanding Questions

Resolve Before Planning:
- Which stylesheet hosts the kit CSS — extend `public/css/main.css`, or add a globally linked `public/css/components.css` in `src/views/layout.ejs`? This determines global reach and cascade order against the admin-only `.btn*` rules.
- Does the "one variant system" page-header replace only the page-title headers (about/contact/calendar), or also the marketing home hero (`src/views/home.ejs:2`)? The home hero is richer than a title bar.
- Is the button partial a single partial that renders either `<button>` or `<a>`, or two partials sharing one class contract? Converted call sites need both form-submit and link actions.

Deferred to Planning:
- Exact `--color-danger` hex and hover, reconciling `admin.css` `#b3261e` and `streaming.css`.
- Size (`btn-sm`) and disabled-state surface of the button partial.
- Whether to also add a global `a{}` default to stop UA-blue leak site-wide, or fix it only at the converted call sites (broader link sweep is out of scope).

### Sources / Research

- `docs/ideation/2026-07-01-full-project-review-ideation.html:476` — I15 idea, description, and basis (`evidence-live-ui.md` quotes).
- `src/views/layout.ejs:71` — global `main.css` link; `:159` — `.chrome-give` gold Give button; `:100-162` — I9 two-tier chrome.
- `src/views/partials/initials-avatar.ejs` — the only existing partial (a lone span).
- `src/views/home.ejs:2`, `src/views/about.ejs:3`, `src/views/contact.ejs:3`, `src/views/calendar/index.ejs:7` — four bespoke header/hero treatments.
- `src/views/admin/directory.ejs:9`, `:46` — raw native `<button type="submit">` (Search, destructive Apply); `:15`, `:16`, `:36` — `.btn-link` Export/Edit links; `:57` — inline empty state.
- `src/views/directory/index.ejs:48-53` — hand-rolled inline empty states (no shared partial).
- `src/views/admin/announcements/list.ejs:30`, `src/views/admin/calendar/list.ejs:48` — real Delete row actions via admin-only `.btn-danger`.
- `public/css/main.css:14-46` — `:root` tokens (navy `--color-primary`, `--color-gold`), no `--color-danger`; `:544-549` — `.cta-button` gold-on-navy; no global `button{}` reset and no global `a{}` color rule (verified).
- `public/css/admin.css:1-12` — comment stating the `.btn*` taxonomy is admin-route-only; `:84-114` — `.btn`/`.btn-primary` (navy)/`.btn-danger` (`#b3261e`).
- `public/css/streaming.css:25`, `public/css/account.css:49`, `public/css/auth.css:104` — three more independent `.btn-primary` definitions.
- `public/css/donations.css:111` — `.btn-link` defined only here, so it is undefined on admin routes.
- git commit `76268dd` "feat(nav): replace desktop sidebar with responsive two-tier top nav" — the I9 chrome the kit must match.
