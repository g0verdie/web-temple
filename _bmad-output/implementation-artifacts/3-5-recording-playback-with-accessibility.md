# Story 3.5: Recording Playback with Accessibility

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a logged-in member,
I want to play archived service recordings with captions,
so that I can watch past services with accessibility support.

## Acceptance Criteria

1. Given I am viewing a recording in the archive, when I click to play the recording, then the video player loads and begins playback.
2. All service recordings have captions available, either burned-in or WebVTT subtitle files.
3. I can toggle captions on and off if captions are provided in WebVTT format.
4. I can control playback speed at 0.5x, 1x, 1.5x, and 2x.
5. I can use keyboard shortcuts such as Space for pause, arrow keys to skip, and F for fullscreen.
6. The video player is screen-reader compatible with ARIA labels.
7. The player is fully responsive and works on mobile, tablet, and desktop.
8. Video playback quality adjusts based on available bandwidth.
9. Only video metadata is stored in our database; video files remain on Facebook or the external provider.

## Tasks / Subtasks

- [ ] Extend the archive flow with a recording playback experience.
  - [ ] Reuse the recordings archive modules established by Story 3.4 instead of creating a separate playback stack.
  - [ ] Decide whether playback occurs on a recording detail page or an in-page archive player, but keep the URL and server-rendered flow linkable and testable.
  - [ ] Ensure playback only works for published recordings already surfaced by the archive query layer.
- [ ] Implement a provider-compatible player strategy that fits the current CSP and accessibility constraints.
  - [ ] Prefer a standards-based player approach using native browser capabilities or provider embeds rather than adding a heavy frontend video framework.
  - [ ] Support captions when the provider exposes WebVTT or equivalent track metadata; otherwise clearly rely on burned-in captions.
  - [ ] Preserve responsive rendering across mobile, tablet, and desktop layouts.
  - [ ] Keep the solution metadata-only with external video hosting.
- [ ] Add accessible playback controls and semantics.
  - [ ] Ensure the player surface exposes clear labels and instructions for screen readers.
  - [ ] Support keyboard interactions for play/pause, seeking, fullscreen, and caption toggling where technically supported by the chosen player approach.
  - [ ] Provide a visible captions state and playback speed controls.
  - [ ] Avoid inaccessible custom controls unless they are necessary and fully tested.
- [ ] Add caption metadata to the recordings schema.
  - [ ] Inspect the current `recordings` table (migrations 012 and 013); it has no caption columns today.
  - [ ] Add migration `014_add_caption_metadata_to_recordings.sql` introducing `caption_url TEXT NULL`, `caption_format VARCHAR(20) NOT NULL DEFAULT 'burned-in' CHECK (caption_format IN ('webvtt','burned-in'))`, and a backfill statement defaulting existing rows to `'burned-in'`.
  - [ ] Surface these fields through `RecordingService` read methods only. Do not modify Story 3.3 admin publish UI in this story; read-side defaults are sufficient.
- [ ] Add the playback route, controller action, and view.
  - [ ] Mount `GET /archive/:id` in [src/routes/recordings.js](src/routes/recordings.js); it inherits the existing `requireAuth` router-level middleware. Use the recording UUID; do not introduce a slug column.
  - [ ] Add `recordingController.getRecordingDetail` that loads a single published recording via `RecordingService` and returns 404 (not 403) when the row is missing or `publish_state != 'published'`, to avoid leaking draft existence.
  - [ ] Render `src/views/recordings/show.ejs` for the detail page; keep server-rendered EJS with optional progressive enhancement.
- [ ] Choose and commit to a player strategy that can actually satisfy AC4 and AC5.
  - [ ] Default approach: HTML5 `<video>` with provider-hosted MP4/HLS source plus WebVTT `<track>`, because Facebook iframe embeds do not expose host-controlled playback rate or guaranteed Space/Arrow/F shortcuts.
  - [ ] If a Facebook iframe embed is used as a fallback for any recording, AC4 (rate) and AC5 (shortcuts) are not host-controllable; in that case the recording must either also expose a provider MP4/HLS URL for native `<video>` playback, or the limitation must be raised for explicit acceptance amendment before marking ACs satisfied. Do not silently mark AC4/AC5 as met.
  - [ ] Support WebVTT caption toggle when `caption_format = 'webvtt'`; when `'burned-in'`, render a visible "captions are burned into the video" affordance instead.
  - [ ] Preserve responsive rendering across mobile, tablet, and desktop layouts and keep the solution metadata-only (no local video storage).
- [ ] Update CSP deliberately for native `<video>` playback.
  - [ ] In [src/server.js](src/server.js#L46) `contentSecurityPolicy.directives`: add the provider media origin to `mediaSrc` (currently `"'self'"` only); add the WebVTT host to `connectSrc` if it differs; leave `frameSrc` unchanged.
  - [ ] Add an integration test asserting the CSP header on the playback route includes the new origins and that no broader wildcards were introduced.
- [ ] Add accessible playback controls and semantics.
  - [ ] Use the native `<video controls>` element so Space, Arrow keys, and F (fullscreen) are honored by the browser.
  - [ ] Provide visible playback speed controls at 0.5x, 1x, 1.5x, 2x bound to `video.playbackRate`.
  - [ ] Provide ARIA labels and a visible captions on/off control when WebVTT is present.
  - [ ] Avoid custom controls unless they are necessary; if added, they must meet the same keyboard and ARIA expectations as the rest of the app.
- [ ] Handle performance and resilience.
  - [ ] Rely on provider-managed adaptive quality (HLS or provider CDN); do not implement local bitrate selection or transcoding.
  - [ ] Render useful recording metadata and a recovery message when the player fails to load (e.g., network error, removed source).
- [ ] Cover playback and accessibility with tests.
  - [ ] Add route/integration coverage for `GET /archive/:id`: authenticated member success, unauthenticated rejection, 404 for unpublished IDs (not 403, not 200).
  - [ ] Add view rendering assertions for captions affordance, playback-speed controls, and recording metadata.
  - [ ] Add a jest-axe accessibility test for the playback page modeled on [__tests__/views/home.accessibility.test.js](__tests__/views/home.accessibility.test.js) and [__tests__/views/contact.accessibility.test.js](__tests__/views/contact.accessibility.test.js).
  - [ ] Add a CSP regression test as described above.
  - [ ] Honor Story 3.4's deferred work that AC5 and AC7 now depend on: keyboard accessibility coverage and responsive layout for the archive surface ([src/views/recordings/index.ejs](src/views/recordings/index.ejs) and [__tests__/routes/archiveRoutes.test.js](__tests__/routes/archiveRoutes.test.js)).

## Dev Notes

- This story depends on Story 3.4. Implement playback as an extension of the member archive experience, not as a disconnected media feature.
- Do not revisit publishing workflows from Story 3.3 or archive searching/filtering concerns from Story 3.4 except where necessary to hook into playback.
- Keep the website responsible for metadata, access control, and accessible presentation. External platforms remain responsible for raw video delivery and adaptive streaming.
- Accessibility is the core scope here, not visual embellishment. Favor robust native/provider-supported controls over custom media UI unless there is a clear gap that must be filled.

### Technical Requirements

- Playback must start from a recording with `publish_state = 'published'`. The detail route must return 404 for any other state, not 403, to avoid leaking existence of drafts.
- Caption metadata is required for AC2/AC3. The current `recordings` schema (migrations 012 and 013) has no caption columns, so this story adds migration 014 with `caption_url` and `caption_format ('webvtt' | 'burned-in')`.
- AC3 caption toggle applies only when `caption_format = 'webvtt'`; for `'burned-in'`, render a visible "captions are burned into the video" affordance.
- AC4 (0.5x / 1x / 1.5x / 2x) and AC5 (Space, Arrow, F) require host-controlled playback. Default implementation is an HTML5 `<video>` element with provider-hosted MP4/HLS source plus WebVTT `<track>`. A Facebook iframe embed cannot satisfy AC4/AC5 on its own; if used, it must coexist with a native `<video>` source or the AC limitation must be explicitly amended before completion.
- The video element must expose ARIA labels and use `<video controls>` so browser-native keyboard shortcuts apply.
- Video hosting stays external. The database stores only metadata: provider ID, playback URL, thumbnail URL, caption URL/format, duration, and descriptive fields.
- Use provider-managed adaptive quality; do not implement local bitrate selection or transcoding.
- CSP changes are explicit and minimal: in [src/server.js](src/server.js#L46) `contentSecurityPolicy.directives`, extend `mediaSrc` to include the provider media origin and `connectSrc` to include the WebVTT host. Leave `frameSrc` unchanged. Cover with an integration test on the playback route.

### Architecture Compliance

Extend the existing route → controller → service → view monolith for the recordings domain established by Stories 3.3 and 3.4. Keep provider-specific playback details inside `RecordingService`, never in templates. Stay server-rendered (MPA); progressive enhancement is allowed but no SPA rewrite. Playback failures must degrade to a clear member-facing message, not a blank embed.

### Library / Framework Requirements

Stay on Node.js, Express, EJS, and browser-native APIs (`<video>`, `<track>`, `playbackRate`). Do not add a third-party video player framework. Reuse existing auth middleware, route organization, and the repo's jest-axe accessibility test pattern. CSP changes belong in [src/server.js](src/server.js#L46) only and must be minimal.

### File Structure Requirements

- Touch points:
  - [src/server.js](src/server.js) — CSP `mediaSrc` / `connectSrc` extension only.
  - [src/routes/recordings.js](src/routes/recordings.js) — add `GET /:id` (mounted under `/archive`).
  - `src/controllers/recordingController.js` — add `getRecordingDetail`.
  - `src/services/RecordingService.js` — add `getPublishedRecordingById` returning row only when `publish_state = 'published'`.
- New files:
  - `migrations/014_add_caption_metadata_to_recordings.sql`
  - `src/views/recordings/show.ejs`
  - `public/js/recording-player.js` only if progressive enhancement is needed for the speed control.
- Test additions:
  - `__tests__/routes/recordingsDetail.test.js` (auth, 404 for unpublished, CSP header).
  - `__tests__/views/recordingsDetail.accessibility.test.js` (jest-axe).
  - `__tests__/services/RecordingService.test.js` — extend with `getPublishedRecordingById` cases.
- Do not fork playback into a separate route namespace; everything stays under `/archive`.

### Testing Requirements

- `GET /archive/:id` returns 200 for an authenticated member loading a published recording.
- `GET /archive/:id` returns 404 (not 403, not 200) for unpublished or non-existent IDs, even when the user is authenticated.
- Unauthenticated access is rejected by `requireAuth` (consistent with the existing archive list).
- Rendered markup includes the playback speed controls (0.5x, 1x, 1.5x, 2x), ARIA labels on the player, and a captions affordance: a `<track kind="captions">` element when `caption_format = 'webvtt'`, or a visible "captions are burned into the video" notice when `'burned-in'`.
- Graceful fallback messaging is rendered when `provider_video_url` is missing.
- CSP integration test asserts the playback route's response header contains the new `mediaSrc` / `connectSrc` origins and no broader wildcards.
- jest-axe accessibility suite for the playback page, modeled on [__tests__/views/home.accessibility.test.js](__tests__/views/home.accessibility.test.js) and [__tests__/views/contact.accessibility.test.js](__tests__/views/contact.accessibility.test.js).

### Previous Story Intelligence

- Story 3.3 established the recording publication workflow and the canonical `recordings` table; its current schema (migrations 012 and 013) does not include caption metadata, which this story must add.
- Story 3.4 mounted `/archive` with `requireAuth` at the router level ([src/routes/recordings.js](src/routes/recordings.js)) and introduced `RecordingService` query patterns; reuse both directly.
- Story 3.4 explicitly deferred two items now required to honor Story 3.5's ACs:
  - **Keyboard accessibility coverage** for the archive surface — required by AC5 (the playback route originates from the archive page).
  - **Responsive layout** for the archive page — required by AC7.
  Do not defer them again.
- Story 3.4 deliberately left playback and caption behavior to this story; keep that boundary by not revisiting publish workflow or filter/search logic.
- Epic 3 reinforces metadata-first storage and graceful degradation: playback must never depend on local video files or custom streaming logic.

### Git Intelligence Summary

- Recent application work continues to follow the existing route/controller/service/view structure with review-driven hardening rather than architecture churn.
- The latest relevant commit titles are: `re-review of 2.7`, `second pass cr`, `Fix: Story 2.7 Security & Code Review Issues`, `first pass 2.7`, and `random fixes for 2.3`.
- That pattern argues for a conservative implementation: extend the recordings path, reuse existing testing patterns, and avoid unnecessary new dependencies.

### Project Structure Notes

- Current CSP in src/server.js explicitly allows Facebook and YouTube frames but does not broadly allow off-site media sources for raw video playback. That is a real implementation constraint for Story 3.5 and should be treated as part of the design, not discovered late.
- Existing view accessibility tests use full app responses plus jest-axe, which is the right pattern to extend for playback accessibility validation.
- The codebase does not yet contain a reusable media player abstraction, so Story 3.5 should establish the first canonical recordings playback pattern in the recordings feature area.
- Existing views already use semantic HTML and labeled form/control patterns; playback UI should match that standard instead of relying on opaque provider widgets alone.

### References

- Source: [_bmad-output/planning-artifacts/epics.md](_bmad-output/planning-artifacts/epics.md), Story 3.5 Recording Playback with Accessibility
- Source: [_bmad-output/planning-artifacts/prd.md](_bmad-output/planning-artifacts/prd.md), FR70, NFR-A3, NFR-A4
- Source: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md), Accessibility support and server-rendered HTML approach
- Source: [_bmad-output/planning-artifacts/ux-design-specification.md](_bmad-output/planning-artifacts/ux-design-specification.md), WCAG AA mandatory guidance
- Source: [_bmad-output/implementation-artifacts/3-4-member-archive-browsing-search.md](_bmad-output/implementation-artifacts/3-4-member-archive-browsing-search.md)
- Source: [src/server.js](src/server.js#L46) (CSP directives)
- Source: [src/routes/recordings.js](src/routes/recordings.js) (existing `/archive` mount + `requireAuth`)
- Source: [src/views/recordings/index.ejs](src/views/recordings/index.ejs) (sibling archive view)
- Source: [migrations/012_create_recordings_table.sql](migrations/012_create_recordings_table.sql), [migrations/013_add_service_type_and_indexes.sql](migrations/013_add_service_type_and_indexes.sql)
- Source: [__tests__/views/home.accessibility.test.js](__tests__/views/home.accessibility.test.js)
- Source: [__tests__/views/contact.accessibility.test.js](__tests__/views/contact.accessibility.test.js)

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- Sprint status selected Story 3.5 as the next backlog story after Stories 3.1 through 3.4 were prepared.
- Repository inspection found no existing playback component or recordings route implementation yet, so this story defines the first canonical playback pattern for the recordings feature area.
- CSP inspection showed frame embedding is already permitted for Facebook and YouTube, while raw external media playback would need deliberate policy review.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story 3.5 is scoped to playback accessibility and deliberately depends on Story 3.4 for archive browsing and routing.
- The story steers implementation toward CSP-compatible external playback with accessibility-first controls and tests.

### File List

- _bmad-output/implementation-artifacts/3-5-recording-playback-with-accessibility.md
