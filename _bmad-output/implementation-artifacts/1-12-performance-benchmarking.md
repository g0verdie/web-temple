# Story 1.12: Performance Benchmarking & Optimization

**Story ID:** 1.12
**Status:** ready-for-dev

## Story

As a **developer**,
I want **to measure and optimize performance against NFR targets**,
so that **the website loads quickly and provides a responsive user experience.**

## Acceptance Criteria

1.  **Load Time:** Homepage loads primary content in <2s (5G) (NFR-P1).
2.  **Lighthouse:** Score >90 for all public pages.
3.  **FCP:** First Contentful Paint <3s (NFR-P6).
4.  **API:** Response times <500ms (NFR-P2).
5.  **Database:** Queries optimized with indexes.
6.  **Assets:** Images optimized (WebP), JS minified/split, CSS minimized.
7.  **Testing:** Performance tests run via Lighthouse CI.

## Tasks / Subtasks

-   [ ] **Task 1: Baseline Measurement**
    -   [ ] Run Lighthouse on key pages. Record results.
-   [ ] **Task 2: Backend Optimization**
    -   [ ] Analyze slow queries with `EXPLAIN ANALYZE`. Add indexes.
    -   [ ] Verify N+1 problems in ORM.
-   [ ] **Task 3: Frontend Optimization**
    -   [ ] Implement image optimization pipeline (if not present).
    -   [ ] Verify bundle sizes.
-   [ ] **Task 4: CI Integration**
    -   [ ] Add Lighthouse CI to build process.

## Dev Notes
-   **Tools:** Lighthouse, Chrome DevTools, `pg_stat_statements`.

### References
-   [Epic 1: Project Foundation](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record
BMad Master (Manual Creation)
