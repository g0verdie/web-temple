---
date: 2026-06-14
topic: visual-foundation
---

# Visual Foundation — "Modern Reverence" Type & Color

## Summary

Establish the public site's visual foundation in one safe pass: self-host a **Cormorant Garamond (headings) + Inter (body)** type system applied globally, consolidate the gold accent into a single canonical **`--color-gold`** token (with an AA-safe `--color-gold-dark`) that replaces today's scattered and referenced-but-undefined golds, and bring Temple B'nai Israel's existing tree-of-life logo into the homepage hero. The warm-cream repaint and section rhythm are a deliberate fast-follow, not part of this pass.

## Problem Frame

The site reads as a functional but cool, institutional template, while the team's ratified "Modern Reverence" direction (deep navy + warm gold, serif headings) was documented in the UX spec and never built — `main.css` ships a system-sans stack and there is no `public/fonts/`. The gold accent has drifted: `--color-gold` is referenced in per-page CSS but never defined in `:root`, so it silently falls back to a stray hex, and at least three different golds ship across the stylesheets. The result is a brand that looks accidental rather than chosen — which matters now because the MVP is being shown to the Board at end of July, and typography plus a coherent accent are the cheapest, widest-reach levers for making it feel like a warm community home.

## Key Decisions

- **Safe foundation first.** Ship the gold token and the type system now; defer the warm-cream base and section rhythm to a separate fast-follow with its own visual and a11y pass — the cream repaint has the largest ripple surface (the background token is used widely).
- **Cormorant Garamond (headings) + Inter (body).** The chosen pairing; the serif is restricted to headings so its thinness at small sizes is a non-issue.
- **Canonical gold pinned at a visual-review checkpoint, not in this doc.** A specific hue is a see-it-rendered call; a recommended value (~`#c8a040`, with ~`#8a6d24` as the dark variant) is carried into review rather than hard-committed here.
- **Global application, admin included.** Tokens and fonts live in `main.css`, so headings and the canonical gold render consistently across public and admin pages rather than carving admin out.
- **One gold that survives the cream follow-on.** The canonical value must read well on today's white background and on the cream coming next, so the fast-follow doesn't force a re-pick.
- **The real logo supersedes the favicon-promotion idea.** Feature Temple B'nai Israel's existing tree-of-life wordmark in the hero rather than scaling up the favicon; the favicon can later be regenerated from the same mark.
- **Keep both palettes intact rather than recoloring the logo.** The logo (brown + green) and the site direction (navy + gold) are resolved by placing the logo on a neutral/light surface within the hero — not by recoloring an established congregational mark or pivoting the accent. Treated as the default pending the review (see Outstanding Questions).
- **Congregation is Temple B'nai Israel, Florence, AL.** Confirmed against the logo and current site. The repo's hard-coded "Hattiesburg, MS 39401" footer address is wrong and must be corrected to the real Florence, AL address.

## Requirements

**Color tokens**

- R1. Define a single canonical gold as `--color-gold` in the `main.css` `:root`, plus `--color-gold-dark` for any gold used as text or on light backgrounds so it can meet AA.
- R2. Alias `--color-accent` to `--color-gold` so existing `var(--color-accent)` usages adopt the canonical value.
- R3. Replace the hardcoded gold hex values across the per-page stylesheets with the gold tokens; no raw gold hex remains in shipped CSS.
- R4. Add a darkened-gold override to the `prefers-contrast: high` block so the accent is governed in high-contrast mode (today that block overrides the primary and secondary colors but not the accent).

**Typography**

- R5. Self-host the chosen serif and sans as WOFF2 in `public/fonts/`, declared via `@font-face` in an external stylesheet (no CDN, no inline style) so the strict CSP (`fontSrc 'self'`) is satisfied.
- R6. Define `--font-serif` and `--font-sans` tokens; apply the serif to headings (`h1`–`h4`) and the sans to body text, site-wide via `main.css`.
- R7. Each `@font-face` declares `font-display: swap` with a metric-comparable fallback stack (serif → Georgia/serif; sans → system sans) so text stays visible during load and reflow is minimal.

**Compliance & quality**

- R8. The accessibility budget holds after the change: `npm run test:a11y` passes, body text stays ≥4.5:1, the 3px gold focus ring + 2px offset and 44px touch targets are preserved, and any gold-as-text use clears AA via `--color-gold-dark`.
- R9. The CSP view-compliance guard stays green: all new styling ships as external CSS from `'self'`, with no inline `<style>`/`style=`/`<script>` and no third-party CSS or font CDNs introduced.
- R10. The type system and canonical gold apply globally, including admin views, so public and admin pages stay visually consistent.

**Brand logo**

- R11. Feature Temple B'nai Israel's existing logo (the tree-of-life emblem + wordmark) in the homepage hero, sourced from the current site.
- R12. The logo renders crisply at hero scale on high-DPI screens — since the source is a 600×137 transparent PNG, this requires a re-vectorized SVG (or at minimum a ≥2× raster) rather than the original PNG at large sizes.
- R13. The logo stays legible against the hero background with a meaningful `alt`; because the wordmark is dark and the current hero is dark navy, this requires a light/reversed variant or a lighter surface behind the logo, preserving AA contrast.
- R14. Correct the site's footer location from the placeholder "Hattiesburg, MS 39401" to the real Temple B'nai Israel, Florence, AL address (a minimal text fix, not the deferred footer rebuild). The displayed identity must match the logo.

## Acceptance Examples

- AE1. **Covers R4, R8.** Given the OS is in `prefers-contrast: high` mode, when a page renders, the gold accent uses the darkened value and still meets contrast against both navy and the page background.
- AE2. **Covers R7.** Given the WOFF2 fonts have not yet loaded, when a page renders, headings and body show immediately in the fallback stack (serif → Georgia, sans → system) and reflow only minimally once the web fonts arrive.
- AE3. **Covers R1, R8.** Given the gold is used as text or as a thin focus outline, when contrast is measured, it uses `--color-gold-dark` and clears AA (≥4.5:1 for text, ≥3:1 for the non-text outline) on both white and navy.
- AE4. **Covers R13.** Given the hero renders on a dark navy background, when the logo displays, its wordmark and emblem remain clearly legible (via a light/reversed variant or a lighter surface behind it) rather than the dark original disappearing into the navy.

## Scope Boundaries

**Deferred for later (fast-follow):**
- Warm-cream `--color-bg` repaint and the cream/sand/navy section rhythm.

**Outside this pass** (tracked in `docs/ideation/2026-06-14-ui-visual-polish-ideation.html`):
- Photo-ready sanctuary hero + scrim, Jewish-motif SVG texture, the unified gold-top-border card system, fluid `clamp()` type + 65ch measure, footer rebuild, dark mode, and the interactive-feedback (hover/focus) fixes — each is separate work. (The deferred "promote `favicon.svg` to a header mark" idea is superseded by R11–R13, which use the real logo.) The logo is added to the current gradient hero and stays compatible with the future photo-hero direction.

## Dependencies / Assumptions

- Font files are obtained as open, self-hostable webfonts (e.g., via google-webfonts-helper). Assumes Cormorant Garamond + Inter remain the choice pending the visual review.
- The change extends the existing token architecture and per-page-stylesheet delivery in `main.css`; no new delivery mechanism is introduced.
- Verified against the repo this session: `--color-gold` is referenced (e.g., `public/css/contact.css`) but never defined in `:root`; ~3 distinct golds ship in CSS; `main.css` uses a system-sans stack; `public/fonts/` does not exist; `src/server.js` sets CSP `fontSrc 'self'`.
- The logo is pulled from the current site: `https://florencetemple.org/wp-content/uploads/2016/04/Logo-2_6-Extended_with-florence.png` (the extended wordmark, 600×137 transparent PNG, brown trunk + green leaves + dark text reading "Temple B'nai Israel / Florence, AL") and `https://florencetemple.org/wp-content/uploads/2017/10/Logo-2_6-favicon.png` (50×50). Image hosting is CSP-safe — assets are self-hosted from `public/` (`imgSrc 'self'`).

## Outstanding Questions

**Resolve before planning:** none — the congregation identity (Temple B'nai Israel, Florence, AL) is resolved; remaining items are review-time decisions below.

**Deferred to planning** (resolve at the visual-review checkpoint):
- The exact Florence, AL street address to replace the placeholder footer text (confirm from the current site / congregation records).
- The canonical gold hex and its dark variant — must clear AA on white now and on cream later.
- Final font specifics — which weights and subsets to self-host (e.g., Cormorant Garamond 600/700, Inter 400/500/600, Latin subset) — to keep payload small.
- Logo palette fit — the default (logo on a neutral/light surface within the navy/gold hero) vs. an alternative (a reversed/recolored variant, or evolving the accent toward the logo's green/brown).
- Logo asset form — re-vectorize the mark to SVG (recommended for crisp hero scale) vs. a ≥2× PNG; and whether a light/reversed wordmark variant already exists or must be produced.
- The exact list of per-page CSS files carrying hardcoded gold to sweep (enumerate during planning).
- Whether any heading currently depends on system-sans metrics in a way the serif swap would visibly disrupt (spot-check during planning).

## Sources / Research

- `docs/ideation/2026-06-14-ui-visual-polish-ideation.html` — origin ideas 1 (gold token) and 2 (type system); the warm-cream/rhythm idea 4 is the deferred fast-follow.
- `_bmad-output/planning-artifacts/ux-design-specification.md` — the "Modern Reverence" direction and the proposed `--font-serif` / `--font-sans` tokens.
- `docs/ACCESSIBILITY_AUDIT_REPORT.md` — the contrast/focus/touch-target budget this pass must preserve.
- Current site logo (the asset to incorporate): `florencetemple.org/wp-content/uploads/2016/04/Logo-2_6-Extended_with-florence.png` (600×137 transparent PNG) and the 50×50 favicon variant — confirmed reachable and inspected this session.
- Repo evidence (verified this session): `public/css/main.css` `:root` (`--color-accent: #d69e2e`, system-sans stack), `public/css/contact.css` (`var(--color-gold, #c9a961)`), `public/css/announcements.css` (`#b8860b` featured border), `src/server.js` (CSP `fontSrc 'self'`), `__tests__/security/cspViewCompliance.test.js` (the build-failing inline-style/script guard).
