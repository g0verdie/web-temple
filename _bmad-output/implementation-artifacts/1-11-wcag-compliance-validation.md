# Story 1.11: WCAG AA Compliance Validation

**Story ID:** 1.11
**Status:** ready-for-dev

## Story

As a **developer**,
I want **automated accessibility testing to validate WCAG AA compliance**,
so that **all users including those with disabilities can use the website.**

## Acceptance Criteria

1.  **Automated Scan:** axe DevTools/Lighthouse shows zero Level A/AA violations.
2.  **Contrast:** 4.5:1 minimum ratio for text (NFR-A2).
3.  **Focus:** Visible 3px focus indicators (NFR-A6).
4.  **Labels:** All form inputs have labels (FR74).
5.  **Alt Text:** All images have alt text (FR69).
6.  **Skip Link:** Functional skip-to-main-content link (FR75).
7.  **Screen Reader:** Manual verification with NVDA/VoiceOver.
8.  **Zoom:** 200% text zoom supported (FR72).
9.  **Keyboard:** Full keyboard navigation (FR68).

## Tasks / Subtasks

-   [ ] **Task 1: Automated Testing**
    -   [ ] Install `axe-core` or `cypress-axe` (if Cypress used).
    -   [ ] Integrate audit into CI/CD or `npm test:a11y`.
-   [ ] **Task 2: Remediation**
    -   [ ] Fix identified contrast/label issues.
-   [ ] **Task 3: Manual Audit**
    -   [ ] Perform keyboard-only navigation test.
    -   [ ] Document results in `docs/ACCESSIBILITY_AUDIT.md`.

## Dev Notes
-   **Tools:** Lighthouse, axe DevTools, Pa11y.

### References
-   [Epic 1: Project Foundation](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record
BMad Master (Manual Creation)
