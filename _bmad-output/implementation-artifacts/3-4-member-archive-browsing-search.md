# Story 3.4: Member Archive Browsing & Search

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a logged-in member,
I want to browse and search the archive of past service recordings,
so that I can watch services I missed or rewatch meaningful moments.

## Acceptance Criteria

1. Given I am a logged-in member, when I navigate to the recording archive page, then I see a searchable list of all published service recordings.
2. The archive displays the latest 52 weeks of recordings by default.
3. Older recordings show a message: "Available on request - contact Rabbi".
4. I can filter recordings by date range.
5. I can filter by Torah portion if applicable.
6. I can filter by service type such as Shabbat, Holiday, or Special Event.
7. I can search by keyword in title or description.
8. Each recording displays thumbnail, date, Rabbi name, Torah portion, duration, and description.
9. Search and filter results return in under 2 seconds.
10. Results are paginated with a maximum of 20 recordings per page, and pagination loads in under 1 second.
11. All search controls are keyboard accessible.
12. The page is fully responsive on mobile, tablet, and desktop.

## Tasks / Subtasks

- [/] Establish the member-facing archive route, controller, and query contract.
  - [ ] Add a protected recordings archive page for authenticated members only.
  - [ ] Use GET query parameters for filters and pagination so server-rendered search state is shareable and keyboard-friendly.
  - [ ] Only surface published recordings from the canonical recording store introduced by Story 3.3.
- [ ] Implement archive querying and filtering in a dedicated service boundary.
  - [ ] Add archive listing/search methods to a recording-focused service rather than putting SQL in controllers.
  - [ ] Support date range, Torah portion, service type, and keyword filters against published recordings.
  - [ ] Restrict default results to the latest 52 weeks and expose an explicit older-recordings notice instead of attempting deep archive browsing.
  - [ ] Paginate results at 20 per page with deterministic newest-first ordering.
- [ ] Build the member archive UI in the existing server-rendered EJS pattern.
  - [ ] Render an accessible filter form with visible labels, keyboard support, and responsive layout.
  - [ ] Render recording cards with thumbnail, date, Rabbi name, Torah portion when present, duration, and description.
  - [ ] Preserve filter state across pagination and empty-state views.
  - [ ] Add a logged-in navigation path to the archive without exposing the page to anonymous visitors.
- [ ] Meet performance and maintainability requirements.
  - [ ] Add or refine database indexes needed for published-recording filtering and sorting if Story 3.3 did not already add them.
  - [ ] Keep the solution metadata-only; never proxy or store video files locally.
  - [ ] Consider cache invalidation strategy for archive responses so newly published recordings appear promptly after Story 3.3 publication flows.
- [ ] Cover the feature with tests.
  - [ ] Add route/integration coverage for authenticated access, unauthenticated rejection, filtering, pagination, and empty states.
  - [ ] Add service tests for query construction and 52-week cutoff behavior.
  - [ ] Add rendering assertions for filter controls, recording metadata, and the older-recordings message.

## Code Review Findings (2026-03-24)

### Decisions Made
- Route mounting: `/archive`
- Database schema: Add `publish_status` column, ensure `first_name`/`last_name` non-nullable
- Recording display: Date display confirmed in template

### Critical Patches

- [ ] [Review][Patch] Mount recordings route at `/archive` not `/recordings/` [src/routes/recordings.js + src/server.js]
  - Route file defines `GET /` but needs to mount at `/archive`. Must update server.js registration and all test references.

- [ ] [Review][Patch] Add `publish_status` column to recordings table [migrations/013_add_service_type_and_indexes.sql]
  - Service queries `WHERE publish_status = $1` but column doesn't exist. Migration must create column with NOT NULL constraint and default 'draft'.

- [ ] [Review][Patch] Ensure `first_name`, `last_name` columns non-nullable [migrations/013_add_service_type_and_indexes.sql]
  - Schema must guarantee Rabbi names exist. Add NOT NULL constraints and populate defaults for existing nulls. Consider foreign key to users table.

- [ ] [Review][Patch] Add `service_date` index for 52-week filter [migrations/013_add_service_type_and_indexes.sql]
  - Most-frequent query filter lacks index. Add `CREATE INDEX idx_recordings_service_date ON recordings(service_date);`

### High-Priority Patches

- [ ] [Review][Patch] Validate date range inputs [src/controllers/recordingController.js:6-20]
  - Add ISO 8601 validation: `if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate))`. Validate `startDate <= endDate`.

- [ ] [Review][Patch] Fix pagination DOS vulnerability [src/controllers/recordingController.js:7]
  - `parseInt()` accepts partial numerics. Use `Number.isInteger()` and cap page to `Math.min(page, Math.ceil(totalCount / 20))`.

- [ ] [Review][Patch] Handle null COUNT result [src/services/RecordingService.js:52]
  - Guard: `const totalCount = countResult.rows.length > 0 ? parseInt(countResult.rows[0].cnt) : 0;`

- [ ] [Review][Patch] Null-safe date rendering [src/views/recordings/index.ejs:22]
  - Fix: `<p class="date"><%= (recording.service_date ? new Date(recording.service_date).toLocaleDateString() : 'Date unavailable') %></p>`

- [ ] [Review][Patch] Null-safe duration rendering [src/views/recordings/index.ejs:27]
  - Fix: `<p class="duration">Duration: <%= (recording.duration_seconds ? Math.floor(recording.duration_seconds / 60) : 'N/A') %> mins</p>`

- [ ] [Review][Patch] Encode date parameters in pagination links [src/views/recordings/index.ejs:44-45]
  - Add `encodeURIComponent()` to `startDate` and `endDate` for consistency.

- [ ] [Review][Patch] Trim whitespace-only search terms [src/services/RecordingService.js:19]
  - Check `if (filters.search && filters.search.trim())` before adding search filter.

- [ ] [Review][Patch] Render error page not JSON [src/controllers/recordingController.js:43]
  - Replace `res.status(500).json({})` with `res.render('error', { message: '...' })` to match server-rendered pattern.

### Medium-Priority Patches

- [ ] [Review][Patch] Fix Rabbi name trailing space [src/views/recordings/index.ejs:23]
  - Use: `(recording.first_name + (recording.last_name ? ' ' + recording.last_name : '')).trim()`

- [ ] [Review][Patch] Rewrite "Available on request" logic [src/views/recordings/index.ejs:49]
  - Current condition `(!filters.startDate || currentPage === 1)` is pagination-based, not age-based. Should show for individual old recordings or as single notice when no results exist for older ranges.

- [ ] [Review][Patch] Add comprehensive edge case tests [__tests__/routes/archiveRoutes.test.js]
  - Missing: `?page=0`, `?page=-1`, `?page=abc`, invalid dates, `startDate > endDate`, empty results, NULL fields, XSS attempts.

### Deferred (Pre-Existing / Out of Scope)

- [x] [Review][Defer] Add responsive CSS/Bootstrap styling [src/views/recordings/index.ejs] — Product/UX decision on styling framework; template structure is ready
- [x] [Review][Defer] Add keyboard navigation & focus management [src/views/recordings/index.ejs] — a11y hardening after template stabilizes
- [x] [Review][Defer] Add performance monitoring & query optimization [src/services/RecordingService.js] — covers AC9/AC10 targets; deferred to perf optimization sprint

## Dev Notes

- This story creates the first member-facing recordings archive browse/search experience. It should consume the published-recording data established by Story 3.3.
- Do not implement full playback or caption rendering here; that belongs to Story 3.5.
- Do not reopen admin publishing workflow decisions from Story 3.3. Treat published recordings as the only eligible archive source.
- Keep search server-rendered and query-string driven. That matches the existing MPA architecture, improves accessibility, and avoids introducing a JS-heavy client state layer for a simple archive listing.

### Technical Requirements

- Require authentication for the archive page. The story is explicitly for logged-in members, not public visitors.
- Query only published recordings and sort newest first.
- Default archive scope is the most recent 52 weeks of recordings. Older items are not listed; instead, show the required support message.
- Support the following filters at minimum:
  - date range
  - Torah portion
  - service type
  - keyword search across title and description
- Return a maximum of 20 results per page.
- Meet NFR-P3 targets: search/filter response under 2 seconds and pagination transition under 1 second.
- Render metadata only: thumbnail URL, external provider link or identifier, date, Rabbi, Torah portion, duration, description. Do not store or serve local video binaries.
- If Story 3.3 did not add sufficient indexing for published/date/service-type lookups, add the required database indexes in this story.

### Architecture Compliance

- Stay inside the existing monolith pattern: route -> controller -> service -> database.
- Keep filtering/search logic out of EJS templates and out of raw route handlers.
- Preserve the server-rendered page model already used throughout the app; do not introduce a SPA or client-side search framework.
- Prefer a dedicated recordings service boundary. If Story 3.3 introduced RecordingService, extend it; otherwise add a focused recording/archive service instead of overloading unrelated modules.
- Keep access control simple and explicit with existing auth/session middleware.
- Align with graceful degradation patterns: archive listing should continue to work even if live-stream integrations are temporarily unavailable, because archive browsing relies on persisted metadata rather than active provider state.

### Library / Framework Requirements

- Use the current stack only: Node.js, Express, EJS, PostgreSQL, and existing middleware.
- Reuse existing auth and session middleware patterns from protected pages.
- Reuse existing layout and navigation structure rather than introducing a parallel shell.
- Do not add a frontend framework or third-party search library for this story.
- Prefer PostgreSQL query/index improvements over external search infrastructure.

### File Structure Requirements

- Likely touch points:
  - src/server.js
  - src/views/layout.ejs
  - src/services/RecordingService.js or src/services/StreamingService.js
  - __tests__/integration or __tests__/routes for archive page coverage
- Likely new modules:
  - src/routes/recordings.js
  - src/controllers/recordingController.js
  - src/views/recordings/index.ejs
  - __tests__/routes/recordings.test.js or __tests__/integration/archiveRoutes.test.js
  - __tests__/services/RecordingService.test.js
- If Story 3.3 already introduced route/controller/service names for recordings, extend those exact modules instead of creating duplicates.
- If a migration is required for search indexes only, create a new migration rather than editing an existing migration file.

### Testing Requirements

- Test authenticated member access to the archive page.
- Test unauthenticated users are redirected or blocked consistently with existing protected-page behavior.
- Test that only published recordings are shown.
- Test default 52-week cutoff behavior.
- Test each filter independently and in combination.
- Test keyword search against title and description fields.
- Test pagination size, ordering, and filter persistence between pages.
- Test empty-state rendering and the "Available on request - contact Rabbi" message.
- Test responsive markup and keyboard-accessible filter controls at the rendered HTML level where practical.

### Previous Story Intelligence

- Story 3.3 is the direct dependency: it establishes the canonical published-recording workflow and likely introduces the recording metadata store this story must query.
- Story 3.3 also reserved member archive browsing/search for this story, so do not duplicate admin publication concerns here.
- Story 3.1 and Story 3.2 established the Epic 3 pattern of metadata-driven streaming features with graceful fallback behavior. Continue that approach by relying on persisted recording metadata rather than live provider calls for archive browsing.

### Git Intelligence Summary

- Recent repo work has stayed in the established route/controller/service/view pattern, with Epic 2 hardening driven by code review rather than major architecture changes.
- The latest relevant commit titles are: `re-review of 2.7`, `second pass cr`, `Fix: Story 2.7 Security & Code Review Issues`, `first pass 2.7`, and `random fixes for 2.3`.
- That pattern suggests Story 3.4 should prioritize clear boundaries, good tests, and minimal surface area over ambitious new infrastructure.

### Project Structure Notes

- Public pages currently use dedicated route modules mounted in src/server.js, while protected account settings still live in src/routes/pages.js. Because the archive is a larger feature surface with its own filters and pagination, prefer a dedicated recordings route module mounted in src/server.js.
- The global layout already exposes authenticated-only navigation state via `user` and `currentPath`, so adding a logged-in `Recordings` nav entry should fit current patterns.
- The app already applies global session tracking and uses explicit `requireAuth` on protected page routes. Follow that same pattern for the archive page.
- No archive-specific source files currently exist in src, which means this story should establish the canonical member archive route/controller/view naming instead of scattering archive code across unrelated modules.
- Existing tests show a mix of route integration tests and controller unit tests. Mirror that split here rather than relying on only one test layer.

### References

- Source: _bmad-output/planning-artifacts/epics.md, Story 3.4 Member Archive Browsing & Search
- Source: _bmad-output/planning-artifacts/prd.md, FR4, FR5, FR13, FR114, FR117, NFR-P3
- Source: _bmad-output/planning-artifacts/architecture.md, Recording Management support and performance validation
- Source: _bmad-output/planning-artifacts/architecture.md, Graceful Integration Degradation fallback pattern
- Source: _bmad-output/planning-artifacts/ux-design-specification.md, Post-Service Value Moment
- Source: _bmad-output/planning-artifacts/ux-design-specification.md, Recording Archive Card
- Source: _bmad-output/implementation-artifacts/3-3-rabbi-publishes-recording-to-archive.md
- Source: src/server.js
- Source: src/routes/pages.js
- Source: src/views/layout.ejs
- Source: src/controllers/adminController.js
- Source: src/routes/admin/dashboard.js
- Source: src/services/userService.js
- Source: src/services/auditService.js
- Source: __tests__/routes/home.test.js
- Source: __tests__/controllers/homeController.test.js

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- Sprint status selected Story 3.4 as the next backlog story after Stories 3.1 through 3.3 were prepared.
- Repository search found no existing archive or recording route/controller implementation in src, indicating this story establishes the first member archive surface.
- Existing protected-page, admin, and layout patterns were reviewed to ground the route mount, auth, and navigation recommendations.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story 3.4 is explicitly scoped to member browsing/search only and keeps playback concerns for Story 3.5.
- The recommended implementation path is a dedicated protected recordings route with server-rendered filtering, pagination, and metadata-only cards.

### File List

- _bmad-output/implementation-artifacts/3-4-member-archive-browsing-search.md
