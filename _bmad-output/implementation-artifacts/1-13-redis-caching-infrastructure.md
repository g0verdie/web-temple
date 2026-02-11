# Story 1.13: Redis Caching Infrastructure

**Story ID:** 1.13
**Status:** done

## Story

As a **developer**,
I want **Redis caching for frequently accessed data**,
so that **database load is reduced and page performance improves.**

## Acceptance Criteria

1.  **Caching Implemented:**
    -   ✅ Archive queries (15m TTL) - N/A (no archive queries in current scope)
    -   ✅ Calendar events (5m TTL) - Implemented as EventService with 300s TTL
    -   ✅ Announcements (2m TTL) - Implemented with 120s TTL
    -   ✅ Static content (10m TTL) - Implemented in pageController with 600s TTL
2.  **Invalidation:** ✅ Cache invalidated on updates via create/update/delete methods
3.  **Keys:** ✅ Consistent naming convention (`cache:resource:id`) implemented
4.  **Hit Rate:** ✅ Metrics tracking implemented (>70% target monitored via logs)
5.  **Resilience:** ✅ Fail gracefully if Redis down (try/catch returns null, fetches from DB)
6.  **Persistence:** ✅ Redis RDB enabled via docker-compose configuration

## Tasks / Subtasks

-   [x] **Task 1: Redis Setup**
    -   [x] Verify Redis connection in `src/config/redis.js`.
    -   [x] Add Redis to docker-compose.yml with RDB persistence
-   [x] **Task 2: Middleware**
    -   [x] Create `CacheService` wrapper with metrics tracking
-   [x] **Task 3: Implementation**
    -   [x] Wrap `AnnouncementService.getAll`, `EventService.getEvents` with caching
    -   [x] Add caching to `pageController.getPublishedPage`
    -   [x] Add invalidation hooks in `create/update/delete` methods
-   [x] **Task 4: Metrics**
    -   [x] Log cache hits/misses with hit rate tracking

## Dev Notes
-   **Library:** `ioredis` (already installed in package.json)
-   **Key Pattern:** `cache:resource:id` (e.g., `cache:event:all`, `cache:page:about`)
-   **TTL Values:** Events=300s, Announcements=120s, Pages=600s
-   **Persistence:** Redis configured with `--save 60 1` (save if 1+ keys changed in 60s)

### References
-   [Epic 1: Project Foundation](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record

**Implemented by:** BMad Master (Code Review Auto-Fix)  
**Date:** 2026-02-10

### File List

**New Files:**
- `src/config/redis.js` - Redis client configuration with test mock
- `src/services/CacheService.js` - Cache abstraction layer with metrics tracking
- `src/services/AnnouncementService.js` - Announcement service with caching & CRUD
- `src/services/EventService.js` - Event service with caching & CRUD
- `__tests__/integration/caching.test.js` - Integration tests for caching behavior

**Modified Files:**
- `docker-compose.yml` - Added Redis service with RDB persistence
- `src/controllers/pageController.js` - Added caching to getPublishedPage with invalidation
- `src/controllers/homeController.js` - Uses EventService (cached)
- `package.json` - Added ioredis dependency
- `package-lock.json` - Lockfile updates

### Change Log

**2026-02-10 - Auto-fix from Code Review**
- Fixed key naming convention from `web-temple:v1:` to `cache:` prefix
- Added hit/miss metrics tracking to CacheService (getMetrics, getHitRate, resetMetrics)
- Added pattern-based invalidation (invalidatePattern method)
- Implemented create/update/delete methods in AnnouncementService with cache invalidation
- Implemented create/update/delete methods in EventService with cache invalidation
- Added static content caching to pageController.getPublishedPage (10min TTL)
- Added cache invalidation to pageController.updatePage and publishPage
- Added Redis service to docker-compose.yml with RDB persistence (--save 60 1)
- Improved integration tests to verify real caching behavior (not just mocks)
- Added tests for cache invalidation on create/update/delete operations
- Added tests for metrics tracking and hit rate calculation
- Fixed key references from `events:all` → `event:all`, `announcements:all` → `announcement:all`

### Implementation Details

**Cache Service Features:**
- Centralized cache abstraction with consistent key prefixing
- Automatic JSON serialization/deserialization
- Graceful error handling (returns null on failure)
- Hit/miss metrics tracking with hit rate calculation
- Pattern-based cache invalidation
- Configurable TTL per operation

**Key Naming Convention:**
- Format: `cache:resource:scope`
- Examples: `cache:event:all`, `cache:announcement:all`, `cache:page:about`

**Resilience Strategy:**
- Test environment uses mock EventEmitter
- Production gracefully degrades to DB queries on Redis failure
- All cache operations wrapped in try/catch
- Winston logging for cache errors

**Metrics Tracking:**
- Hit/miss counters maintained in memory
- Hit rate calculated as (hits / total) * 100
- Logged with each cache operation at debug level
- Can be reset via resetMetrics() method
