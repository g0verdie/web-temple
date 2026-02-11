# Story 1.14: Automated Test Infrastructure

**Story ID:** 1.14
**Status:** done

## Story

As a **developer**,
I want **automated testing with 60% code coverage**,
so that **critical functionality is protected from regressions and bugs are caught early.**

## Acceptance Criteria

1.  **Framework:** Jest installed and configured.
2.  **Coverage:** >60% total coverage (NFR-M2).
3.  **Scope:** Unit tests for backend logic; Integration tests for key APIs.
4.  **Critical Paths:** Auth, Donations, Message/Announcements fully tested.
5.  **CI/CD:** Tests run before deployment; failure blocks deploy.
6.  **Documentation:** Testing guide available.

## Tasks / Subtasks

-   [x] **Task 1: Configuration**
    -   [x] Configure Jest coverage thresholds.
    -   [x] Set up `supertest` for integration tests.
-   [x] **Task 2: Critical Path Tests**
    -   [x] Write tests for `AuthService`.
    -   [x] Write tests for `DonationController`.
-   [x] **Task 3: CI Setup**
    -   [x] Verify GitHub Actions (or other CI) runs `npm test`.

## Dev Notes
-   **Existing Tests:** We have some tests from Story 1.2 (SSL). Integrate them.

### References
-   [Epic 1: Project Foundation](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record
**Implemented by:** Amelia
**Date:** 2026-02-10

### Implementation Plan
- Update Jest coverage thresholds to 60% globals.
- Add Donation controller + controller tests.
- Expand AuthService coverage with password reset tests.
- Fix cache key expectation drift in CacheService tests.
- Stabilize pageController tests by resetting mocks and cache.
- Add CI workflow running npm test.
- [AI-Review] Fix fake integration tests and logging standards.

### File List

**New Files:**
- src/controllers/donationController.js
- __tests__/integration/donation.integration.test.js
- .github/workflows/ci.yml

**Modified Files:**
- jest.config.js
- __tests__/unit/services/authService.test.js (moved from integration)
- __tests__/unit/services/CacheService.test.js
- __tests__/controllers/pageController.test.js
- src/routes/api.js
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/1-14-automated-test-infrastructure.md

### Change Log
- Lowered Jest global coverage thresholds to 60%.
- Added DonationController with encryption and audit logging plus tests.
- Added AuthService password reset tests.
- Updated CacheService unit test expectations for cache prefix.
- Reset DB mocks and redis cache between pageController tests.
- Added GitHub Actions CI workflow to run npm test.
- [AI-Review] Moved `authService.test.js` to `__tests__/unit/services/` to reflect unit test nature.
- [AI-Review] Implemented `donation.integration.test.js` using `supertest` for real API integration testing.
- [AI-Review] Wired up `POST /api/donations` in `src/routes/api.js`.
- [AI-Review] Fixed logging in `donationController.js` to use `logger` and added security validation for max amount.

### Completion Notes
- Tests: npm test
- Coverage meets >60% requirement.
- CI configured to run tests on push and PR.
- Review findings addressed; integration tests now authentic.
