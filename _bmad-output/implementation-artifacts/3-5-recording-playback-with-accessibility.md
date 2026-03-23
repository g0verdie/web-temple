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
- [ ] Handle performance and resilience concerns.
  - [ ] Allow provider-managed adaptive playback quality rather than inventing in-house transcoding logic.
  - [ ] Ensure the page still renders useful metadata and recovery guidance if the provider player fails to load.
  - [ ] Review CSP implications if external tracks, players, or media origins require policy updates.
- [ ] Cover playback and accessibility behavior with tests.
  - [ ] Add view/integration coverage for rendering the player, captions affordances, and playback-related metadata.
  - [ ] Add accessibility tests for the playback page or archive playback state using the repo’s jest-axe pattern.
  - [ ] Add regression coverage ensuring only published recordings can be played through member-facing routes.

## Dev Notes

- This story depends on Story 3.4. Implement playback as an extension of the member archive experience, not as a disconnected media feature.
- Do not revisit publishing workflows from Story 3.3 or archive searching/filtering concerns from Story 3.4 except where necessary to hook into playback.
- Keep the website responsible for metadata, access control, and accessible presentation. External platforms remain responsible for raw video delivery and adaptive streaming.
- Accessibility is the core scope here, not visual embellishment. Favor robust native/provider-supported controls over custom media UI unless there is a clear gap that must be filled.

### Technical Requirements

- Playback must start from an archive recording surfaced by the published-recording data model.
- All recordings must have captions available, either burned-in or via WebVTT/subtitle tracks.
- If the selected playback approach supports text tracks, provide caption toggle behavior.
- Provide playback speed options at 0.5x, 1x, 1.5x, and 2x.
- Support keyboard playback affordances and ensure the player surface is screen-reader compatible.
- Keep video hosting external. The database should store metadata such as provider ID, playback URL, thumbnail URL, caption metadata, duration, and descriptive fields only.
- Use provider-managed adaptive quality where available instead of implementing local bitrate selection or transcoding.
- Review current CSP before implementation. The app already allows Facebook and YouTube frames, but current policy does not broadly allow external media sources for native video tags. That means the final implementation should either remain within approved embed patterns or update CSP deliberately as part of the story.

### Architecture Compliance

- Continue the monolith structure: route -> controller -> service -> view.
- Extend the recordings domain introduced by Stories 3.3 and 3.4 instead of creating a standalone media subsystem.
- Keep provider-specific playback details isolated in the recordings/streaming service boundary rather than leaking them into templates.
- Preserve the server-rendered MPA pattern. The playback page can use targeted client-side behavior if needed, but should not require a SPA rewrite.
- Favor accessible native or provider-supported controls first. If custom controls are necessary, they must meet the same keyboard and ARIA expectations as the rest of the app.
- Ensure playback failures degrade gracefully to an understandable member-facing message rather than a broken blank embed.

### Library / Framework Requirements

- Stay with the existing Node.js, Express, EJS, and browser-native stack.
- Do not introduce a large third-party frontend player framework unless provider/native capabilities prove insufficient.
- Reuse existing layout, auth, and route organization patterns.
- Reuse the repo’s accessibility testing stack built on jest-axe and server-rendered page responses.
- If external caption or player resources require additional CSP allowances, make those changes minimally and intentionally in src/server.js.

### File Structure Requirements

- Likely touch points:
  - src/server.js
  - src/views/layout.ejs
  - src/routes/recordings.js
  - src/controllers/recordingController.js
  - src/services/RecordingService.js or src/services/StreamingService.js
- Likely new or extended view modules:
  - src/views/recordings/show.ejs
  - src/views/recordings/index.ejs if playback is in-page
  - public/js/recording-player.js only if minimal progressive enhancement is required
- Likely test additions:
  - __tests__/routes/recordings.test.js or matching integration coverage
  - __tests__/views/recordings.accessibility.test.js
  - __tests__/services/RecordingService.test.js
- Extend the same recordings module names introduced by Story 3.4 once implemented; do not fork playback into unrelated route namespaces.

### Testing Requirements

- Test playback route or playback state for authenticated members.
- Test unpublished recordings are not playable through member-facing URLs.
- Test rendered output includes captions affordance or burned-in caption expectation messaging as appropriate.
- Test playback speed options are available.
- Test keyboard-accessible controls and screen-reader-friendly labels in rendered markup.
- Test responsive rendering of the player container.
- Test graceful fallback messaging when playback metadata is incomplete or provider load fails.
- Add a jest-axe accessibility suite for the playback page or playback-enabled archive view.

### Previous Story Intelligence

- Story 3.3 established the recording publication workflow and canonical metadata source.
- Story 3.4 established the member archive route, query model, and navigation path that this story should extend.
- Story 3.4 intentionally deferred playback and caption behavior to this story; keep that scope boundary intact by focusing on the player experience itself.
- Earlier Epic 3 stories reinforced a metadata-first model and graceful degradation. That remains important here because playback should not depend on local video storage or fragile custom streaming logic.

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

- Source: _bmad-output/planning-artifacts/epics.md, Story 3.5 Recording Playback with Accessibility
- Source: _bmad-output/planning-artifacts/prd.md, FR70, NFR-A3, NFR-A4
- Source: _bmad-output/planning-artifacts/architecture.md, Accessibility support and server-rendered HTML approach
- Source: _bmad-output/planning-artifacts/ux-design-specification.md, WCAG AA mandatory guidance
- Source: _bmad-output/implementation-artifacts/3-4-member-archive-browsing-search.md
- Source: src/server.js
- Source: src/views/contact.ejs
- Source: __tests__/views/home.accessibility.test.js
- Source: __tests__/views/contact.accessibility.test.js

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
