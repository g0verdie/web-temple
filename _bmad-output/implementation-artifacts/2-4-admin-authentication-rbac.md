# Story 2.4: Admin Authentication & RBAC

**Epic:** 2: User Authentication & Access Control
**Status:** Ready for Dev

## User Story
As an **authorized admin user (Rabbi or Admin)**,
I want to log in with role-based access permissions,
So that I can access administrative features appropriate to my role.

## Acceptance Criteria
- [ ] **Given** I am a user with an assigned role (Rabbi, Admin, or future Social Chair)
- [ ] **When** I log in successfully
- [ ] **Then** My role and permissions are loaded from the database into my session
- [ ] **And** Admin role can access all metrics, messages, and content (FR25)
- [ ] **And** Rabbi role can post announcements, manage calendars, reply to messages, view donations (FR26)
- [ ] **And** Social Chair role (Phase 2) can post announcements and manage public calendar only (FR27)
- [ ] **And** My admin login is recorded in the audit log with timestamp (NFR-S8)
- [ ] **And** Admin sessions automatically log out after 30 minutes of inactivity (FR104)
- [ ] **And** Each admin action checks role permissions before execution
- [ ] **And** Unauthorized access attempts are logged and display "Access Denied" message

## Dev Notes
-   Core RBAC middleware needed here.
-   Define Roles and Permissions in a constant/config file or DB table.
