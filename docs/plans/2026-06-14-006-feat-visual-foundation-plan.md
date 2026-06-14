---
date: 2026-06-14
type: feat
origin: docs/brainstorms/2026-06-14-visual-foundation-requirements.md
---

# feat: Modern Reverence visual foundation — type system, gold token, hero logo

## Summary

Establish the public site's visual foundation in one pass: a self-hosted Cormorant Garamond + Inter type system applied globally, a single canonical `--color-gold` token replacing today's drifted and referenced-but-undefined golds, Temple B'nai Israel's tree-of-life logo placed in the homepage hero, and a footer correction to the real Florence, AL identity. All changes are vanilla CSS / EJS / static assets within the strict CSP and the CI-verified accessibility budget. The warm-cream repaint and section rhythm remain a deferred fast-follow.

---

## Problem Frame

The ratified "Modern Reverence" direction (deep navy + warm gold, serif headings) was documented in the UX spec but never built — `main.css` ships a system-sans stack and there is no `public/fonts/`. The gold accent has drifted into four hardcoded values across the stylesheets (`#d69e2e`, `#c9a961`, `#b8860b`, `#f0b849`), and `--color-gold` is referenced in several files but never defined in `:root`, so it silently falls back to `#c9a961`. The header/hero carry no brand mark (the only image asset is `public/favicon.svg`), and the footer hard-codes a wrong location ("Hattiesburg, MS") that contradicts the congregation's actual identity (Temple B'nai Israel, Florence, AL). The result reads as an accidental, institutional template rather than a chosen, warm community identity — which matters for the end-of-July Board MVP.

---

## Requirements

Traceability to origin (`see origin: docs/brainstorms/2026-06-14-visual-foundation-requirements.md`).

**Color tokens**
- R1. A single canonical gold (`--color-gold`) plus `--color-gold-dark` for text/thin-outline uses, defined in the `main.css` `:root`.
- R2. `--color-accent` aliased to `--color-gold` so existing `var(--color-accent)` usages adopt it.
- R3. Hardcoded gold hex removed from the per-page stylesheets in favor of the gold tokens; no raw gold hex remains in shipped CSS.
- R4. A darkened-gold override added to the `prefers-contrast: high` block.

**Typography**
- R5. Serif + sans self-hosted as WOFF2 in `public/fonts/`, declared via external `@font-face` (no CDN, no inline) to satisfy CSP `fontSrc 'self'`.
- R6. `--font-serif` / `--font-sans` tokens defined; serif applied to headings (`h1`–`h4`, including existing class-pinned heading rules), sans to body, site-wide.
- R7. `font-display: swap` + a metric-comparable fallback stack on each `@font-face`.

**Brand logo & identity**
- R11. The existing tree-of-life logo featured in the homepage hero.
- R12. The logo renders crisply at its display size on high-DPI screens.
- R13. The logo stays legible against the hero background with a meaningful `alt`.
- R14. Footer location corrected from "Hattiesburg, MS 39401" to the real Florence, AL address.

**Compliance & quality (cross-cutting — verified per unit)**
- R8. Accessibility budget holds (`npm run test:a11y` passes; AA contrast; 3px gold focus ring + 2px offset; 44px targets; gold-as-text uses clear AA via `--color-gold-dark`).
- R9. CSP view-compliance guard (`__tests__/security/cspViewCompliance.test.js`) stays green; no inline styles/scripts, no third-party CDNs.
- R10. The type system and canonical gold apply globally, including admin views.

---

## Key Technical Decisions

- KTD1. **One gold, aliased — but the focus ring takes the dark variant.** Define `--color-gold` once and point `--color-accent` at it so the CTA button fill (`main.css:238`) adopts it with no edits, ending the undefined-token bug. The focus outline (`main.css:38`) is a *thin outline*, so per KTD5 it must use `--color-gold-dark` (or a dedicated focus token), not the fill — the fill gold is too light to clear 3:1 on white. Re-point `--focus-outline` accordingly. (R1, R2)
- KTD2. **Self-host fonts; never a CDN.** WOFF2 in `public/fonts/`, `@font-face` in external CSS, `font-display: swap` with a metric-similar fallback. Required by CSP `fontSrc 'self'`; the fallback prevents invisible-text and minimizes reflow. (R5, R7)
- KTD3. **Apply the serif via a new global `h1, h2, h3, h4` rule AND a sweep of existing per-class `font-family` overrides.** No element-level heading rule exists today, but several class rules already pin a font (`about.css` `.about-hero__title`, `.prose h2`, `.prose h3` → `Georgia, serif`; `contact.css` heading rules → an undefined `--font-heading` falling back to Georgia). A bare `h1–h4` rule (specificity 0,0,1) loses the cascade to these, so the serif would silently miss the About and Contact heroes — public pages the Board sees. U3 redirects those class rules to `var(--font-serif)`; the blanket rule alone is insufficient. (R6, R10)
- KTD4. **Logo on a light surface in the hero, existing PNG at a constrained size for the MVP.** A light surface keeps the dark wordmark legible on the navy hero without a reversed variant. The 600px-wide source displayed at ≈280px is ~2.1× — crisp on standard Retina — so R12 is met within scope by source-oversampling, not by deferring quality; re-vectorizing to SVG is an optional later improvement, not an unmet requirement. Validate the panel gives ≥3:1 between the dark wordmark and its background and reads distinctly against the navy. (R11, R12, R13)
- KTD5. **Gold-as-text and thin outlines use `--color-gold-dark`; `--color-gold` is for fills and large accents.** A single mid-gold can't clear AA as small text on white, so text/outline uses take the dark variant. Caveat surfaced in review: one dark gold can't satisfy both surfaces — a mid `--color-gold-dark` clears AA on white but is only ~2.7:1 on navy — so gold *text on navy* needs a separate lighter value or must be disallowed, and the focus ring must clear 3:1 on white **and** navy (a compound ring may be needed on dark surfaces). (R4, R8)

---

## Implementation Units

### U1. Color-token foundation in `main.css`

- **Goal:** Establish the single source of truth for the gold accent and the type tokens; govern gold in high-contrast mode.
- **Requirements:** R1, R2, R4; primes R6.
- **Dependencies:** none.
- **Files:** `public/css/main.css`.
- **Approach:** In `:root` (currently lines 14–38), add `--color-gold` and `--color-gold-dark`, and set `--color-accent: var(--color-gold)` so existing accent usages inherit it. Add `--font-serif` and `--font-sans` token declarations (faces wired in U3). In the `@media (prefers-contrast: high)` block (~line 613, which today overrides primary/secondary but not the accent), add a `--color-gold` darkened override. Re-point `--focus-outline` at `--color-gold-dark` (or a dedicated focus token) so the thin ring clears 3:1 — the fill gold is too light on white (KTD5).
- **Patterns to follow:** the existing `:root` custom-property block and the `prefers-contrast: high` overrides already in `main.css`.
- **Test scenarios:** Test expectation: none — pure CSS token definitions, no behavioral change. **Contrast is NOT validated by `npm run test:a11y`** — jest-axe runs under JSDOM with no CSS applied, so its color-contrast rule returns incomplete, never a violation. Verify contrast **manually** (DevTools / a contrast tool) at the visual-review checkpoint: `--color-gold-dark` as text on white (≥4.5:1) and as the focus outline on white **and** navy (≥3:1), and navy text on the `--color-gold` CTA fill (≥4.5:1).
- **Verification:** `--color-gold` is defined and `--color-accent` resolves to it site-wide; the focus ring uses the dark/focus token and clears 3:1 on white and navy (manual check); high-contrast mode darkens the accent; the CSP guard stays green and `npm run test:a11y` stays green for structure/landmarks/alt.

### U2. Sweep hardcoded golds to the token

- **Goal:** Remove every raw gold hex so the canonical token is the only gold.
- **Requirements:** R3; advances R10.
- **Dependencies:** U1.
- **Files:** `public/css/about.css`, `public/css/contact.css`, `public/css/page-editor.css`, `public/css/announcements.css`, `public/css/account.css`.
- **Approach:** Replace the hardcoded values — `#c9a961` (about, page-editor), `#b8860b` (announcements:24), `#f0b849` (account:59), and the `var(--color-gold, #c9a961)` fallbacks (contact, 6 occurrences) — with `var(--color-gold)`, switching to `var(--color-gold-dark)` where the gold is `color`/text or a thin border/outline (AA) and keeping `--color-gold` for fills and large accents. Also catch the **rgba() form of the drifted gold** — `rgba(201, 169, 97, …)` (= `#c9a961`) in `contact.css:99,166` and `page-editor.css:121` (translucent overlays a hex grep misses); express these against the token via `color-mix(in srgb, var(--color-gold) N%, transparent)` or a dedicated `--color-gold-faint`. Decide the token-per-property mapping up front (a short usage table) so it's consistent. `page-editor.css` and `account.css` are admin-side; sweeping them is intended (R10).
- **Patterns to follow:** the now-canonical tokens from U1.
- **Test scenarios:** Test expectation: none — CSS-only. Verify a repo-wide grep for `#c9a961|#b8860b|#f0b849|#d69e2e` **and** `rgba(201, ?169, ?97` in `public/css/` returns no matches outside the `:root` definition. Manually spot-check contrast (DevTools) on the swept admin/non-audited pages (`/admin/pages`, `/account`, plus donations/calendar/directory) since the a11y suite covers only Home/About/Contact.
- **Verification:** no raw gold hex or rgba-gold remains in shipped CSS; gold renders consistently across public and admin pages (manual spot-check); CSP guard + a11y suite green.

### U3. Self-hosted type system

- **Goal:** Ship Cormorant Garamond (headings) + Inter (body), self-hosted, applied globally.
- **Requirements:** R5, R6, R7; advances R9, R10.
- **Dependencies:** U1 (font tokens).
- **Files:** `public/fonts/` (new WOFF2 assets), `public/css/main.css` (`@font-face` blocks; `h1, h2, h3, h4 { font-family: var(--font-serif); }`; body `--font-family`/`--font-sans` → Inter), `public/css/about.css` and `public/css/contact.css` (redirect existing per-class heading `font-family` overrides to `var(--font-serif)`).
- **Approach:** Obtain WOFF2 (Latin subset) via google-webfonts-helper, place in `public/fonts/`, declare `@font-face` with `font-display: swap`. Point `--font-serif` at Cormorant Garamond with a `Georgia, serif` fallback, `--font-sans` at Inter with the existing system-sans stack as fallback. Add the global heading rule **and redirect the existing per-class heading overrides** (`about.css` `.about-hero__title` / `.prose h2` / `.prose h3` set Georgia; `contact.css` heading rules use an undefined `--font-heading`) to `var(--font-serif)`, since their specificity out-ranks the bare `h1–h4` rule. To keep reflow minimal (not just swap), add CSS metric-override descriptors (`size-adjust`, `ascent-override`, `descent-override`, `line-gap-override`) on the fallback tuned to Cormorant (e.g. via fontaine / Font Style Matcher). Keep `body` on the sans token.
- **Patterns to follow:** the per-page-stylesheet + `:root`-token delivery already in `main.css`; assets served from `'self'` like everything in `public/`.
- **Test scenarios:** Test expectation: none for the CSS itself. The CSP guard (`__tests__/security/cspViewCompliance.test.js`) must stay green (no inline styles/CDNs). Manually verify headings render in the serif **on every public page including the About and Contact heroes** (the class-override risk), body in Inter, the fallback shows during load with minimal reflow (spot-check the heading jump / CLS), and `npm run test:a11y` passes.
- **Verification:** fonts load from `/fonts/` (no external requests in DevTools), headings/body show the new faces with graceful fallback, CSP guard + a11y green.

### U4. Logo in the homepage hero

- **Goal:** Feature the Temple B'nai Israel tree-of-life logo in the hero, legibly and crisply.
- **Requirements:** R11, R12, R13; advances R9.
- **Dependencies:** none (independent of the token/font work).
- **Files:** `src/views/home.ejs` (the `.hero` / `.hero-content` block, lines 1–10), `public/css/main.css` (logo + light-panel styles), `public/images/` (new directory + the logo asset).
- **Approach:** Create `public/images/` (it does not exist yet) and copy the logo in; if `/tmp/tbi-logo-extended.png` is gone, re-pull from `https://florencetemple.org/wp-content/uploads/2016/04/Logo-2_6-Extended_with-florence.png` and confirm 600×137 before copying. Add an `<img>` inside `.hero-content` above the headline, class-based (no inline styles), on a contained light panel: near-white surface (e.g. `rgba(255,255,255,0.92)`), ~16px padding, ~8px border-radius, a subtle shadow to separate it from the navy gradient, max-width ≈ logo display width + padding, displayed ≈260–320px wide, collapsing gracefully on mobile. **alt text:** the `.site-title` `h1` already announces "Temple B'nai Israel", so mark the logo decorative (`alt=""`) or describe the emblem (`alt="Temple B'nai Israel — tree of life emblem"`) — do not duplicate the heading text verbatim.
- **Patterns to follow:** the existing hero markup and the external-CSS, CSP-safe asset convention.
- **Test scenarios:** Covers R11, R13. **New test** (nothing today asserts logo presence): `GET /` renders the hero with an `<img>` whose `src` is the logo path and whose `alt` matches the chosen decorative/emblem string. Manually confirm the dark wordmark clears ≥3:1 against the light panel and the panel reads distinctly against the navy hero. CSP guard stays green (no inline style added).
- **Verification:** the homepage hero shows the logo legibly on the navy background at a crisp size; alt text present; CSP guard green.

### U5. Identity sweep — correct "Hattiesburg, MS" → Florence, AL

- **Goal:** Make the displayed location match the real congregation **everywhere it appears**, not just the footer.
- **Requirements:** R14.
- **Dependencies:** none.
- **Files:** `src/views/layout.ejs` (footer `.footer-container` **and** the page `<meta name="description">`, ~line 7), `src/controllers/homeController.js` (hero `mission.statement`, ~line 84), `src/views/contact.ejs` (address block + Google Map embed `src` + map `aria-label`, ~lines 18/23/25).
- **Approach:** Correct every "Hattiesburg, MS" occurrence to the real Florence, AL identity/address: the footer line and the meta-description (`layout.ejs`), the homepage hero mission copy (`homeController.js`), and the Contact page address + embedded Google Map (`contact.ejs`) — the map `src` and its `aria-label` need new Florence, AL coordinates/place. Text/data fixes only — not the deferred footer rebuild.
- **Patterns to follow:** the existing footer/meta/contact markup.
- **Test scenarios:** Covers R14. `GET /` and `GET /contact` render "Florence, AL" and contain no "Hattiesburg" string; `grep -rn 'Hattiesburg' src/ public/` returns nothing.
- **Verification:** the footer, the per-page meta description, the homepage hero, and the Contact page/map all show the Florence, AL identity; no "Hattiesburg" remains anywhere in `src/`.

---

## Scope Boundaries

**Deferred for later (fast-follow):**
- Warm-cream `--color-bg` repaint and the cream/sand/navy section rhythm.

**Deferred to Follow-Up Work:**
- Re-vectorizing the logo to SVG and/or producing a light/reversed wordmark variant (crispness at larger hero scales).
- Regenerating the favicon from the real logo.

**Outside this plan** (tracked in `docs/ideation/2026-06-14-ui-visual-polish-ideation.html`):
- Photo-ready sanctuary hero + scrim, Jewish-motif SVG texture, unified gold-top-border card system, fluid `clamp()` type + 65ch measure, footer rebuild, dark mode, interactive-feedback (hover/focus) fixes.

---

## Open Questions (deferred to implementation)

- Canonical gold hex + variants — chosen at the visual-review checkpoint, and harder than one value: it must simultaneously give (a) `--color-gold-dark` ≥4.5:1 as text on white, (b) a focus outline ≥3:1 on white **and** navy, (c) navy text ≥4.5:1 on the `--color-gold` CTA fill, and (d) read well on cream later. The recommended start `#c8a040` / `#8a6d24` **fails** some of these (fill ~2.3:1 as a focus ring on white; dark ~2.7:1 as text on navy), so review likely needs a third token (a focus / on-navy gold) or a rule that gold text never sits on navy. Resolve before U1 bakes a value, or U2's sweep may need redoing.
- Final font weights/subsets to self-host (e.g., Cormorant Garamond 600/700, Inter 400/500/600, Latin subset) to keep payload small.
- Exact Florence, AL street address for the footer — confirm from the current site / congregation records.
- Whether any heading visibly breaks under the serif swap — spot-check during U3.

---

## Risks & Dependencies

- **A11y regression (and a blind test gate).** A new palette/gold must re-clear AA, but `npm run test:a11y` cannot see it — jest-axe runs under JSDOM with no CSS, so color-contrast never fails there. Mitigation: verify contrast **manually** at the visual-review checkpoint (the pairings are listed in U1); keep `test:a11y` as a structural/landmark/alt guard. The audit only covers Home/About/Contact, so manually spot-check donations, calendar, directory, and the swept admin pages.
- **FOUT / layout shift** from web fonts. Mitigation: `font-display: swap` + a metric-comparable fallback stack (KTD2).
- **Logo quality/legibility.** 600×137 PNG is soft at large scale and dark on navy. Mitigation: light-surface placement at a constrained size (KTD4); vectorize only if a larger display is wanted (deferred).
- **Sweep completeness.** Easy to miss `account.css:59` (`#f0b849`). Mitigation: the grep verification in U2.
- **Asset dependency.** The logo lives at `/tmp/tbi-logo-extended.png` (pulled this session) and must be copied into `public/images/` during U4 before it can be referenced.

---

## Sources & Research

- Origin requirements: `docs/brainstorms/2026-06-14-visual-foundation-requirements.md`.
- Ideation evidence (file:line quotes for the gold drift, system-font state, hero markup): dossiers under `/tmp/compound-engineering/ce-ideate/4311be5a/` (temporary; `evidence-color-tokens.md`, `evidence-typography.md`, `evidence-imagery-identity.md`).
- Repo grounding (verified this session): `public/css/main.css` `:root` (lines 14–38), `--focus-outline` (38), CTA accent (238), `prefers-contrast: high` (~613); gold references in `public/css/{about,contact,page-editor,announcements,account}.css`; hero markup `src/views/home.ejs` (1–10); footer `src/views/layout.ejs`; CSP `fontSrc`/`imgSrc` `'self'` in `src/server.js`.
- UX direction: `_bmad-output/planning-artifacts/ux-design-specification.md` ("Modern Reverence"); `docs/ACCESSIBILITY_AUDIT_REPORT.md` (contrast budget).
- Logo asset: pulled from the current site to `/tmp/tbi-logo-extended.png` (600×137 RGBA) and `/tmp/tbi-logo-favicon.png` (50×50).
