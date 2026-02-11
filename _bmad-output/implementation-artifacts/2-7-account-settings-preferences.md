# Story 2.7: Account Settings & Preferences

**Epic:** 2: User Authentication & Access Control
**Status:** Ready for Dev

## User Story
As a **logged-in member**,
I want to access my account settings to manage notification preferences and profile information,
So that I can control how the temple communicates with me and keep my information current.

## Acceptance Criteria
- [ ] **Given** I am a logged-in member
- [ ] **When** I navigate to my account settings page
- [ ] **Then** I can update my profile information (name, email)
- [ ] **And** I can manage notification preferences for announcements, calendar events, and messages (FR108)
- [ ] **And** I can opt in/out of each email type independently (FR34, FR88)
- [ ] **And** I can change my password (requires current password for verification)
- [ ] **And** All changes are saved to the database immediately
- [ ] **And** I see a success confirmation message after saving
- [ ] **And** Email changes require verification via confirmation link
- [ ] **And** The settings page is fully responsive on all devices (FR77-79)
- [ ] **And** All controls are keyboard accessible (NFR-A1)

## Dev Notes
-   Need `notification_preferences` table or JSONB column on users.
-   Email verification flow required for email changes.
