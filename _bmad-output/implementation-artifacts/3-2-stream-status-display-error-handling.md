# Story 3.2: Stream Status Display & Error Handling

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a website visitor,
I want to see the current stream status clearly,
so that I know whether a service is live, upcoming, or offline.

## Acceptance Criteria

1. Given I am on the homepage, when I view the live stream section, then I see a clear status indicator: LIVE NOW, Starting in [countdown], or Offline.
2. If the stream is upcoming, I see a countdown timer to the scheduled start time.
3. If the Facebook Live stream becomes unavailable during service, I see a graceful error message.
4. The error message directs me to the Facebook page as an alternative viewing option.
5. If the stream is offline, I see a message inviting me to view past recordings.
6. The status updates automatically every 30 seconds without requiring page refresh.
7. All status messages are screen reader accessible and use sufficient contrast.

## Tasks / Subtasks

- [x] Extend the streaming service contract to expose status-oriented public state.
  - [x] Add normalized states for `live`, `upcoming`, `offline`, and `error`.
  - [x] Include only the data needed by the homepage: status label, scheduled start, countdown target, fallback Facebook URL, archive CTA flag, and user-facing message copy.
  - [x] Keep provider-specific logic inside the streaming service instead of controller/view templates.
- [x] Add homepage status rendering on top of the Story 3.1 embed foundation.
  - [x] Update the homepage controller to pass a status-first stream view model.
  - [x] Render distinct UI for live, upcoming, offline, and provider-failure cases.
  - [x] Keep the homepage usable when streaming data is missing or stale.
- [x] Implement 30-second status refresh without breaking CSP.
  - [x] Prefer a lightweight public status endpoint or equivalent server-owned polling path rather than client-side direct Facebook calls.
  - [x] Put polling logic in an external script under public assets, not in inline EJS script blocks.
  - [x] Ensure the refresh path updates status text, countdown state, and fallback messaging without full page reload.
- [x] Add graceful error and fallback behavior.
  - [x] Show a clear user-facing error when the provider becomes unavailable.
  - [x] Link to the Facebook page as the immediate alternative.
  - [x] Surface an archive-focused fallback state without implementing full archive browsing in this story.
- [x] Cover status behavior with tests.
  - [x] Add unit tests for status mapping and message selection logic in the streaming service.
  - [x] Add route/render tests for live, upcoming, offline, and error states.
  - [x] Add assertions for accessible status text, polling markup/hooks, and no regression to existing homepage content.

### Review Follow-ups (AI)

- [x] [AI-Review][High] Upcoming-state countdown now updates on first render by selecting SSR countdown markup and shared `data-countdown-target` attributes. [public/js/stream-status.js]
- [x] [AI-Review][High] Stream status and countdown regions now include `role="status"`, `aria-live="polite"`, and `aria-atomic="true"` semantics for assistive tech announcements. [src/views/home.ejs]
- [x] [AI-Review][High] Provider URL allowlist now requires exact facebook host/subdomain matching and rejects lookalike domains. [src/services/StreamingService.js]
- [x] [AI-Review][Medium] Client-side stream rendering now sanitizes text fields and validates external URLs before interpolation into rendered markup. [public/js/stream-status.js]
- [x] [AI-Review][Medium] Polling now performs an immediate refresh on load before the 30-second interval. [public/js/stream-status.js]
- [x] [AI-Review][Medium] Added regression coverage for host-validation edge cases, accessibility semantics, first-render countdown behavior, and immediate polling behavior. [__tests__/services/StreamingService.test.js]
- [x] [AI-Review][High] Live polling now preserves the active iframe when the embed URL is unchanged, updating status text and links without resetting playback. [public/js/stream-status.js]
- [x] [AI-Review][High] Active streams with invalid embed URLs now degrade to the error state instead of the offline/archive state. [src/services/StreamingService.js]
- [x] [AI-Review][Medium] Client polling now allows one failed refresh window before degrading stale UI to an explicit error fallback. [public/js/stream-status.js]
- [x] [AI-Review][Medium] Stream badge variants now use distinct status-specific styling for live, upcoming, offline, and error states. [public/css/main.css]

## Dev Notes

- This story layers status logic and resilience on top of Story 3.1. It should not re-solve embed integration from scratch.
- Do not implement Story 3.3 recording publication, Story 3.4 archive browsing/search, Story 3.5 playback features, or Story 3.6 scheduling/admin controls here.
- Keep the status model simple and deterministic. The homepage needs reliable presentation, not a full streaming orchestration engine.

### Technical Requirements

- Status logic belongs behind a dedicated streaming service abstraction in the existing Node.js/Express service layer.
- Public homepage state must remain server-owned. Do not call Facebook APIs directly from the browser.
- Automatic refresh every 30 seconds should use a narrow endpoint or refresh path returning normalized status data only.
- Failure handling must degrade gracefully. If Facebook status cannot be obtained within the expected timeout window, show a safe error state and fallback CTA instead of breaking the homepage.
- Use countdown behavior for upcoming state, but avoid duplicating fragile timer logic across multiple inline scripts.
- Current CSP forbids unsafe inline scripts. New status polling or countdown refresh code must live in external JS files. If implementation work touches the existing homepage inline countdown script, refactor toward externalized JS rather than expanding inline patterns.
- Preserve accessibility: ARIA live regions for status text, visible status indicators, keyboard-safe CTAs, and readable messaging.
- Preserve performance: no heavy polling cadence, no browser-side SDKs, and no blocking provider calls on every request without caching or timeout control.

### Architecture Compliance

- Follow the existing controller -> service -> view flow already used on the homepage.
- Use a StreamingService-style boundary for Facebook status lookup and fallback decisions.
- Keep this story in the MPA architecture. A small public JSON status endpoint is acceptable if it supports 30-second refresh cleanly.
- Honor the architecture requirement for graceful integration degradation: Facebook API failures should resolve to a visible fallback state, not application failure.
- Keep video metadata and status metadata only. No local video storage, transcoding, or media proxying.

### Library / Framework Requirements

- Runtime stack remains Node.js 18+, Express 4.x, EJS views.
- Existing stack already supports server-owned HTTP polling using standard Express routes and browser fetch.
- Reuse CacheService if status metadata needs short-lived caching or timeout shielding.
- Do not add React, Socket.io, Facebook JS SDK, or a general client state library for this story.
- Use existing Jest + Supertest test tooling for route and service coverage.

### File Structure Requirements

- Likely touch points:
  - src/controllers/homeController.js
  - src/views/home.ejs
  - src/routes/home.js
  - src/server.js if a new endpoint requires middleware wiring review
  - __tests__/routes/home.test.js
- Likely new or expanded modules:
  - src/services/StreamingService.js
  - src/routes/api.js or a dedicated lightweight public status route if that pattern fits better
  - public/js/stream-status.js
  - __tests__/services/StreamingService.test.js
- Avoid adding more inline scripts to EJS templates. This is especially important because current CSP already omits unsafe inline execution.

### Testing Requirements

- Test all four homepage states: live, upcoming, offline, error.
- Verify the error state includes an alternative Facebook destination.
- Verify upcoming state renders countdown target information and status text.
- Verify offline state invites users to view recordings or archive content without assuming Story 3.4 is implemented.
- Verify accessible status announcements, such as ARIA live or equivalent status semantics, are present.
- Verify the homepage still returns 200 and retains existing mission/events content.
- If a public status endpoint is introduced, add response-shape tests and timeout/failure mapping tests.

### Previous Story Intelligence

- Story 3.1 established the key guardrails that still apply here: public server-rendered homepage flow, service abstraction for streaming data, metadata-only handling, and no SDK-heavy approach.
- Reuse the same homepage/controller/testing seams identified in Story 3.1 rather than branching into a separate rendering architecture.
- Story 3.1 explicitly warned against pulling later Epic 3 scope into foundational streaming work. Maintain that discipline here.
- Story 3.1 also identified CSP-safe implementation as a hard constraint; this story depends on honoring it for polling and countdown behavior.

### Git Intelligence Summary

- Recent commits are still concentrated in Epic 2 auth/account work, not streaming. There is no recent streaming implementation pattern to extend yet.
- Recent diffs include homepage tests and layout changes, which suggests the repo already accepts route/test refinement in the public page layer. Favor extending existing homepage tests instead of inventing a separate test harness.

### Project Structure Notes

- Current homepage controller only composes mission, countdown, and events. It has no streaming status model yet.
- Current home view contains an inline countdown script even though CSP excludes unsafe inline scripts. Treat that as an implementation smell to avoid reproducing.
- Current server CSP already allows Facebook and YouTube frame sources, which supports rendering embeds and provider links without loosening policy.
- Current homepage tests are route-oriented and lightweight. They are the correct place to grow public status-state assertions.

### References

- Source: _bmad-output/planning-artifacts/epics.md, Story 3.2 Stream Status Display & Error Handling
- Source: _bmad-output/planning-artifacts/prd.md, FR10 and FR11 streaming requirements
- Source: _bmad-output/planning-artifacts/prd.md, Real-Time Streaming & Resilience
- Source: _bmad-output/planning-artifacts/architecture.md, Graceful Integration Degradation
- Source: _bmad-output/planning-artifacts/architecture.md, StreamingService and Facebook API integration guidance
- Source: _bmad-output/planning-artifacts/ux-design-specification.md, Watch Live + Chat flow
- Source: _bmad-output/planning-artifacts/ux-design-specification.md, Live Status Indicator
- Source: _bmad-output/planning-artifacts/ux-design-specification.md, failure-mode guidance for stream load, autoplay, and backup options
- Source: _bmad-output/implementation-artifacts/3-1-facebook-live-stream-embed.md
- Source: src/controllers/homeController.js
- Source: src/views/home.ejs
- Source: src/server.js
- Source: __tests__/routes/home.test.js

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- Sprint status selected the next backlog story as 3-2-stream-status-display-error-handling.
- Story 3.1 already established the homepage embed foundation and core streaming guardrails.
- Current homepage code has no stream status abstraction yet and still contains inline countdown behavior that should not be copied forward.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Status-state modeling, fallback behavior, and CSP-safe polling path are explicitly scoped.
- Later archive/admin streaming stories remain intentionally out of scope.
- `StreamingService` refactored to return normalized UI states (`live`, `upcoming`, `offline`, `error`).
- New API endpoint `GET /api/stream/status` exposed for polling without hitting Facebook API directly.
- Frontend status updates handled via `public/js/stream-status.js` every 30s. Sub-second countdown timer also moved to this external script, enabling removal of inline scripts and adherence to CSP.
- Tests expanded for `StreamingService`, `homeController`, and Express API routes. All 470 tests passing.
- Live stream polling now preserves the active player when the embed URL is unchanged, preventing 30-second playback resets.
- Invalid active-provider embed URLs now map to the explicit error state with Facebook fallback guidance.
- Client refresh failures now use a one-retry window before showing a safe refresh error state.
- Status badge variants now have dedicated CSS styling, and regression coverage was expanded for iframe preservation and retry-window degradation.

### File List

- _bmad-output/implementation-artifacts/3-2-stream-status-display-error-handling.md
- src/services/StreamingService.js
- __tests__/services/StreamingService.test.js
- src/controllers/homeController.js
- src/views/home.ejs
- __tests__/routes/home.test.js
- src/routes/api.js
- __tests__/routes/api.stream.test.js
- public/js/stream-status.js
- public/css/main.css
- __tests__/controllers/homeController.test.js
- __tests__/public/stream-status.test.js
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Senior Developer Review (AI)

### Reviewer

- Reviewer: g0verdie
- Date: 2026-03-23

### Outcome

- Decision: Approved
- Summary: All High and Medium findings from review were fixed, including live-player preservation during polling, provider-failure mapping, retry-window degradation, and status badge clarity. Regression tests were added for the new behaviors.

### Findings

1. Resolved - First-render upcoming countdown selector mismatch fixed.
2. Resolved - Accessibility live announcement semantics added.
3. Resolved - Host validation hardened against lookalike domains.
4. Resolved - Client rendering sanitization and URL validation added.
5. Resolved - Immediate polling on load implemented.
6. Resolved - Regression tests added for all above areas.
7. Resolved - Active live polling no longer recreates the iframe when the embed URL is unchanged.
8. Resolved - Active streams with invalid provider embeds now degrade to error instead of offline.
9. Resolved - Client polling now uses a one-retry window before replacing stale UI with a refresh error state.
10. Resolved - Status badges now render with distinct visual styling for live, upcoming, offline, and error states.

### Change Log

- 2026-03-23: Senior Developer adversarial review completed. Status set to `in-progress`; 6 follow-up items added under `Review Follow-ups (AI)`.
- 2026-03-23: Applied automatic fixes for all High and Medium review findings, added regression tests, and validated with full `npm test` pass (53 suites / 475 tests).
- 2026-03-23: Applied automatic fixes for polling DOM patching, invalid-live error mapping, one-retry refresh degradation, and status badge styling; validated with targeted Jest regression coverage.
