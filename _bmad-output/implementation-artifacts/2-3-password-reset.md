# Story 2.3: Password Reset

**Epic:** 2: User Authentication & Access Control
**Status:** Ready for Dev

## User Story
As a **registered member who forgot their password**,
I want to reset my password via email link,
So that I can regain access to my account securely.

## Acceptance Criteria
- [ ] **Given** I am on the password reset request page
- [ ] **When** I submit my email address
- [ ] **Then** If the email exists in the system, a password reset email is sent with a unique token link
- [ ] **And** The reset token expires after 24 hours (FR103)
- [ ] **And** If the email doesn't exist, I see the same success message (security - don't reveal account existence)
- [ ] **And** When I click the reset link and submit a new password, it must meet password policy requirements (NFR-S3)
- [ ] **And** The new password cannot be one of my last 5 passwords (NFR-S3)
- [ ] **And** After successful reset, my old session tokens are invalidated
- [ ] **And** I receive a confirmation email that my password was changed
- [ ] **And** The reset form is keyboard accessible (NFR-A1)

## Dev Notes
-   Use `emailQueue` (Story 1.15) for sending the reset link.
-   Store reset tokens in Redis or DB with expiration.
-   "Last 5 passwords" requirement implies a `password_history` table.
