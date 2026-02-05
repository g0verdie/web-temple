# Story 1.7: Automated Daily Backups

**Story ID:** 1.7
**Status:** ready-for-dev

## Story

As a **system administrator**,
I want **automated daily backups to cloud storage with restore testing capability**,
so that **the temple's data is protected and recoverable in case of failure.**

## Acceptance Criteria

1.  **Daily Schedule:** The daily backup cron job runs at 2:00 AM EST.
2.  **Full Dump:** Full PostgreSQL database dump is created with `pg_dump` (FR96, FR97).
3.  **Comprehensive Data:** Backup includes all user data, messages, donations, settings (FR97).
4.  **AES-256 Encryption:** Backup file is encrypted with AES-256 before upload (NFR-S2).
5.  **Cloud Storage:** Encrypted backup is uploaded to AWS S3 with versioning enabled.
6.  **Retention Policy:** Backup retention policy keeps last 30 daily backups + last 12 monthly backups.
7.  **Local Logging:** Backup success/failure is logged locally (NFR-M3).
8.  **Admin Visibility:** Last backup timestamp and status are visible on admin dashboard (FR99).
9.  **Staging Test:** Backup restore can be tested on staging environment without affecting live site (FR98).
10. **Documentation:** Restore procedure is documented in operational runbook (NFR-M5).
11. **Alerts:** Failed backups trigger email alert to admin (FR67).

## Tasks / Subtasks

-   [ ] **Task 1: S3 Setup**
    -   [ ] Create private S3 bucket (e.g., `temple-backups-prod`).
    -   [ ] Create IAM user with minimal write-only permissions for backup script.
-   [ ] **Task 2: Backup Script Creation**
    -   [ ] Write `scripts/backup.sh` to dump,encrypt, and upload.
    -   [ ] Implement retention pruning logic (or use S3 Lifecycle rules).
-   [ ] **Task 3: Automation**
    -   [ ] Configure cron job on production server.
-   [ ] **Task 4: Admin Integration**
    -   [ ] Create API endpoint `GET /api/admin/backups/status` to read latest log/metadata.
    -   [ ] Update Admin Dashboard UI to show status.

## Dev Notes

-   **Tools:** `pg_dump`, `openssl` (for encryption), `aws-cli` (or minio client) for upload.
-   **Security:** Ensure S3 bucket is NOT public.

### References
-   [Architecture Decision Document](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/architecture.md)
-   [Epic 1: Project Foundation](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record
BMad Master (Manual Creation)
