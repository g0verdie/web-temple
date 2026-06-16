# Verification — Directory editor consolidated into Account Settings

**Date:** 2026-06-16 · **Branch:** `feat/directory-account-consolidation`
**Plan:** `docs/plans/2026-06-16-001-feat-directory-account-consolidation-plan.md`

## Automated

- `npm run lint` — clean.
- Full suite: **133 suites / 1112 tests passing** (`npm test`).
- a11y suite: **17 suites / 66 tests passing** (`npm run test:a11y`), including the merged
  `/account/settings` axe pass (`directoryListing.accessibility.test.js`, repointed).
- Repointed/added tests: `directoryAccountRoutes` (301 redirect + merged-render assertions),
  `directoryListingHousehold` (renders via `/account/settings`), `noindex` (dropped the
  now-301 `/account/directory` case).

## Browser (driven, demo-member@florencetemple.org)

| Scenario | Expected | Result |
|---|---|---|
| Fresh `/account/settings` | section collapsed | `[open]`=0 ✓ |
| Jump-nav "Directory Listing" click | section opens | `[open]`=1 ✓ |
| Direct `…#directory-listing` | open + focus inside | `[open]`=1, `activeElement#directory-listing` ✓ |
| `GET /account/directory` (authed) | 301 → `…#directory-listing`, auto-expanded | url + `[open]`=1 ✓ |
| Visibility fieldset | disabled until "List me" on | toggles both ways ✓ |
| Household modal | open focuses name; Escape closes + returns focus to trigger | ✓ |
| Household modal focus trap | Tab/Shift+Tab wrap within modal | ✓ both directions |
| Save | stays on `/account/settings`, success msg, section stays open, summary updates | url unchanged, "Saved — your directory listing is up to date.", `[open]`=1, summary recomputed ✓ |

The full directory script (modal, visibility toggle, save handler) initialized on a page that
**also** loads `account-settings.js`, confirming KTD5 — the IIFE wrap resolved the top-level
`const getCsrfToken/requestJson/showMessage` collision that would otherwise have left the editor
rendered-but-inert.

Demo-member's `show_phone` flag was flipped during the save test and reverted to its seed baseline.

Screenshots: `01-collapsed-default.png`, `02-jumpnav-expanded.png`, `03-after-301.png`, `04-save-in-place.png`.
