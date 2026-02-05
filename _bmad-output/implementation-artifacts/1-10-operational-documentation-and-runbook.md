# Story 1.10: Operational Documentation & Runbook

**Story ID:** 1.10
**Status:** ready-for-dev

## Story

As a **successor developer or system administrator**,
I want **comprehensive operational documentation and troubleshooting guides**,
so that **I can maintain and troubleshoot the system without prior knowledge.**

## Acceptance Criteria

1.  **Runbook:** Includes server access, deployment steps, backup/restore procedures (NFR-M5).
2.  **Troubleshooting:** Guide covers common failure scenarios (PayPal down, FB stream failure, Email backlog, DB/Redis errors) with resolutions.
3.  **Setup Guide:** First-time setup guide enables deployment from scratch in <4 hours (NFR-M6).
4.  **Escalation:** Contact list for critical issues.
5.  **Format:** Markdown in `/docs` directory.
6.  **Diagrams:** Architecture and schema diagrams included.

## Tasks / Subtasks

-   [ ] **Task 1: Runbook Creation**
    -   [ ] Create `docs/RUNBOOK.md`.
    -   [ ] Detail SSH access, PM2 commands, service restarts.
-   [ ] **Task 2: Troubleshooting Guide**
    -   [ ] Create `docs/TROUBLESHOOTING.md` with scenarios from AC.
-   [ ] **Task 3: Setup Guide**
    -   [ ] Create `docs/SETUP.md` (or refine `README.md`).
    -   [ ] Verify instructions on a clean VM if possible.

## Dev Notes
-   **Diagrams:** Use Mermaid or Excalidraw (export to PNG) for diagrams.

### References
-   [Epic 1: Project Foundation](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record
BMad Master (Manual Creation)
