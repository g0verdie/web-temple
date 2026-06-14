## Deferred from: code review of 3-4-member-archive-browsing-search.md (2026-03-25)

- Add index for publish_state filtering [migrations/013_add_service_type_and_indexes.sql] — deferred: we will do this later during our optimization sprint
- Implement full responsive design for archive page [src/views/recordings/index.ejs] — deferred: we will also execute it later when polishing built product
- Add keyboard accessibility coverage [__tests__/routes/archiveRoutes.test.js] — deferred, pre-existing
- Add performance verification evidence for AC9/AC10 [src/services/RecordingService.js] — deferred, pre-existing

## Deferred from: code review 3-5-recording-playback-with-accessibility.md (2026-04-27)
- Missing Controller-Level Validation: The id from req.params is passed directly to the service layer without any middleware validation.
- Egregious CSP Weakening [src/server.js]: deferred - https is secure to begin with, we can implement the extra logic later

## Deferred from: Epic 4 live-chat review (Opus 4.8 adversarial, 2026-06-14)
Confirmed LOW findings, deferred to a follow-up polish story (the 2 HIGH WS-robustness
issues, the connection-cap TOCTOU, the pause-UI AC, and the test gaps were fixed in this pass):

- ~~Guest display-name impersonation~~ **[RESOLVED 2026-06-14, f/launch-verification]** — Guest badge now rendered wherever chat authors appear (live-chat.js, recordings/show.ejs, chat-moderation.ejs) keyed on user_id IS NULL.
- ~~WS upgrade auth skips the token_version/blacklist check~~ **[RESOLVED 2026-06-14, f/launch-verification]** — the upgrade now mirrors requireAuth (jti blacklist + token_version) and rejects revoked/demoted sessions with 401.
- Inline style attributes vs the strict CSP (no 'unsafe-inline' on styleSrc) [src/views/admin/chat-moderation.ejs:25,31,34; src/views/recordings/show.ejs:113] — pre-existing pattern in other views
- Reconnect stampede: no jitter on the backoff intervals, and closeAllConnections() is defined but never wired to SIGTERM/SIGINT so a restart produces synchronized reconnects [public/js/live-chat.js:17,184-235; src/services/chatSocketServer.js:312]
- Dead moderator-badge branch: live-chat.js styles msg.role but no query/column/broadcast ever supplies role — either drop it or denormalize role through the payload [public/js/live-chat.js:410-413]
- Polishing perf: getApprovedMessagesForStream has no SQL since/LIMIT; the poll filters in JS after a full-history SELECT [src/services/ChatService.js:182-189; src/controllers/chatController.js:96-104] — fine at MVP scale

## Deferred from: member-directory Tier-2 code review (Opus 4.8, 2026-06-14)
Accepted P3 residuals (the UUID-404 and moderation-attribution findings were fixed in this pass):

- Concurrent-write race: a just-dismissed activation nudge can reappear once if a member updates notification preferences in the same instant, because updatePreferences does a read-modify-write overwrite while dismissNudge uses an atomic jsonb merge [src/services/userService.js updatePreferences]. Cosmetic; fix would switch updatePreferences to a jsonb `||` merge of changed keys.
- Key-rotation re-save data loss: after an ENCRYPTION_KEY rotation, getMyProfile returns '' for undecryptable phone/household; saving any field then overwrites the (still-recoverable-with-old-key) ciphertext with NULL [src/services/MemberDirectoryService.js getMyProfile/saveMyProfile]. Only reachable during the documented key-rotation ops procedure (docs/SECURITY_ENCRYPTION.md §9); fix would distinguish decrypt-failure from empty and skip overwriting *_encrypted when unreadable.
