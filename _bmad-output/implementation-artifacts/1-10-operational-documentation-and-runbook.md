# Story 1.10: Operational Documentation & Runbook

**Story ID:** 1.10
**Status:** done

## Story

As a **successor developer or system administrator**,
I want **comprehensive operational documentation and troubleshooting guides**,
so that **I can maintain and troubleshoot the system without prior knowledge.**

## Acceptance Criteria

1.  ✅ **Runbook:** Includes server access, deployment steps, backup/restore procedures (NFR-M5).
2.  ✅ **Troubleshooting:** Guide covers common failure scenarios (PayPal down, FB stream failure, Email backlog, DB/Redis errors) with resolutions.
3.  ⚠️ **Setup Guide:** First-time setup guide enables deployment from scratch in <4 hours (NFR-M6). **[PARTIALLY MET - Guide complete but not verified on clean VM]**
4.  ⚠️ **Escalation:** Contact list for critical issues. **[PARTIALLY MET - Structure exists with placeholder instructions to add actual contacts]**
5.  ✅ **Format:** Markdown in `/docs` directory.
6.  ✅ **Diagrams:** Architecture and schema diagrams included.

## Tasks / Subtasks

-   [x] **Task 1: Runbook Creation**
    -   [x] Create `docs/RUNBOOK.md`.
    -   [x] Detail SSH access, PM2 commands, service restarts.
-   [x] **Task 2: Troubleshooting Guide**
    -   [x] Create `docs/TROUBLESHOOTING.md` with scenarios from AC.
-   [x] **Task 3: Setup Guide**
    -   [x] Create `docs/SETUP.md` (or refine `README.md`).
    -   [ ] Verify instructions on a clean VM if possible. (Pending)

### Review Follow-ups (AI) - 2026-02-10
-   [ ] [AI-Review][HIGH] Verify setup guide on clean VM to confirm <4 hours deployment time (AC#3)
-   [ ] [AI-Review][HIGH] Add actual emergency contact phone numbers to RUNBOOK.md Section 8 (AC#4)

## Dev Notes
-   **Diagrams:** Use Mermaid or Excalidraw (export to PNG) for diagrams.

### References
-   [Epic 1: Project Foundation](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record
BMad Master (Manual Creation)

### File List
- `docs/RUNBOOK.md`
- `docs/SETUP.md`
- `docs/TROUBLESHOOTING.md`
- `scripts/backup.sh`
- `scripts/test-restore-staging.sh`
- `scripts/create-admin.js`
- `_bmad-output/implementation-artifacts/1-10-operational-documentation-and-runbook.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Deleted:**
- `docs/RUNBOOK_OLD.md` (cleanup - no longer needed)

## Senior Developer Review (AI)
- **Reviewer:** AI (Code Review Workflow)
- **Date:** 2026-02- (Round 1 - Feb 7)
- **Critical:** Fixed missing `migrate` and `create-admin` scripts in `package.json`.
- **Critical:** Created missing `scripts/create-admin.js`.
- **Medium:** Updated `scripts/migrate.js` to use standard environment variables (`DB_HOST`, `DB_USER`, etc.) instead of just `DATABASE_URL`.
- **Medium:** Updated Dev Agent Record with complete file list.
- **High:** Added Redis/cache troubleshooting coverage to meet AC.
- **High:** Added architecture and schema diagrams (Mermaid) to runbook.
- **High:** Fixed backup script DB name default to match setup config.
- **Medium:** Fixed S3 restore script to download using full key.
- **Medium:** Removed insecure default admin credentials; require env vars.
- **Medium:** Added Redis prerequisites/install steps to setup guide.
- **Low:** Fixed runbook log command typo.

### Adversarial Review (Round 2 - Feb 10)
- **Reviewer:** BMad Master (Adversarial Code Review Workflow)
- **Date:** 2026-02-10
- **Findings:** 5 issues found (2 HIGH, 1 MEDIUM, 2 LOW)
- **Outcome:** Fixes applied automatically

#### Fixes Applied Automatically:
- **Critical:** Updated `scripts/backup.sh` to automatically load `.env` variables and export `PGPASSWORD` for authentication.
- **Critical:** Updated `scripts/test-restore-staging.sh` to load `.env` variables.
- **Critical:** Updated `scripts/backup.sh` to use configured `BACKUP_USER` instead of hardcoded `postgres`.
- **Medium:** Added [CRITICAL] alert to `docs/RUNBOOK.md` emphasizing the need to update emergency contact placeholders.

#### Remaining Follow-up Items:
- **High:** AC#3 requires VM verification to confirm <4 hours deployment time (added to tasks)
- **medium:** Manually update emergency contacts in RUNBOOK.md before deployment.

