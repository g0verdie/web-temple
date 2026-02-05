# Story 1.6: Database Encryption at Rest

**Story ID:** 1.6
**Status:** ready-for-dev

## Story

As a **system administrator**,
I want **the database and backups encrypted at rest with AES-256**,
so that **sensitive data (passwords, donations, PII) is protected if storage is compromised.**

## Acceptance Criteria

1.  **Encryption Enabled:** PostgreSQL data directory is encrypted with AES-256 (NFR-S2).
2.  **Key Management:** Encryption keys are stored separately from data (key management strategy documented).
3.  **Encrypted Backups:** Backup files are encrypted before upload to S3 (NFR-S2).
4.  **Password Hashing:** Sensitive columns (passwords) use Bcrypt hashing with salt (NFR-S3).
5.  **Donation Security:** Donation data is encrypted at rest with strict RBAC (NFR-S6).
6.  **Audit Log Security:** Audit logs are encrypted and append-only (NFR-S8).
7.  **Performance:** Encryption performance overhead is <5% (acceptable for self-hosted).
8.  **Recovery Docs:** Decryption process is documented for disaster recovery.

## Tasks / Subtasks

-   [ ] **Task 1: PostgreSQL Encryption Setup**
    -   [ ] Research and select method (e.g., TDE, dm-crypt/LUKS for volume, or pgcrypto for columns).
    -   [ ] Implement encryption on production DB volume (LUKS recommended for self-hosted).
    -   [ ] Document key storage location and permissions.
-   [ ] **Task 2: Application-Level Encryption**
    -   [ ] Verify Bcrypt usage for passwords in `src/models/User.js` (or Auth service).
    -   [ ] Implement application-side encryption for sensitive fields (donations) if not covered by volume encryption.
-   [ ] **Task 3: Backup Encryption**
    -   [ ] Update backup script (`scripts/backup.sh`) to pipe `pg_dump` through `openssl` or GPG before upload to S3.
    -   [ ] Verify decrypted backup restores correctly.
-   [ ] **Task 4: Documentation**
    -   [ ] Create `docs/SECURITY_ENCRYPTION.md` detailing the strategy.
    -   [ ] Add recovery steps to `docs/RUNBOOK.md`.

## Dev Notes

-   **Architecture:** Reference *Architecture Decision Document* Decision 5 (Security).
-   **Implementation:** Since we are self-hosting on Linux, LUKS volume encryption for the `/var/lib/postgresql` directory is often the simplest and most robust "at rest" solution vs column-level `pgcrypto`.
-   **Key Management:** Store LUKS keys securely or require manual passphrase on server reboot (acceptable for MVP self-hosted)? Or use a local keyfile protected by root only.

### References

-   [Architecture Decision Document: Decision 5](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/architecture.md)
-   [Epic 1: Project Foundation](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record

### Agent Model Used
BMad Master (Manual Creation)

### File List
-   docs/SECURITY_ENCRYPTION.md
-   scripts/backup.sh
