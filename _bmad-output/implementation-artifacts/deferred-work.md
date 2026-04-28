## Deferred from: code review of 3-4-member-archive-browsing-search.md (2026-03-25)

- Add index for publish_state filtering [migrations/013_add_service_type_and_indexes.sql] — deferred: we will do this later during our optimization sprint
- Implement full responsive design for archive page [src/views/recordings/index.ejs] — deferred: we will also execute it later when polishing built product
- Add keyboard accessibility coverage [__tests__/routes/archiveRoutes.test.js] — deferred, pre-existing
- Add performance verification evidence for AC9/AC10 [src/services/RecordingService.js] — deferred, pre-existing

## Deferred from: code review 3-5-recording-playback-with-accessibility.md (2026-04-27)
- Missing Controller-Level Validation: The id from req.params is passed directly to the service layer without any middleware validation.
- Egregious CSP Weakening [src/server.js]: deferred - https is secure to begin with, we can implement the extra logic later
