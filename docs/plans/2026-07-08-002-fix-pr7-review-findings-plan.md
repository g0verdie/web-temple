---
title: PR 7 Review Findings Hardening - Plan
type: fix
date: 2026-07-08
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# PR 7 Review Findings Hardening - Plan

**Target branch:** `feat/temple-description-content` (draft PR #7) — these fixes land on the existing branch before the PR is marked ready for review.

---

## Goal Capsule

- **Objective:** Close the three validated findings from PR #7's code review: the sitewide JSON-LD description ignores the page-aware meta description, the page editor's paste path still accepts formats the sanitizer silently destroys, and the trimmed toolbar shipped without a test despite an existing harness.
- **Authority:** This plan's Product Contract, then the origin feature plan (`docs/plans/2026-07-08-001-feat-temple-description-content-plan.md`, on this branch), then `AGENTS.md` hard rules (strict CSP, no new frontend tooling, test-mode branches untouched).
- **Execution profile:** Three small units on one existing branch. U2 lands before U3 so the test pins the final editor configuration.
- **Stop conditions:** Do not touch migration 027 or the seeded About content; do not modify the contact page meta description (locked by an exact-string test in `__tests__/routes/seo.test.js`); surface a blocker instead of guessing if the Quill formats whitelist breaks existing editor behavior in the harness.

---

## Product Contract

### Summary

Harden PR #7 before it leaves draft: carry the new Reform/Shoals identity copy into the structured-data channel search engines read, close the paste-path gap that lets editors create content the sanitizer silently destroys on save, and pin the editor configuration with tests in the existing client harness.

### Problem Frame

PR #7's review returned "Ready with fixes" with three validated findings. First, `src/views/layout.ejs` computes a page-aware meta description used by the meta/OG/Twitter tags, but the sitewide PlaceOfWorship JSON-LD block hardcodes the old generic description — so after PR #7's copy changes, human-facing tags and structured data on the same pages contradict each other, undercutting the PR's own local-search goal. Second, PR #7's toolbar trim (U6 in the origin plan) removed the blockquote/code-block/image buttons, but the vendored Quill 1.3.6 registers all formats when no `formats` whitelist is set, so pasted content still creates those elements live in the editor and the sanitizer silently strips them on save — the exact failure the trim was meant to close. Third, the trim shipped untested on the plan's claim that `public/js` has no test harness, but `__tests__/public/page-editor.test.js` already requires `page-editor.js` and mocks `global.Quill`, so the missing coverage is cheap to add.

### Requirements

- R1. The sitewide PlaceOfWorship JSON-LD `description` matches the rendered page's meta description on every page; pages that pass no per-page description keep the sitewide default.
- R2. The page editor cannot produce content the sanitizer silently destroys through any input path — toolbar or paste. Blockquote and code-block formats are unregistered; the image format stays registered so the seeded About building photo survives editor load and save.
- R3. The trimmed toolbar and the formats whitelist are pinned by automated tests in the existing client harness, so a future editor change cannot silently regress them.

### Scope Boundaries

**Deferred to Follow-Up Work**

- A warning header on (or deletion of) `scripts/publish_about.js`, and a post-migrate verification step in the origin plan's publish runbook — both suggested by the review's soft buckets; held out per scope confirmation.
- The review's deeper testing gaps: CSRF enforcement on rabbi save/publish POSTs (test-mode short-circuit), JWT-vs-DB role revocation coverage, and executing migration SQL against real Postgres in CI. Each is test-infrastructure work beyond this hardening pass.
- Handling pasted `data:`-URI images gracefully in the editor — remains a known gap until the origin plan's deferred image pipeline lands.

---

## Planning Contract

**Product Contract preservation:** new plan, no upstream brainstorm; scope confirmed in session (three findings, on the PR branch).

### Key Technical Decisions

- KTD1. **Reuse the computed `metaDescription` in the JSON-LD block** rather than adding any per-page structured-data field. `layout.ejs` already computes the page-aware value and uses it for the meta, OG, and Twitter description tags; pointing the JSON-LD `description` at the same variable closes the drift with no new plumbing and preserves the default fallback for pages without a per-page description.
- KTD2. **Close the paste path with a Quill `formats` whitelist mirroring the toolbar plus `image`:** `['bold', 'italic', 'underline', 'link', 'header', 'list', 'image']`. The review's validator confirmed against the vendored Quill 1.3.6 source that `formats` defaults to null (all formats active regardless of toolbar config), so the whitelist is the mechanism that governs paste. `image` stays registered even though its button is gone — the seeded About content contains an `<img>` that must survive editor load/save. Pasted images remain a known gap (see Scope Boundaries).
- KTD3. **Land on the draft PR branch, not a follow-up PR.** The review verdict was "Ready with fixes"; the fixes belong to the same review cycle, and the branch is still draft so amending it is cheap. Two of the three findings modify a file PR #7 already touches.

---

## Implementation Units

### U1. Reuse the page-aware meta description in the sitewide JSON-LD

- **Goal:** Structured data stops contradicting the meta/OG/Twitter tags; the new Reform/Shoals copy reaches search engines' JSON-LD channel (R1).
- **Requirements:** R1.
- **Dependencies:** none.
- **Files:** `src/views/layout.ejs`, `__tests__/views/structuredData.test.js`.
- **Approach:** In the PlaceOfWorship JSON-LD object in `layout.ejs`, replace the hardcoded `defaultDescription` reference with the `metaDescription` variable computed earlier in the same template (the pattern the meta description tag already uses). No other JSON-LD fields change.
- **Execution note:** Test-first — add the failing description assertion to `structuredData.test.js`, then make the one-line template change.
- **Patterns to follow:** The `metaDescription` usage in the `<meta name="description">`, `og:description`, and `twitter:description` tags in the same file.
- **Test scenarios:**
  - Happy path: a page rendered with a per-page description (the homepage fixture) emits a PlaceOfWorship block whose `description` equals that page's meta description (contains "Reform").
  - Fallback: a page rendered without a per-page description emits the sitewide default description in the JSON-LD block.
  - Regression: the existing exactly-one-PlaceOfWorship-block and name/address assertions stay green.
- **Verification:** `npx jest __tests__/views/structuredData.test.js` green; rendered homepage HTML shows matching description values in the meta tag and the JSON-LD block.

### U2. Restrict the page editor to sanitizer-safe formats

- **Goal:** Pasted blockquotes, code blocks, and other unsupported formats can no longer enter the editor document only to be silently destroyed on save (R2).
- **Requirements:** R2.
- **Dependencies:** none.
- **Files:** `public/js/page-editor.js`.
- **Approach:** Add the KTD2 `formats` whitelist to the Quill init options alongside the existing trimmed toolbar config. Keep the explanatory comment in the file aligned with the new mechanism (the comment currently explains the toolbar trim only).
- **Patterns to follow:** The existing options object shape in `page-editor.js`; the origin plan's U6 rationale for which formats are sanitizer-safe.
- **Test scenarios:** Covered by U3's harness assertions (this unit is a static client config change; `public/js` behavior is pinned in the jsdom harness, not in-browser).
- **Verification:** Editor smoke on `/admin/pages/about`: pasting content containing a blockquote or code block yields plain paragraphs in the editor (not styled blocks that would vanish on save); existing seeded About content, including the building photo `<img>`, loads and round-trips unchanged.

### U3. Pin the toolbar and formats configuration in the existing harness

- **Goal:** The trimmed toolbar and the new formats whitelist are locked by tests so future editor edits cannot silently regress them (R3).
- **Requirements:** R3.
- **Dependencies:** U2 (the test asserts the final configuration including the whitelist).
- **Files:** `__tests__/public/page-editor.test.js`.
- **Approach:** In the existing describe block that already requires `page-editor.js` and mocks `global.Quill`, read the options object from the mock's call args and assert on it — the review supplied the shape: flatten `modules.toolbar` and assert `image`, `blockquote`, and `code-block` are absent; assert the `formats` array equals the KTD2 whitelist.
- **Patterns to follow:** The existing `global.Quill` mock and DOMContentLoaded dispatch pattern in the same file.
- **Test scenarios:**
  - The flattened toolbar config contains no `image`, `blockquote`, or `code-block` entries.
  - The `formats` option exists and matches the KTD2 whitelist exactly (including `image`).
  - Regression: the file's existing CSRF-token tests stay green.
- **Verification:** `npx jest __tests__/public/page-editor.test.js` green.

---

## Verification Contract

| Gate | Command | Applies to |
|---|---|---|
| Structured data | `npx jest __tests__/views/structuredData.test.js` | U1 |
| Editor harness | `npx jest __tests__/public/page-editor.test.js` | U2, U3 |
| Full suite + coverage threshold | `npm test` | all units |
| Lint | `npm run lint` | U1 (template untouched by lint scope, run regardless) |
| Editor smoke (manual) | Load `/admin/pages/about`: paste blockquote/code-block content -> normalized to supported formats; seeded content incl. building photo round-trips unchanged | U2 |

Quality gates from `AGENTS.md` apply: no inline script/style (U1 touches a template — the change is a variable reference only), no `console.log` in `src/`, no changes to `NODE_ENV === 'test'` branches.

---

## Definition of Done

- All three units implemented on `feat/temple-description-content`; `npm test` green with the coverage threshold intact; `npm run lint` clean.
- Rendered pages emit consistent description values across meta tags and JSON-LD (spot-check homepage and `/about` in test renders).
- Editor smoke passes: paste normalization observed, seeded About content round-trips with its image.
- No dead-end or experimental code in the diff; the three review findings can each be pointed at a closing commit.
