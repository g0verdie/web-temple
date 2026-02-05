# Story 1.14: Automated Test Infrastructure

**Story ID:** 1.14
**Status:** ready-for-dev

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

-   [ ] **Task 1: Configuration**
    -   [ ] Configure Jest coverage thresholds.
    -   [ ] Set up `supertest` for integration tests.
-   [ ] **Task 2: Critical Path Tests**
    -   [ ] Write tests for `AuthService`.
    -   [ ] Write tests for `DonationController`.
-   [ ] **Task 3: CI Setup**
    -   [ ] Verify GitHub Actions (or other CI) runs `npm test`.

## Dev Notes
-   **Existing Tests:** We have some tests from Story 1.2 (SSL). Integrate them.

### References
-   [Epic 1: Project Foundation](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record
BMad Master (Manual Creation)
