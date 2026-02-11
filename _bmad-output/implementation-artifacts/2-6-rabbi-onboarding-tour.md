# Story 2.6: Rabbi Onboarding Tour

**Epic:** 2: User Authentication & Access Control
**Status:** Ready for Dev

## User Story
As the **Rabbi logging in for the first time**,
I want to see a guided onboarding tour,
So that I can quickly learn how to use the admin features.

## Acceptance Criteria
- [ ] **Given** I am the Rabbi logging in for the first time (onboarding flag = false in database)
- [ ] **When** I successfully log in and reach the admin dashboard
- [ ] **Then** I see a step-by-step guided tour highlighting key features (FR107)
- [ ] **And** The tour covers announcement posting, calendar management, and message inbox
- [ ] **And** I can skip the tour or complete it at my own pace
- [ ] **And** I can navigate prev/next through tour steps
- [ ] **And** After completing or skipping the tour, my onboarding flag is set to true
- [ ] **And** I can re-access the tour from the Help menu at any time
- [ ] **And** The tour overlay is keyboard accessible with Esc to close (NFR-A1)

## Dev Notes
-   Need a `users.onboarding_complete` boolean flag.
-   Consider a lightweight tour library (e.g., Shepherd.js or Driver.js) or build a simple custom one.
