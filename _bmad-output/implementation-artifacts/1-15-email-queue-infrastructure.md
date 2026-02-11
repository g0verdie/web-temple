# Story 1.15: Email Queue Infrastructure

**Story ID:** 1.15
**Status:** done

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

-   [x] **Task 1: Job Queue Config**
    -   [x] Install `bull` (Redis-based) or create DB-backed queue.
-   [x] **Task 2: Worker Implementation**
    -   [x] Implement worker to consume jobs and call mailer.
    -   [x] Implement backoff logic.
-   [x] **Task 3: Dashboard Integration**
    -   [x] Add queue status to Admin Dashboard.

## Dev Notes
-   **Library:** `bull` is standard for Redis queues in Node.

### References
-   [Epic 1: Project Foundation](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record
**Implemented by:** Amelia
**Date:** 2026-02-10
**Reviewer:** Code Review Agent (AI)
**Review Date:** 2026-02-10

### Implementation Plan
- Add Bull-based email queue service with custom exponential backoff schedule.
- Create reusable email templates with unsubscribe links.
- Implement worker to process queue, log status, and alert admins after permanent failure.
- Surface queue stats and failed job retry in Admin Dashboard.
- Add unit tests for queue service, templates, worker, and controller updates.

### File List

**New Files:**
- src/services/emailQueueService.js
- src/services/emailTemplateService.js
- src/workers/emailQueueWorker.js
- __tests__/services/emailQueueService.test.js
- __tests__/services/emailTemplateService.test.js
- __tests__/workers/emailQueueWorker.test.js

**Modified Files:**
- package.json
- src/controllers/adminController.js
- src/routes/admin/dashboard.js
- src/views/admin/dashboard.ejs
- src/server.js
- __tests__/controllers/adminController.test.js
- __tests__/integration/adminRoutes.test.js
- src/middleware/requireAdmin.js
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/1-15-email-queue-infrastructure.md

### Change Log
- Added Bull-backed email queue service with custom backoff schedule and admin alerting.
- Added email templates (welcome/reset/receipt) with unsubscribe link injection.
- Implemented email queue worker with delivery logging and failure handling.
- Extended admin dashboard to show queue stats and retry failed jobs.
- Added tests for email queue service, templates, worker, and dashboard updates.
- **[Code Review Fix]** Patched Critical security vulnerability in `requireAdmin.js`.
- **[Code Review Fix]** Added testing for retry route and admin alert failure handling.
- **[Code Review Fix]** Improved dashboard integration tests.

### Completion Notes
- Tests: npm test passed
- Code Review Outcome: Approved after fixes (2 Critical, 2 Medium issues resolved).
