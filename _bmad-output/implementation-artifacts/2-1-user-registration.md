# Story 2.1: User Registration

**Epic:** 2: User Authentication & Access Control
**Status:** done

## User Story
As a **public visitor**,
I want to register as a member using my email and password,
So that I can access members-only content and receive temple communications.

## Acceptance Criteria
- [x] **Given** I am an unregistered visitor on the registration page
- [x] **When** I submit the registration form with email and password
- [x] **Then** My account is created in the database with encrypted password (NFR-S3)
- [x] **And** My password must be at least 12 characters with complexity requirements (NFR-S3)
- [x] **And** I receive a confirmation email welcoming me as a member
- [x] **And** I am automatically logged in after successful registration
- [x] **And** My session is created with JWT token stored in secure HTTP-only cookie
- [x] **And** Form validation provides clear error messages for invalid inputs
- [x] **And** The form is keyboard accessible and screen reader compatible (NFR-A1, NFR-A3)
- [x] **And** Touch targets are minimum 44px on mobile devices (FR80)

## Dev Notes
-   Review `encryptionHelper` from Epic 1 for bcrypt usage.
-   Ensure JWT secret matches the one in `.env`.

## Tasks/Subtasks
- [x] Implement registration API with password policy, JWT cookie, and welcome email
- [x] Add registration UI with client-side validation and accessibility support
- [x] Wire routes and pages for registration/login

## Senior Developer Review (AI)
Date: 2026-02-10

Findings addressed:
- Mounted auth and pages routes so registration and login endpoints/pages are reachable.
- Moved inline registration script to external file to satisfy CSP and restore form behavior.
- Removed nested layout usage in register view to fix invalid markup and accessibility issues.
- Enforced JWT secret presence outside of tests.
- Added email validation and increased bcrypt cost.

## Dev Agent Record
### File List
- src/server.js
- src/routes/api.js
- src/routes/pages.js
- src/routes/auth.js
- src/controllers/authController.js
- src/services/authService.js
- src/utils/authHelper.js
- src/views/register.ejs
- src/views/layout.ejs
- src/views/login.ejs
- public/js/register.js
- public/js/login.js
- public/css/auth.css
- __tests__/integration/authRoutes.test.js

### Change Log
- Mounted auth and pages routes for registration/login.
- Reworked auth views to use layout partials and external scripts.
- Added login view and client scripts for auth flows.
- Enforced JWT secret and updated password/email validation.
- Increased bcrypt cost to align with security requirements.
- **AI Review Fixes (2026-02-13):**
    - Implemented CSRF protection with `csurf`.
    - Added Rate Limiting to auth endpoints.
    - Improved email/password validation with `validator`.
    - Added audit logging for failed registration attempts.
    - Updated integration tests to verify email sending and mock services.
    - Added `cookie-parser` to server.js.
