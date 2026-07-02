---
title: "Donation Form as One Coherent, Accessible Money Page - Plan"
type: feat
date: 2026-07-02
topic: donation-form-accessible-money-page
execution: code
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# Donation Form as One Coherent, Accessible Money Page - Plan

## Goal Capsule

Objective: Rebuild the donation entry form (`src/views/donations/index.ejs`) into one coherent, WCAG 2.1 AA input system built on the I15 component kit — unifying the styled amount pills and raw native fields into a single treatment, giving the required receipt-email field real visual weight with a required marker, and fixing the ~130px native boxes on mobile — without changing donation behavior or server logic.

Product authority: `docs/ideation/2026-07-01-full-project-review-ideation.html:428` (idea I10), with the component-kit contract at `docs/ideation/2026-07-01-full-project-review-ideation.html:480` (idea I15).

Open blockers: I1 (provider-authoritative capture path) touches the same donation controller/area and should land first (see Dependencies). One decision must resolve before planning: where the shared input primitive lives, since the kit ships no input component (see Outstanding Questions).

## Product Contract

### Summary

Convert the donation form from two clashing design languages (styled `.amount-level` pills beside browser-default `number`/`email`/`datalist` fields) into one input system that reuses the site's existing `.form-group` / `.form-control` / `.required` convention — the same one `src/views/contact.ejs` and `src/views/register.ejs` use — plus the I15 kit's button and page-header partials for chrome. The only required field, receipt email, gains a red required marker with matching visual weight; native inputs fill the column on mobile instead of collapsing; and keyboard focus and pill-selected states become visible. Scope is the entry form only; the checkout outcome step and all server logic are out of scope.

### Problem Frame

The kit (I15, on `dev`) supplies chrome primitives — `.c-btn` variants, `.page-header`, `.empty-state`, and a control reset scoped only to `.c-btn` (`public/css/components.css:16`) — but it deliberately ships no input/field primitive, and the global reset is intentionally not applied to bare elements. There is no site-wide `.form-control`; it is defined per page and scoped (e.g. `.contact-form .form-control` at `public/css/contact.css:151`). So "one styled input system using the kit" is a composition task: kit partials for actions and header, plus a field treatment reusing the existing shared form convention rather than inventing a fourth bespoke style (the failure mode I15 warns against at `docs/ideation/2026-07-01-full-project-review-ideation.html:433`).

### Key Decisions

Reuse the existing `.form-group` / `.form-control` / `.required` convention (as in contact/register) for the donation fields, styled in `public/css/donations.css`, instead of adding a new donation-only class set or a global input reset. This is the least-surface way to make the money page read as one system while matching the required-marker target the brief names.

Render actions through the kit button partial (`src/views/partials/button.ejs`) with the primary (gold) variant and the title through the page-header partial (`src/views/partials/page-header.ejs`), retiring the local `.btn-primary` and raw `<h1>` in the entry form. This intentionally changes the Donate button from navy (`public/css/donations.css:75`) to navy-on-gold — the I15 primary=gold contract.

Scope I10 to the donation entry form (`index.ejs`) only. The checkout outcome buttons carry `name="outcome" value="…"` (`src/views/donations/checkout.ejs:15`), which the button partial does not support (`src/views/partials/button.ejs:17`), and that step overlaps I1's capture-path rework.

### Requirements

One styled input system:

R1. All donor-facing controls on the entry form — the amount pills, the custom-amount number field, the frequency radios, the designation combobox, and the receipt-email field — render in a single visual system rather than today's mix of styled pills beside raw browser-default fields (`src/views/donations/index.ejs:13`, `src/views/donations/index.ejs:20`, `src/views/donations/index.ejs:35`, `src/views/donations/index.ejs:53`).

R2. The unified field treatment reuses the site's existing shared form convention — the `.form-group` wrapper, the `.form-control` input class, and the `.required` marker used by `src/views/contact.ejs:58` and `src/views/register.ejs:18` — rather than introducing a new donation-only class set.

R3. The `.form-control` styling for the donation fields is supplied in `public/css/donations.css`, because the kit ships no input primitive (`public/css/components.css:16`) and no global `.form-control` exists, so all donation fields share one border, height, and focus treatment.

R4. The Donate submit renders through the kit button partial with the primary variant, retiring the local `.btn-primary` rule in `public/css/donations.css:75`.

R5. The page title and subtitle render through the kit page-header partial, replacing the raw `<h1>` and `.subtitle` at `src/views/donations/index.ejs:2`.

Required email field:

R6. The receipt-email field shows a visible required marker — a red asterisk matching contact's `<span class="required">*</span>` (`src/views/contact.ejs:63`) — giving the only required field visual weight equal to a labeled required field elsewhere on the site.

R7. The field also carries a programmatic required signal (`aria-required` and the native `required` attribute already toggled in `public/js/donations.js:30`) so the requirement is exposed to assistive tech, not only visually.

R8. The visible marker and `aria-required` appear only when the email is actually required, toggling in lockstep with the existing anonymous behavior — when "Give anonymously" is checked the email row is hidden and `required` cleared (`public/js/donations.js:27`) — so the marker never claims a hidden field is required.

Mobile and native-control sizing:

R9. The custom-amount and email inputs fill the form column width on mobile instead of collapsing to the ~130px native default, so no field is unusably narrow at a 360px viewport; today `.form-row` has no input width rule (`public/css/donations.css:41`).

R10. The designation combobox is wide enough that its "Choose a fund or type your own" placeholder (`src/views/donations/index.ejs:36`) is not truncated on a typical mobile width.

WCAG 2.1 AA:

R11. Every interactive control — amount pills, frequency and amount radios, text/number/email inputs, and the submit — shows a visible keyboard focus indicator using the site focus tokens `--focus-outline` / `--focus-offset` (`public/css/main.css:52`).

R12. The selected amount pill has a visible selected state beyond the native radio dot; `.amount-level` currently has no checked or focus styling (`public/css/donations.css:26`), leaving keyboard users unable to see focus or selection.

R13. All controls keep their programmatic labels and grouping (the existing `for`/`id` pairs and `<legend>`s at `src/views/donations/index.ejs:10`) and meet a 44px minimum touch target, consistent with the kit's `min-height: 44px` (`public/css/components.css:37`).

R14. No color is introduced beyond the `main.css` token set; the required-asterisk red resolves the Outstanding-Questions decision (`--color-danger` at `public/css/main.css:28` or contact's established required red), and all text and controls meet AA contrast.

Constraints and preserved behavior:

R15. No inline `<style>` or `<script>`; all CSS stays in `public/css/donations.css` / `public/css/components.css` and all JS in `public/js/donations.js`, honoring the strict CSP; no framework and no build step are added.

R16. The existing CSRF hidden `_csrf` input (`src/views/donations/index.ejs:6`), the hidden `amount_cents` field (`src/views/donations/index.ejs:22`), the anonymous toggle, and the client-side validation flow (`public/js/donations.js:55`) continue to work unchanged after the markup restructure.

### Acceptance Examples

AE1. Covers R8, R6, R7: With "Give anonymously" unchecked, the email row is visible, its label shows the red `*`, and the input reports `aria-required="true"`; checking "Give anonymously" hides the email row, and the marker is neither shown nor announced and the field is not required.

AE2. Covers R9: At a 360px viewport the custom-amount and email inputs span the full form column rather than rendering as ~130px boxes.

AE3. Covers R11, R12: Tabbing to an amount pill shows a visible focus ring, and selecting it renders a distinct selected-pill style separate from the native radio dot.

AE4. Covers R16, R6: Submitting with "Give anonymously" unchecked and the email left blank triggers the existing client validation (`public/js/donations.js:71`) — the submit is blocked and the email field focused — with the required marker present the whole time.

### Scope Boundaries

In scope: `src/views/donations/index.ejs` (the entry form), its rules in `public/css/donations.css`, the required-marker label toggle in `public/js/donations.js`, and use of the kit button and page-header partials.

Out of scope: `src/views/donations/checkout.ejs` outcome buttons (they need `name`/`value` the button partial does not support and belong to I1's capture-path area), the admin donations dashboard (`src/views/admin/donations.ejs`), the `donations/failed.ejs` and `thank-you.ejs` templates, and all server-side controller/validation/provider logic.

### Dependencies / Assumptions

Sequence: I1 (`docs/ideation/2026-07-01-full-project-review-ideation.html`, idea I1) rebuilds the provider-authoritative capture path in the same donation controller/area and should land first; I10 layers UI on top of the settled controller and checkout flow to avoid churn on shared files.

Depends on the I15 kit already present on `dev`: the button, page-header, and empty-state partials under `src/views/partials/`, `public/css/components.css` loaded globally via `src/views/layout.ejs:73`, and the color and focus tokens in `public/css/main.css:16` — all verified present.

Assumes the shared `.form-group` / `.form-control` / `.required` convention is the intended "one input system"; the kit itself ships no input primitive, and `.form-control` is defined only per page and scoped.

### Outstanding Questions

Resolve before planning:

Q1. Where does the input primitive live — reuse the existing `.form-control` / `.required` convention page-scoped in `public/css/donations.css` (matching contact), or promote a shared field style into `public/css/components.css`? The kit currently has none.

Q2. Which red does the required asterisk use — the kit token `--color-danger` (`public/css/main.css:28`, #b3261e) or contact's established `.contact-form .required` red (`public/css/contact.css:145`, #d32f2f)? I15's action-color contract reserves red for destructive actions "never decoration" (`docs/ideation/2026-07-01-full-project-review-ideation.html:480`), so confirm a required marker is an allowed non-action use of red.

Deferred:

Q3. Should `checkout.ejs`'s outcome buttons later migrate to the kit (requiring `name`/`value` support in the button partial), or remain owned by I1?

### Sources / Research

- `docs/ideation/2026-07-01-full-project-review-ideation.html:428` — idea I10 description, evidence, and the "do it with I15, not one-off CSS" downside.
- `docs/ideation/2026-07-01-full-project-review-ideation.html:480` — idea I15 action-color contract (primary=gold, navigational=navy, destructive=red).
- `src/views/donations/index.ejs:13` — amount pills; `:20` — raw native custom-amount; `:35` — designation datalist combobox; `:51` — email row with no required marker.
- `public/css/donations.css:26` — `.amount-level` has no focus/checked state; `:41` — `.form-row` has no input width; `:75` — local `.btn-primary` (navy).
- `public/css/components.css:16` — control reset scoped to `.c-btn`, no input primitive; `:26` — `.c-btn` variants; `:65` — page-header/empty-state.
- `src/views/partials/button.ejs:17` — variant contract; no `name`/`value` support.
- `src/views/partials/page-header.ejs:13` — shared title bar partial.
- `src/views/contact.ejs:58` — canonical `<span class="required">*</span>` pattern; `public/css/contact.css:145` — `.contact-form .required { color: #d32f2f }` (scoped, hardcoded).
- `src/views/register.ejs:18` — email marked required (inline `*` + `aria-required`).
- `public/js/donations.js:27` — anonymous toggle hides email row and clears `required`; `:55` — client-side validation preserved.
- `public/css/main.css:16` — tokens: `--color-primary` navy, `--color-gold`, `--color-danger` #b3261e; `:52` — `--focus-outline` / `--focus-offset`.
- `src/views/layout.ejs:73` — `components.css` loaded globally; `src/controllers/donationController.js:22` — `donations.css` page-scoped.
