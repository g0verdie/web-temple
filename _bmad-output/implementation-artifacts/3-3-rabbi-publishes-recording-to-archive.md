# Story 3.3: Rabbi Publishes Recording to Archive

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the Rabbi,
I want to manually publish recorded services to the archive after the livestream ends,
so that members can watch past services on-demand.

## Acceptance Criteria

1. Given I am logged in as Rabbi and a service recording has finished, when I navigate to the admin dashboard recordings section, then I see a list of unpublished Facebook recordings from recent livestreams.
2. For each recording, I can add metadata: service date, Torah portion optional, and duration.
3. I can preview the recording before publishing.
4. When I click Publish, the recording is saved to the database with metadata.
5. The recording becomes visible in the member archive within 5 minutes.
6. Members receive an email notification that a new recording is available.
7. The publish action is recorded in the audit log.
8. I receive confirmation that the recording was published successfully.
9. The form includes auto-save every 30 seconds to prevent data loss.

## Tasks / Subtasks

- [ ] Establish recording persistence and unpublished/published workflow in the backend.
  - [ ] Add a recording metadata model/table and service abstraction if one does not already exist.
  - [ ] Store provider identifiers and metadata only: external video URL or provider ID, service date, title, duration, Torah portion, description if needed, publish state, and timestamps.
  - [ ] Support an unpublished-to-published transition rather than treating published recordings as ad hoc content.
- [ ] Build an admin recordings workflow for Rabbi/Admin users.
  - [ ] Add a recordings section reachable from the existing admin dashboard flow.
  - [ ] List unpublished recent provider recordings in a Rabbi-safe UI with clear publish actions.
  - [ ] Provide preview capability before publish without requiring the Rabbi to leave the admin experience.
- [ ] Implement metadata entry and draft protection.
  - [ ] Allow metadata editing for service date, Torah portion optional, and duration before publish.
  - [ ] Add auto-save or draft-preservation behavior consistent with the project’s Rabbi safety-net UX expectations.
  - [ ] Keep form complexity low and success/error states explicit.
- [ ] Wire publish side effects.
  - [ ] On publish, persist metadata and mark the recording visible to the future archive surface.
  - [ ] Log the publish action with audit details.
  - [ ] Queue member notification emails using existing notification preference handling for recordings.
  - [ ] Ensure the workflow is capable of meeting the <5 minute publication visibility requirement.
- [ ] Cover the workflow with tests.
  - [ ] Add unit coverage for recording service behavior and publish transitions.
  - [ ] Add route/controller coverage for admin authorization, metadata validation, publish success, and failure paths.
  - [ ] Add regression tests for notification fanout respecting `recordings` preferences and audit logging side effects.

## Dev Notes

- This story creates the admin-side publication workflow only. It should not implement the full member archive browsing/search UI from Story 3.4 or the playback experience from Story 3.5.
- Story 3.1 and 3.2 established public viewing/status behavior. This story is the first admin-heavy recording workflow in Epic 3 and should introduce the backend and admin seams cleanly.
- Favor explicit publish-state transitions over implicit “available if it exists” logic. The Rabbi must decide when a recording becomes member-visible.

### Technical Requirements

- Use a dedicated service boundary such as `StreamingService` or `RecordingService` for provider retrieval and publish logic. Do not bury recording publication rules inside controller code.
- Persist metadata in PostgreSQL. Current repository evidence does not show an existing recordings table, so this story likely requires a new migration.
- Store provider metadata and references only. Do not store video files locally.
- Publication must make the recording visible to the future archive within 5 minutes, which implies fast persistence plus cache invalidation rather than long async pipelines.
- Use the existing email queue infrastructure for member notification instead of direct email sends in request handlers.
- Respect existing per-user notification preferences, which already include a `recordings` flag.
- Audit publication with a dedicated action type. Existing audit action constants do not currently include recording publication, so this story likely needs to extend audit action coverage.
- Ensure RBAC is enforced so only Rabbi/Admin roles can access and publish recordings.

### Architecture Compliance

- Stay within the API-first monolith pattern: route -> controller -> service -> DB/queue.
- Recording workflow belongs to a service boundary aligned with the architecture’s `StreamingService (Facebook API, recording metadata)` direction.
- Reuse existing admin route/middleware patterns rather than inventing a parallel admin auth path.
- Follow graceful integration degradation: provider fetch failures should surface as manageable admin states, not crash the admin dashboard.
- Use async queue-backed notification dispatch and cache invalidation consistent with current platform patterns.

### Library / Framework Requirements

- Runtime stack remains Node.js 18+, Express 4.x, EJS views, PostgreSQL, Redis-backed queue/cache.
- Reuse existing `emailQueueService`, `auditService`, and RBAC middleware rather than replacing them.
- Reuse the existing notification preference support in user service/data model for recording notifications.
- Do not introduce a new admin frontend framework. Stay with server-rendered EJS plus small targeted JS only where necessary.
- If provider retrieval is needed, prefer the existing HTTP stack and service abstraction over adding SDK-heavy dependencies.

### File Structure Requirements

- Likely touch points:
  - src/controllers/adminController.js or a new focused recordings admin controller
  - src/routes/admin/dashboard.js or a new admin recordings route module
  - src/services/auditService.js
  - src/services/emailQueueService.js
  - src/views/admin/dashboard.ejs or new admin recordings views
  - __tests__/controllers/adminController.test.js
  - __tests__/integration/adminRoutes.test.js or similar admin integration coverage
- Likely new modules:
  - src/services/RecordingService.js or expansion of src/services/StreamingService.js
  - migrations/<new recording table migration>.sql
  - src/views/admin/recordings/*.ejs or equivalent
  - __tests__/services/RecordingService.test.js
- Follow the publish/unpublish workflow style already used for static pages where appropriate, but do not force recordings into the page CMS model.

### Testing Requirements

- Test admin authorization for viewing and publishing recordings.
- Test unpublished recording listing and publish transition behavior.
- Test metadata validation for required and optional fields.
- Test audit log side effects on publish.
- Test recording notification queueing only for users with `recordings` notifications enabled.
- Test visibility state transitions so future archive consumers can rely on a published flag/state.
- If cache invalidation is introduced, test that it is triggered on publish.

### Previous Story Intelligence

- Story 3.1 established that streaming/video work must remain metadata-only and service-driven.
- Story 3.2 established server-owned status modeling and graceful fallback patterns that still apply here when provider data is unavailable.
- Both prior stories emphasized not dragging later archive playback/search scope into earlier implementation. That warning remains active here: create the published-recording data and admin workflow, not the entire member archive experience.

### Git Intelligence Summary

- Recent application work has been concentrated in Epic 2 auth/account flows. The dominant repo pattern remains route/controller/service layering with tests and review-driven hardening.
- Existing admin/dashboard/page publishing code is the closest implementation analogue for a publish workflow. Reuse those structural patterns, but keep recordings as a domain-specific workflow rather than static content.

### Project Structure Notes

- Existing admin routing already supports dashboard and audit log flows via RBAC-protected routes.
- Existing email queue infrastructure is ready for notification fanout and retries.
- Existing audit service supports many action types but not recording-publication-specific events yet.
- Existing user preference plumbing already includes `recordings`, which is a strong signal to wire publication notifications through current preference-aware patterns.
- No current recording persistence surface was detected in migrations or app services, so this story likely introduces the first canonical recording metadata store.

### References

- Source: _bmad-output/planning-artifacts/epics.md, Story 3.3 Rabbi Publishes Recording to Archive
- Source: _bmad-output/planning-artifacts/prd.md, FR12, FR13, FR84, FR110, NFR-P4
- Source: _bmad-output/planning-artifacts/prd.md, Capability Area 17 Service Recording Management
- Source: _bmad-output/planning-artifacts/architecture.md, Recording Management and StreamingService guidance
- Source: _bmad-output/planning-artifacts/architecture.md, Graceful Integration Degradation fallback to last published recording
- Source: _bmad-output/planning-artifacts/ux-design-specification.md, Rabbi safety-net and recording backup guidance
- Source: _bmad-output/implementation-artifacts/3-1-facebook-live-stream-embed.md
- Source: _bmad-output/implementation-artifacts/3-2-stream-status-display-error-handling.md
- Source: src/controllers/adminController.js
- Source: src/routes/admin/dashboard.js
- Source: src/services/emailQueueService.js
- Source: src/services/auditService.js
- Source: src/services/userService.js
- Source: migrations/009_add_notification_preferences_to_users.sql

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- Sprint status selected the next backlog story as 3-3-rabbi-publishes-recording-to-archive.
- Prior Epic 3 context artifacts already established metadata-only streaming guardrails and scope boundaries.
- Current codebase has admin routing, email queueing, and audit logging primitives, but no existing recordings persistence workflow was found.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Recording publication is framed as a first-class admin workflow with explicit persistence, audit, and notification side effects.
- Archive browsing and playback scope remain reserved for Stories 3.4 and 3.5.

### File List

- _bmad-output/implementation-artifacts/3-3-rabbi-publishes-recording-to-archive.md
