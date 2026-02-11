# Story 2.5: Session Management & Timeouts

**Epic:** 2: User Authentication & Access Control
**Status:** Ready for Dev

## User Story
As a **logged-in member or admin**,
I want my session to be managed securely with appropriate timeouts,
So that my account remains protected when I'm inactive.

## Acceptance Criteria
- [ ] **Given** I am logged in as a member or admin
- [ ] **When** I remain inactive for the timeout period
- [ ] **Then** Member sessions time out after 30 days of inactivity (FR28)
- [ ] **And** Admin sessions time out after 30 minutes of inactivity (FR104)
- [ ] **And** Upon timeout, I am redirected to the login page with a "Session expired" message
- [ ] **And** My session token is invalidated in the database
- [ ] **And** Any unsaved form data shows a warning before timeout (1 minute warning)
- [ ] **And** Session activity is tracked on each page load and API request
- [ ] **And** Session tokens are stored in secure HTTP-only cookies with SameSite=Strict
- [ ] **And** All session data is encrypted in transit via TLS (NFR-S1)

## Dev Notes
-   Use Redis for session storage (TTL support is built-in).
-   Frontend heartbeat or check needed for the "1 minute warning".
