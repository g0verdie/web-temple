# Story 1.8: Audit Logging Infrastructure

**Story ID:** 1.8
**Status:** ready-for-dev

## Story

As a **developer**,
I want **comprehensive audit logging for all sensitive actions**,
so that **security events and admin actions are traceable for accountability and compliance.**

## Acceptance Criteria

1.  **Scope:** Audit logs record announcements (CRUD), calendar changes, donations, admin logins, password/role changes.
2.  **Detail:** Logs include user ID, timestamp, action type, IP address, and before/after values (diff) where applicable.
3.  **Immutability:** Audit logs are stored in an append-only table (no delete/update permissions for app user if possible).
4.  **Encryption:** Audit logs are encrypted at rest (covered by Story 1.6).
5.  **Admin UI:** Admin can view audit logs with filtering by date, user, and action type (FR65).
6.  **Retention:** Audit logs are retained for 1 year minimum (NFR-M3).
7.  **Security:** Sensitive logs (donations) are stored securely (FR102).

## Tasks / Subtasks

-   [ ] **Task 1: Schema Design**
    -   [ ] Create `audit_logs` table (id, user_id, action, resource_type, resource_id, changes_json, created_at, ip_addr).
-   [ ] **Task 2: Middleware/Service**
    -   [ ] Create `AuditService` with `log(action, user, resource, details)`.
    -   [ ] Integrate into `AuthController` (login/logout).
    -   [ ] Integrate into `DonationController`, `AnnouncementController`, etc.
-   [ ] **Task 3: Admin UI**
    -   [ ] Create `GET /api/admin/audit-logs` endpoint with pagination and filtering.
    -   [ ] Build Audit Log view in Admin Dashboard.

## Dev Notes
-   **Performance:** Audit logging should happen asynchronously or be very fast to not block user actions.
-   **Privacy:** Don't log full credit card info or plaintext passwords (obviously).

### References
-   [Architecture Decision Document](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/architecture.md)
-   [Epic 1: Project Foundation](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record
BMad Master (Manual Creation)
