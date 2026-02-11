# Story 2.1: User Registration

**Epic:** 2: User Authentication & Access Control
**Status:** Ready for Dev

## User Story
As a **public visitor**,
I want to register as a member using my email and password,
So that I can access members-only content and receive temple communications.

## Acceptance Criteria
- [ ] **Given** I am an unregistered visitor on the registration page
- [ ] **When** I submit the registration form with email and password
- [ ] **Then** My account is created in the database with encrypted password (NFR-S3)
- [ ] **And** My password must be at least 12 characters with complexity requirements (NFR-S3)
- [ ] **And** I receive a confirmation email welcoming me as a member
- [ ] **And** I am automatically logged in after successful registration
- [ ] **And** My session is created with JWT token stored in secure HTTP-only cookie
- [ ] **And** Form validation provides clear error messages for invalid inputs
- [ ] **And** The form is keyboard accessible and screen reader compatible (NFR-A1, NFR-A3)
- [ ] **And** Touch targets are minimum 44px on mobile devices (FR80)

## Dev Notes
-   Review `encryptionHelper` from Epic 1 for bcrypt usage.
-   Ensure JWT secret matches the one in `.env`.
