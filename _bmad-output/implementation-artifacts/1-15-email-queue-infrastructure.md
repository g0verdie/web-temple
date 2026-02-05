# Story 1.15: Email Queue Infrastructure

**Story ID:** 1.15
**Status:** ready-for-dev

## Story

As a **developer**,
I want **a reliable email queue with retry logic and admin monitoring**,
so that **email notifications are delivered even when the email service is temporarily unavailable.**

## Acceptance Criteria

1.  **Queue:** Emails stored in `email_queue` table (PostgreSQL) or Redis list.
2.  **Worker:** Background worker processes queue every 30s.
3.  **Retry:** Exponential backoff (1m, 5m, 15m, 1h, 6h) (NFR-I2).
4.  **Failure:** Mark permanent fail after 5 attempts; alert admin.
5.  **Admin:** Manual retry capability from dashboard (NFR-I3).
6.  **Templates:** Reusable templates (welcome, reset, receipt).
7.  **Unsubscribe:** Links included (FR88).
8.  **Logging:** Delivery status logged.

## Tasks / Subtasks

-   [ ] **Task 1: Job Queue Config**
    -   [ ] Install `bull` (Redis-based) or create DB-backed queue.
-   [ ] **Task 2: Worker Implementation**
    -   [ ] Implement worker to consume jobs and call mailer.
    -   [ ] Implement backoff logic.
-   [ ] **Task 3: Dashboard Integration**
    -   [ ] Add queue status to Admin Dashboard.

## Dev Notes
-   **Library:** `bull` is standard for Redis queues in Node.

### References
-   [Epic 1: Project Foundation](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record
BMad Master (Manual Creation)
