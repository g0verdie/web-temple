# Story 2.3: Password Reset

**Epic:** 2: User Authentication & Access Control
**Status:** review

## Dev Agent Record
### Debug Log
- 2026-03-03: Validation-only run. `npm test` passed. `npm run lint` failed with 2 errors (roles-permissions.js, authController.js) and 8 warnings.
- 2026-03-07: Fixed lint errors. `npm test` passed. `npm run lint` now reports 8 existing warnings (no errors).
- 2026-03-07: Cleared lint warnings. `npm test` and `npm run lint` both pass.

### Completion Notes
- Validation halted due to lint errors; story not moved to review.
- Validation still blocked by lint warnings in existing files; story remains in progress.
- Lint clean; tests pass. Story ready for review.

## Change Log
- 2026-03-03: Validation-only run; tests pass, lint errors remain. Status unchanged.
- 2026-03-07: Fixed lint errors; tests pass; lint warnings remain. Status unchanged.
- 2026-03-07: Cleared lint warnings; tests and lint pass. Status moved to review.

## Senior Developer Review (AI)
_Reviewer: Amelia on 2026-02-18_

### Findings
-   **High**: Password reset pages were not routable (no GET routes), breaking core ACs.
-   **High**: CSRF protection blocked reset requests (missing CSRF token in fetch calls).
-   **High**: Session invalidation logic conflicted with JWTs (token_version missing in payload).
-   **Medium**: Login/reset links pointed to `/auth/login` which does not exist.
-   **Medium**: Integration test used invalid bcrypt hash and missed expiry + confirmation email assertions.

### Actions Taken
-   [x] Added GET routes for reset request and reset form in `pages.js`.
-   [x] Updated reset views to use layout fragment pattern and include CSRF token in fetch headers.
-   [x] Included `token_version` in JWT payloads for registration and login.
-   [x] Fixed login/reset links to point at `/login` and updated login page reset link.
-   [x] Improved integration tests for valid password hash, token expiry, and confirmation email.

**Status:** Done

## User Story
As a **registered member who forgot their password**,
I want to reset my password via email link,
So that I can regain access to my account securely.

## Acceptance Criteria
- [x] **Given** I am on the password reset request page
- [x] **When** I submit my email address
- [x] **Then** If the email exists in the system, a password reset email is sent with a unique token link
- [x] **And** The reset token expires after 24 hours (FR103)
- [x] **And** If the email doesn't exist, I see the same success message (security - don't reveal account existence)
- [x] **And** When I click the reset link and submit a new password, it must meet password policy requirements (NFR-S3)
- [x] **And** The new password cannot be one of my last 5 passwords (NFR-S3)
- [x] **And** After successful reset, my old session tokens are invalidated
- [x] **And** I receive a confirmation email that my password was changed
- [x] **And** The reset form is keyboard accessible (NFR-A1)

## Tasks
- [x] 2.3.1: Create `password_history` table and add `token_version` to users table (Migration)
- [x] 2.3.2: Implement `authService.requestPasswordReset` logic
- [x] 2.3.3: Implement `authService.resetPassword` logic with history check
- [x] 2.3.4: Create email templates for reset link and confirmation
- [x] 2.3.5: Create API endpoints in `authController.js`
- [x] 2.3.6: Create frontend views (`request-password-reset.ejs`, `reset-password.ejs`)
- [x] 2.3.7: Implement integration tests for reset flow

## File List
### [MODIFY] [authController.js](file:///Users/g0verdie/workspace/web-temple/src/controllers/authController.js)
### [MODIFY] [authService.js](file:///Users/g0verdie/workspace/web-temple/src/services/authService.js)
### [MODIFY] [auth.js](file:///Users/g0verdie/workspace/web-temple/src/routes/auth.js)
### [MODIFY] [pages.js](file:///Users/g0verdie/workspace/web-temple/src/routes/pages.js)
### [MODIFY] [emailTemplateService.js](file:///Users/g0verdie/workspace/web-temple/src/services/emailTemplateService.js)
### [MODIFY] [requireAuth.js](file:///Users/g0verdie/workspace/web-temple/src/middleware/requireAuth.js)
### [MODIFY] [requireRbac.js](file:///Users/g0verdie/workspace/web-temple/src/middleware/requireRbac.js)
### [MODIFY] [sessionTimeout.js](file:///Users/g0verdie/workspace/web-temple/src/middleware/sessionTimeout.js)
### [NEW] [007_create_password_history_and_token_version.sql](file:///Users/g0verdie/workspace/web-temple/migrations/007_create_password_history_and_token_version.sql)
### [MODIFY] [login.ejs](file:///Users/g0verdie/workspace/web-temple/src/views/login.ejs)
### [NEW] [request-password-reset.ejs](file:///Users/g0verdie/workspace/web-temple/src/views/auth/request-password-reset.ejs)
### [NEW] [reset-password.ejs](file:///Users/g0verdie/workspace/web-temple/src/views/auth/reset-password.ejs)
### [NEW] [passwordReset.test.js](file:///Users/g0verdie/workspace/web-temple/__tests__/integration/auth/passwordReset.test.js)
### [MODIFY] [migrate.js](file:///Users/g0verdie/workspace/web-temple/scripts/migrate.js)
### [MODIFY] [roles-permissions.js](file:///Users/g0verdie/workspace/web-temple/src/config/roles-permissions.js)
### [MODIFY] [api.js](file:///Users/g0verdie/workspace/web-temple/src/routes/api.js)
### [MODIFY] [backupLogService.js](file:///Users/g0verdie/workspace/web-temple/src/services/backupLogService.js)
### [MODIFY] [logger.js](file:///Users/g0verdie/workspace/web-temple/src/utils/logger.js)

## Dev Notes
-   Used `emailQueue` (Story 1.15) for sending the reset link.
-   Stored reset tokens in `password_resets` table (created in previous migration or implicit).
-   "Last 5 passwords" requirement implemented using `password_history` table.
-   Added `token_version` to `users` table to handle session invalidation.

## Senior Developer Review (AI)
_Reviewer: Antigravity on 2026-02-17_

### Findings
-   **CRITICAL**: Story file was completely empty of tasks and file tracking, despite implementation being present in git.
-   **Medium**: `authController.js` contained dynamic `require` statements inside function bodies.
-   **Medium**: Integration test was missing explicit verification of session invalidation (`token_version` increment).

### Actions Taken
-   [x] Populated Story file with correct Tasks, Acceptance Criteria status, and File List.
-   [x] Refactored `authController.js` to use top-level imports.
-   [x] Added test case to `passwordReset.test.js` to verify `token_version` increment (Session Invalidation AC).
-   [x] Verified all tests pass.

**Status:** Done
