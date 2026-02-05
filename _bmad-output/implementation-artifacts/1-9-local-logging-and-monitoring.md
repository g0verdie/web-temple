# Story 1.9: Local Logging & Monitoring

**Story ID:** 1.9
**Status:** ready-for-dev

## Story

As a **system administrator**,
I want **local logging and monitoring with 30-day online retention**,
so that **I can troubleshoot issues and monitor system health.**

## Acceptance Criteria

1.  **File Storage:** Logs are written to local files in `/var/log/temple-app/` (or app directory) (NFR-M3).
2.  **Rotation:** Log rotation is configured (daily rotation, compress after 1 day).
3.  **Retention:** Online logs retained 30 days; archived for 1 year.
4.  **Format:** Logs include timestamp, severity (ERROR/WARN/INFO), message, request ID.
5.  **Details:** Errors include stack traces; API requests include method, path, status, response time.
6.  **Metrics:** System metrics (CPU, memory, disk) logged every 5 minutes.
7.  **Real-time:** logs readable with `tail -f`.
8.  **Parseable:** JSON or consistent text format.

## Tasks / Subtasks

-   [ ] **Task 1: Logger Configuration**
    -   [ ] Configure `winston` for structured logging.
    -   [ ] Configure `winston-daily-rotate-file` transport.
-   [ ] **Task 2: HTTP Logging**
    -   [ ] Configure `morgan` to pipe to winston.
-   [ ] **Task 3: System Metrics**
    -   [ ] Create a simple recurring task to log `process.memoryUsage()` and OS load.
-   [ ] **Task 4: Access Control**
    -   [ ] Ensure log directory is secure (read-only for devs/admin).

## Dev Notes
-   **Libraries:** `winston`, `morgan`, `winston-daily-rotate-file`.

### References
-   [Architecture Decision Document](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/architecture.md)
-   [Epic 1: Project Foundation](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record
BMad Master (Manual Creation)
