# Story 1.7: Automated Daily Backups

**Story ID:** 1.7
**Status:** done

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

-   [x] **Task 1: S3 Setup**
    -   [x] Create private S3 bucket (e.g., `temple-backups-prod`).
    -   [x] Create IAM user with minimal write-only permissions for backup script.
-   [x] **Task 2: Backup Script Creation**
    -   [x] Write `scripts/backup.sh` to dump,encrypt, and upload.
    -   [x] Implement retention pruning logic (or use S3 Lifecycle rules).
-   [x] **Task 3: Automation**
    -   [x] Configure cron job on production server.
-   [x] **Task 4: Admin Integration**
    -   [x] Create API endpoint `GET /api/admin/backups/status` to read latest log/metadata.
    -   [x] Update Admin Dashboard UI to show status.

## Dev Notes

-   **Tools:** `pg_dump`, `openssl` (for encryption), `aws-cli` (or minio client) for upload.
-   **Security:** Ensure S3 bucket is NOT public.

### References
-   [Architecture Decision Document](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/architecture.md)
-   [Epic 1: Project Foundation](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record
BMad Master (Manual Creation)
- Added `backupLogService` to efficiently read logs and prevent memory issues.
- Updated `backup.sh` with `set -o pipefail` to catch pipeline errors.
- Improved `setup-cron.sh` to be non-destructive.
- Enhanced Admin Dashboard AND API to report backup failures prominently.
- Verified with integration tests.
