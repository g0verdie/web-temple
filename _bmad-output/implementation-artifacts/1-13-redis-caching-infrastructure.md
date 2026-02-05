# Story 1.13: Redis Caching Infrastructure

**Story ID:** 1.13
**Status:** ready-for-dev

## Story

As a **developer**,
I want **Redis caching for frequently accessed data**,
so that **database load is reduced and page performance improves.**

## Acceptance Criteria

1.  **Caching Implemented:**
    -   Archive queries (15m TTL)
    -   Calendar events (5m TTL)
    -   Announcements (2m TTL)
    -   Static content (10m TTL)
2.  **Invalidation:** Cache invalidated on updates.
3.  **Keys:** Consistent naming convention (`cache:resource:id`).
4.  **Hit Rate:** >70% target.
5.  **Resilience:** Fail gracefully if Redis down (fetch from DB).
6.  **Persistence:** Redis RDB enabled.

## Tasks / Subtasks

-   [ ] **Task 1: Redis Setup**
    -   [ ] Verify Redis connection in `src/config/redis.js`.
-   [ ] **Task 2: Middleware**
    -   [ ] Create `cacheMiddleware` or service wrapper.
-   [ ] **Task 3: Implementation**
    -   [ ] Wrap `AnnouncementService.getAll`, `EventService.getEvents`, etc.
    -   [ ] Add invalidation hooks in `create/update/delete` methods.
-   [ ] **Task 4: Metrics**
    -   [ ] Log cache hits/misses.

## Dev Notes
-   **Library:** `ioredis` or `node-redis`.

### References
-   [Epic 1: Project Foundation](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record
BMad Master (Manual Creation)
