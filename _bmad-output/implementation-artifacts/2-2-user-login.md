# Story 2.2: User Login

**Epic:** 2: User Authentication & Access Control
**Status:** Ready for Dev

## User Story
As a **registered member**,
I want to log in with my email and password,
So that I can access members-only features and personalized content.

## Acceptance Criteria
- [ ] **Given** I am a registered member on the login page
- [ ] **When** I submit valid email and password credentials
- [ ] **Then** My credentials are verified against the encrypted database password
- [ ] **And** A secure session is created with JWT token in HTTP-only cookie
- [ ] **And** I am redirected to the homepage or my intended destination
- [ ] **And** My login timestamp is recorded in the database
- [ ] **And** If credentials are invalid, I see a clear error message without revealing which field is incorrect (security)
- [ ] **And** After 5 failed login attempts, my account is temporarily locked for 15 minutes
- [ ] **And** The login form is fully accessible with keyboard navigation (NFR-A1)
- [ ] **And** The page loads in under 2 seconds (NFR-P1)

## Dev Notes
-   Reuse the session creation logic from Story 2.1.
-   Implement rate limiting for login attempts (Redis is a good candidate for tracking this).
