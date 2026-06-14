# Story 4.4: Chat Persistence and History

Status: review

<!-- Retrospective story. -->

## Story

As a member viewing a recording after a service,
I want to see the approved chat messages that ran alongside the live stream,
so that I can review the conversation that happened during the service I missed.

## Acceptance Criteria

1. A new table `chat_messages` persists every message with `id`, `stream_id` (FK to `scheduled_streams` ON DELETE CASCADE), `user_id` (FK to `users` ON DELETE SET NULL), `display_name`, `message_text`, `status`, and timestamps.
2. Composite index `(stream_id, status)` exists so the approved-messages-for-stream query stays under threshold at MVP capacity.
3. Index on `created_at ASC` supports chronological retrieval and `since=` polling filters.
4. `status` accepts only `'pending'`, `'approved'`, or `'deleted'` (enforced in application code; documented in the table COMMENT).
5. `ChatService.getApprovedMessagesForStream(streamId)` returns approved messages for a stream sorted by `created_at ASC`.
6. `ChatService.getMessagesForRecording(serviceDate)` matches a `scheduled_streams` row within ±6 hours of the given recording's service date and returns its approved messages; handles bad date input by returning `[]` rather than throwing.
7. The recording detail view (`views/recordings/show.ejs`) renders the historical chat alongside the recording playback when matching messages exist.

## Tasks / Subtasks

- [x] Migration `017_create_chat_messages_table.sql` with indexes and comment.
- [x] `ChatService.getApprovedMessagesForStream` with stream-ID validation.
- [x] `ChatService.getPendingMessages` for the moderation queue.
- [x] `ChatService.getMessagesForRecording` (±6h window match against `scheduled_streams.scheduled_start`).
- [x] Wire historical chat into `recordingController` so the show view receives a `chatMessages` collection.
- [x] Update `views/recordings/show.ejs` to render the historical chat panel below the player when messages exist.
- [x] Tests for query shape and stream-recording matching window.

## Dev Notes

- Stream→recording linkage is by timestamp window (±6 hours), not by an explicit FK, because recordings are published asynchronously and the publish row doesn't know the originating scheduled_stream's ID at insert time. This is acceptable at MVP scale; if collision becomes possible (two streams in a 12-hour window) the matching logic will need tightening.
- `users.id` is UUID, so the FK is `UUID NULL REFERENCES users(id)`; guest messages carry `user_id = NULL`.
- ON DELETE CASCADE on `stream_id` means deleting a scheduled_streams row drops its chat history; this matches the audit-log convention of preferring cascade over orphan rows for short-lived live data.

### Technical Requirements

- All four CRUD/read operations go through `ChatService`; no controller-level SQL.
- Index choices target the two hot read paths: pending-moderation list and approved-feed render.

### Architecture Compliance

- Standard migration runner (`scripts/migrate.js`) applies the file in lexical order. No bootstrap rule changes.
- No raw SQL in controllers; everything goes through `ChatService` or `chatSocketServer`.

### File List

- `migrations/017_create_chat_messages_table.sql`
- `src/services/ChatService.js` (getApprovedMessagesForStream, getPendingMessages, getMessagesForRecording)
- `src/controllers/recordingController.js` (load chatMessages for recording show)
- `src/views/recordings/show.ejs` (render historical chat panel)
- `__tests__/services/ChatService.test.js`

### References

- Source: _bmad-output/planning-artifacts/epics.md § Epic 4 Story 4.4
- Source: _bmad-output/planning-artifacts/prd.md, FR19, FR15
- Source: migrations/015_create_scheduled_streams_table.sql (Story 3.6 — `scheduled_streams` parent table)

## Completion Notes

- ±6 hour matching window assumes services don't overlap; revisit if multi-track services ever ship.
- Cascade delete on `stream_id` is deliberate — if a scheduled stream is removed, its chat history goes with it (no orphaned messages pointing at nothing).
