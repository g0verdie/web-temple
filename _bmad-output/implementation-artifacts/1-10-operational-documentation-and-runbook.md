# Story 1.10: Operational Documentation & Runbook

**Story ID:** 1.10
**Status:** in-progress

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
- **Findings:** 16 issues found (7 HIGH, 5 MEDIUM, 3 LOW)
- **Outcome:** In progress - auto-fixed 14 issues, 2 require manual follow-up

#### Fixes Applied Automatically:
- **High:** Added `BACKUP_ENCRYPTION_KEY` to SETUP.md .env configuration with generation instructions
- **High:** Added Redis to External Services prerequisites section with planning guidance
- **High:** Added error handling for missing `BACKUP_ENCRYPTION_KEY` in test-restore-staging.sh
- **High:** Replaced [REDACTED] contact placeholders with [UPDATE] instructions in RUNBOOK.md
- **Medium:** Deleted orphaned `docs/RUNBOOK_OLD.md` file (git cleanup)
- **Medium:** Standardized path references to `/opt/temple` with adjustment note in RUNBOOK.md
- **Medium:** Added Ubuntu-specific note about commands to prerequisites section
- **Medium:** Added verification step after npm install in SETUP.md
- **Medium:** Added example error patterns to TROUBLESHOOTING.md for easier diagnosis
- **Low:** Updated SETUP.md version from 1.0 to 1.1 to match RUNBOOK.md
- **Low:** Confirmed SETUP.md SSL section is complete (verified through line 1357)

#### Remaining Follow-up Items:
- **High:** AC#3 requires VM verification to confirm <4 hours deployment time (added to tasks)
- **High:** AC#4 requires actual emergency phone numbers (placeholders with instructions added)ownload using full key.
- **Medium:** Removed insecure default admin credentials; require env vars.
- **Medium:** Added Redis prerequisites/install steps to setup guide.
- **Low:** Fixed runbook log command typo.

