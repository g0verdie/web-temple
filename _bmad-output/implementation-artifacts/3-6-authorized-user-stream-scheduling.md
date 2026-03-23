# Story 3.6: Authorized User Stream Scheduling

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authorized user (Rabbi or Admin),
I want to schedule and initiate Facebook Live broadcasts for upcoming services,
so that the community knows when services will be streamed live.

## Acceptance Criteria

1. Given I am logged in with authorized streaming permissions, when I navigate to the streaming management page in the admin dashboard, then I can create a scheduled broadcast with service date, time, and title.
2. I can link the Facebook Live stream URL once it is created on Facebook.
3. The scheduled broadcast appears on the homepage with a countdown timer.
4. I can update or cancel scheduled broadcasts before they start.
5. When the Facebook Live goes active, the homepage automatically displays the stream.
6. The broadcast schedule is synced with the public calendar.
7. All streaming actions are logged in the audit trail.
8. The interface includes clear instructions for Facebook Live setup.
9. The form is keyboard accessible and mobile-friendly.

## Tasks / Subtasks

- [ ] Establish the admin streaming management workflow.
  - [ ] Add a streaming management page under the admin area for Rabbi/Admin users.
  - [ ] Reuse existing admin auth/session patterns and align authorization with current Rabbi/Admin access rules.
  - [ ] Decide whether streaming uses an existing calendar permission or requires a new dedicated streaming permission, and document that choice in the implementation.
- [ ] Add a canonical scheduled-stream data model and service boundary.
  - [ ] Persist scheduled stream metadata such as title, service date/time, provider URL, status, and linkage to the corresponding service/calendar event.
  - [ ] Encapsulate scheduling, update, cancellation, and activation logic in a streaming-focused service rather than spreading it across controllers.
  - [ ] Support state transitions such as scheduled, active, canceled, and completed.
- [ ] Connect scheduled streams to homepage and calendar behavior.
  - [ ] Ensure the next scheduled service on the homepage can source countdown and stream metadata from the scheduling workflow.
  - [ ] Keep homepage countdown and active-stream display aligned so the site can move cleanly from upcoming to live state.
  - [ ] Sync scheduled broadcasts with the public calendar rather than creating an unrelated parallel schedule source.
- [ ] Build an accessible admin form and operator guidance.
  - [ ] Provide clear form fields for service date/time, title, and Facebook Live URL.
  - [ ] Include concise setup instructions so Rabbi/Admin users know what to create in Facebook and what to paste into the site.
  - [ ] Ensure the management UI is keyboard accessible, touch-friendly, and usable on mobile.
- [ ] Add auditability and regression coverage.
  - [ ] Log create, update, cancel, and activation actions in the audit trail with relevant before/after state where practical.
  - [ ] Add tests for admin authorization, scheduling success, homepage countdown integration, calendar synchronization, update/cancel flows, and audit logging.

## Dev Notes

- This story completes Epic 3’s live-stream lifecycle by adding the scheduling/admin setup surface that feeds Stories 3.1 and 3.2 on the homepage and aligns with recording workflows in Stories 3.3 through 3.5.
- Do not build direct Facebook API orchestration unless the implementation truly requires it. The acceptance criteria only require site-side scheduling metadata plus the ability to link the Facebook Live URL once created on Facebook.
- Favor explicit scheduling state over implicit homepage heuristics. The homepage should not infer live/upcoming solely from loose event data if a canonical stream-schedule record exists.
- Calendar synchronization is part of the scope, which means this story should integrate with the service/event model instead of creating a separate, unsynced broadcast calendar.

### Technical Requirements

- Authorized users are Rabbi and Admin for this story. Social Chair is not included unless the implementation intentionally expands permission scope later.
- Scheduled broadcasts need, at minimum, title, service date/time, Facebook Live URL, status, and linkage to the corresponding service or calendar event.
- The homepage countdown must use the scheduled service/broadcast timing in a way consistent with existing next-service rendering.
- When a broadcast becomes active, homepage rendering must be able to switch from countdown/upcoming display to active-stream display without relying on manual template edits.
- Scheduling, updating, and canceling broadcasts should complete within the project’s admin-operation responsiveness expectations.
- Streaming actions must be audit logged in an append-only manner consistent with NFR-S8.
- If the current RBAC model is too coarse, add the smallest permission expansion needed instead of bypassing permission checks in route logic.

### Architecture Compliance

- Stay within the monolith flow: route -> controller -> service -> database/cache.
- Place streaming logic in a streaming-focused service boundary, consistent with the architecture’s `StreamingService (Facebook API, recording metadata)` direction.
- Avoid hiding stream schedule state inside homepage templates or hard-coded EventService arrays.
- Integrate with calendar/service data rather than maintaining two competing sources of truth for upcoming services.
- Keep the homepage consumer simple: it should read normalized scheduling state from a service layer, not perform complex scheduling logic itself.
- Reuse admin dashboard routing patterns and current auth/session middleware rather than inventing a parallel admin app.

### Library / Framework Requirements

- Use the existing Node.js, Express, EJS, PostgreSQL, and current middleware stack.
- Reuse existing RBAC, audit, and caching infrastructure.
- Do not introduce a frontend admin framework for scheduling.
- Prefer extending existing services such as EventService or adding a dedicated StreamingService/StreamScheduleService over mixing logic into controllers.
- If Facebook-specific validation is needed, use the current HTTP/service approach rather than a large SDK dependency unless there is a concrete need.

### File Structure Requirements

- Likely touch points:
  - src/server.js
  - src/controllers/homeController.js
  - src/services/EventService.js
  - src/views/home.ejs
  - src/views/admin/dashboard.ejs
  - src/routes/admin/dashboard.js
  - src/config/roles-permissions.js
  - src/services/auditService.js
- Likely new modules:
  - src/controllers/streamingController.js or expanded admin controller support
  - src/routes/admin/streaming.js
  - src/services/StreamingService.js or src/services/StreamScheduleService.js
  - src/views/admin/streaming/*.ejs
  - migrations/<new stream schedule table migration>.sql if persistence is not folded into an existing event model
  - __tests__/controllers/streamingController.test.js
  - __tests__/integration/streamingRoutes.test.js or matching admin integration coverage
- If stream scheduling is represented as an extension of service/calendar events, keep that relationship explicit in naming and persistence design.

### Testing Requirements

- Test Rabbi/Admin access to streaming management routes.
- Test unauthorized roles cannot schedule or modify streams.
- Test create, update, and cancel flows for scheduled broadcasts.
- Test homepage countdown consumes scheduled stream/service timing correctly.
- Test activation/live-state handoff logic for homepage display.
- Test calendar synchronization behavior so scheduled streams remain aligned with the public service schedule.
- Test audit log side effects for create, update, cancel, and activation actions.
- Test mobile-friendly and keyboard-accessible admin form markup where practical.

### Previous Story Intelligence

- Story 3.1 established homepage embed behavior and tied live display to the home controller/view path.
- Story 3.2 established explicit stream-state modeling and graceful display behavior for live, upcoming, offline, and error states.
- Stories 3.3 through 3.5 established the broader streaming/recording lifecycle, but they assume scheduling and activation will eventually provide canonical upstream stream metadata.
- This story should therefore define the source of truth for upcoming/live stream scheduling rather than bolting more logic into the homepage alone.

### Git Intelligence Summary

- Recent repo work remains centered on the established route/controller/service/view pattern with review-driven hardening.
- The latest relevant commit titles are: `re-review of 2.7`, `second pass cr`, `Fix: Story 2.7 Security & Code Review Issues`, `first pass 2.7`, and `random fixes for 2.3`.
- That pattern favors a conservative implementation with clear service boundaries, narrow permission changes, and strong tests over speculative platform abstractions.

### Project Structure Notes

- The current homepage countdown depends on EventService and static service/event data. Story 3.6 should replace or extend that seam with canonical scheduled-stream-aware data, not duplicate countdown logic elsewhere.
- Admin dashboard routes already provide the protected mount point and session/RBAC pattern for Rabbi/Admin tools.
- Existing RBAC has `MANAGE_CALENDAR` but no streaming-specific permission, so implementation should deliberately choose whether stream scheduling belongs under calendar management or merits a new permission constant.
- AuditService already has calendar action types but no streaming action types, which strongly suggests extending audit constants for scheduling actions in this story.
- There is no current stream scheduling route, service, or persistence layer in src, so this story establishes the canonical names and boundaries for that area.

### References

- Source: _bmad-output/planning-artifacts/epics.md, Story 3.6 Authorized User Stream Scheduling
- Source: _bmad-output/planning-artifacts/prd.md, FR8, NFR-P5, NFR-S8
- Source: _bmad-output/planning-artifacts/architecture.md, service layer structure and StreamingService guidance
- Source: _bmad-output/implementation-artifacts/3-1-facebook-live-stream-embed.md
- Source: _bmad-output/implementation-artifacts/3-2-stream-status-display-error-handling.md
- Source: src/controllers/homeController.js
- Source: src/services/EventService.js
- Source: src/config/roles-permissions.js
- Source: src/views/home.ejs
- Source: src/views/admin/dashboard.ejs
- Source: src/routes/admin/dashboard.js
- Source: src/services/auditService.js
- Source: __tests__/integration/adminRoutes.test.js

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- Sprint status selected Story 3.6 as the next backlog story after Stories 3.1 through 3.5 were prepared.
- Repository inspection found homepage countdown/service seams, admin dashboard mounts, and calendar-oriented RBAC, but no existing stream scheduling implementation.
- The story therefore frames scheduling as a new canonical streaming admin workflow that must integrate with homepage and calendar state rather than sit beside them.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story 3.6 completes Epic 3’s context set by defining the authorized scheduling and activation workflow for livestreams.
- The story explicitly calls out RBAC, audit, homepage, and calendar integration decisions that are not yet represented in the current codebase.

### File List

- _bmad-output/implementation-artifacts/3-6-authorized-user-stream-scheduling.md
