# Story 3.1: Facebook Live Stream Embed

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a public visitor,
I want to watch the live service embedded directly on the temple website,
so that I can participate in worship without leaving the site or needing a Facebook account.

## Acceptance Criteria

1. Given I am on the homepage during a scheduled live service, when the Rabbi has started the Facebook Live broadcast, then I see the Facebook Live video player embedded on the page.
2. The video starts automatically when browser policy allows or with one clear tap when autoplay is blocked, and no Facebook login is required.
3. The embedded player is responsive and scales correctly on mobile, tablet, and desktop.
4. Stream start-to-view experience is optimized for a 2-3 second path from page load to playable media.
5. I can control volume, fullscreen, and playback without leaving the page.
6. The player is keyboard accessible and usable with screen readers.
7. The homepage remains performant and only stream metadata is stored locally.

## Tasks / Subtasks

- [x] Add a streaming service abstraction for public embed data retrieval.
  - [x] Create a service module that returns normalized live stream embed metadata without storing video locally.
  - [x] Keep the provider contract small: embed URL, title, live flag, scheduled start, fallback watch URL, thumbnail if available.
  - [x] Prefer configuration-backed or mocked provider data for this story if full Facebook API integration is not already in place.
- [x] Extend homepage composition to render a live stream block only when an active stream is available.
  - [x] Update the homepage controller to request stream embed metadata alongside existing event data.
  - [x] Pass a dedicated stream view model into the rendered page instead of raw provider payloads.
  - [x] Keep the route public and server-rendered.
- [x] Implement the homepage embed UI in the existing EJS view layer.
  - [x] Add a clear live stream region above or adjacent to existing homepage content without breaking mission, countdown, or events sections.
  - [x] Render accessible fallback states for autoplay blocked, no active stream, and provider unavailable states without implementing full status workflows from Story 3.2.
  - [x] Ensure iframe or embed markup works within the current CSP rules.
- [x] Add styling and client behavior needed for a responsive embed.
  - [x] Use existing CSS structure in public assets; avoid introducing a new frontend framework.
  - [x] Do not add new inline scripts. If client-side behavior is needed, move it to a public JS file and include it through the layout pattern.
  - [x] Preserve touch targets, keyboard flow, and mobile-first layout behavior.
- [x] Test the story at controller, route, and rendered HTML levels.
  - [x] Add or update route integration tests for live embed rendering and non-live fallback behavior.
  - [x] Add unit coverage for any new streaming service logic and controller mapping.
  - [x] Verify no regression in existing homepage content, accessibility landmarks, and performance-oriented expectations.

## Dev Notes

- This story is the first story in Epic 3 and should establish the public viewing foundation only.
- Do not implement Story 3.2 stream status polling/error handling, Story 3.3 recording publication workflow, Story 3.4 archive browsing, Story 3.5 playback controls beyond the embed itself, or Story 3.6 scheduling/admin tooling.
- Keep the implementation minimal, server-rendered, and compatible with current homepage architecture.

### Technical Requirements

- Architecture requires an API-first Node.js/Express monolith with service-layer boundaries. Add streaming logic behind a dedicated service module rather than embedding provider logic inside controllers.
- Public visitors must view the stream without authentication. Do not gate the homepage embed behind member login.
- Only metadata belongs in local storage and application state. Do not store or proxy video files locally.
- Preserve homepage performance expectations. Avoid slow blocking calls on every request; if provider fetches are needed, use a short-lived cache strategy or configuration seed appropriate for live metadata.
- Browser autoplay rules are stricter than product prose implies. Implement muted autoplay if supported, and always provide a visible one-tap play path when autoplay is blocked.
- CSP in the server already permits Facebook and YouTube frames. Keep embeds constrained to allowed providers and avoid SDK-heavy browser integrations unless strictly necessary.
- Do not add new dependencies unless the existing stack cannot support the need. Existing dependencies already include Express, EJS, axios, Redis cache support, and test tooling.

### Architecture Compliance

- Follow the existing controller -> service -> view pattern seen on the homepage.
- Keep this as a server-rendered MPA enhancement, not a client-side SPA widget.
- New provider access belongs in a service such as src/services/StreamingService.js.
- Controller shaping belongs in src/controllers/homeController.js or a focused streaming controller only if route surface expands.
- Rendering belongs in existing EJS views and public static assets.
- Respect graceful degradation. If provider data cannot be loaded, show a safe non-crashing homepage experience with a simple fallback action.
- Respect accessibility requirements across headings, landmark roles, focus order, contrast, and keyboard usage.

### Library / Framework Requirements

- Runtime stack: Node.js 18+, Express 4.x, EJS views.
- Testing stack: Jest + Supertest.
- Caching stack already exists through Redis-backed CacheService. Reuse it if live metadata caching is needed.
- Do not introduce React, Socket.io, Facebook JS SDK, or a video framework for this story unless there is a hard blocker. A plain iframe/embed-first approach is the preferred path here.
- If Facebook embed URL normalization is needed, prefer server-side URL generation or lightweight provider metadata retrieval using existing axios rather than new SDK dependencies.

### File Structure Requirements

- Likely touch points:
  - src/controllers/homeController.js
  - src/views/home.ejs
  - public/css/main.css
  - __tests__/routes/home.test.js
- Likely new modules if needed:
  - src/services/StreamingService.js
  - __tests__/services/StreamingService.test.js
- Keep any new client script external under public/js/. Do not add more inline script blocks to EJS views.
- Preserve existing route ownership in src/routes/home.js unless a dedicated public streaming route becomes necessary.

### Testing Requirements

- Cover the homepage with and without an active stream.
- Assert the embed region renders only when stream metadata indicates a public live stream is available.
- Assert fallback CTA or placeholder copy renders when autoplay is blocked or no stream is active.
- Preserve existing homepage assertions for mission content, accessibility landmarks, upcoming events, and response status.
- Add coverage for responsive-safe markup and accessible iframe labeling where practical.
- Keep test runtime fast; homepage route tests currently target sub-500ms execution in test conditions.

### Previous Story Intelligence

- No previous story exists in Epic 3. Reuse proven homepage/controller/testing patterns from completed earlier epics instead of inventing a new rendering architecture.

### Project Structure Notes

- Existing homepage implementation already uses EventService to compose mission, countdown, and upcoming events in src/controllers/homeController.js.
- Existing homepage markup lives in src/views/home.ejs and is rendered through src/views/layout.ejs.
- Existing tests already validate homepage route behavior in __tests__/routes/home.test.js. Extend those tests instead of creating a disconnected test harness.
- Existing CSP in src/server.js allows Facebook and YouTube frame sources but avoids unsafe inline scripts; this is a hard implementation guardrail.

### References

- Source: _bmad-output/planning-artifacts/epics.md, Story 3.1 Facebook Live Stream Embed
- Source: _bmad-output/planning-artifacts/prd.md, Capability Area 2: Facebook Live Streaming (MVP)
- Source: _bmad-output/planning-artifacts/prd.md, Real-Time Streaming & Resilience
- Source: _bmad-output/planning-artifacts/architecture.md, Facebook Live Streaming domain and StreamingService service-layer guidance
- Source: _bmad-output/planning-artifacts/architecture.md, Graceful error handling and metadata-only video storage
- Source: _bmad-output/planning-artifacts/ux-design-specification.md, Unified Streaming Experience and Conditional Live Stream Banner
- Source: _bmad-output/planning-artifacts/ux-design-specification.md, Streaming Reliability & Failure Prevention
- Source: src/controllers/homeController.js
- Source: src/views/home.ejs
- Source: src/views/layout.ejs
- Source: src/routes/home.js
- Source: src/server.js
- Source: __tests__/routes/home.test.js

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- Sprint status selected the next backlog story as 3-1-facebook-live-stream-embed.
- Planning artifacts confirm Epic 3 is the canonical next execution area.
- Added red-phase coverage for streaming service, homepage controller mapping, and homepage route rendering.
- Narrow Story 3.1 tests passed after implementation; full regression completed at 51/51 suites and 471/471 tests passing.

### Completion Notes List

- Added a cached StreamingService that normalizes Facebook live embed metadata and rejects unsupported provider URLs.
- Extended homepage composition to include a dedicated stream view model with graceful fallback when provider metadata is unavailable.
- Implemented responsive homepage live stream UI with accessible live, inactive, and unavailable states without adding new dependencies or inline scripts.
- Validated the implementation with targeted Story 3.1 tests, full Jest regression, and lint.

### Code Review Fixes Applied

**[HIGH-1] Fixed:** CTA link changed from non-existent `/visit-us` to `/about` route  
**[HIGH-2/3] Fixed:** Added `iframeTitle` to inactive and unavailable stream states for full accessibility coverage  
**[HIGH-4] Fixed:** Changed iframe `referrerpolicy` from `strict-origin-when-cross-origin` to `no-referrer` for better privacy  
**[HIGH-5] Fixed:** Added HTTPS-only protocol validation in `isAllowedProviderUrl()` to reject HTTP embeds  
**[MEDIUM-1] Fixed:** Updated File List to document sprint-status.yaml and epics.md changes for full transparency  
**Test Coverage:** Added new test for HTTPS protocol enforcement in StreamingService (23/23 tests passing)

### File List

- _bmad-output/implementation-artifacts/3-1-facebook-live-stream-embed.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/planning-artifacts/epics.md
- __tests__/controllers/homeController.test.js
- __tests__/routes/home.test.js
- __tests__/services/StreamingService.test.js
- public/css/main.css
- src/controllers/homeController.js
- src/services/StreamingService.js
- src/views/home.ejs

### Change Log

- Added StreamingService and homepage integration for public Facebook Live embed support.
- Added responsive stream styling and fallback rendering for inactive and unavailable stream states.
- Expanded controller, route, and service tests to cover Story 3.1 behavior.
