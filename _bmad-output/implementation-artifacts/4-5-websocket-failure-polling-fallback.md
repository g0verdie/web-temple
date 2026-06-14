# Story 4.5: WebSocket Failure & Polling Fallback

Status: review

<!-- Retrospective story. -->

## Story

As a viewer on a flaky connection (or behind a WebSocket-hostile proxy),
I want the chat to keep working over plain HTTP polling when the WebSocket can't stay up,
so that I'm not silently dropped from the conversation.

## Acceptance Criteria

1. After 3 consecutive reconnect failures, the client `switchToPollingMode()` and shows a "Slow connection. Using polling fallback." banner with a "Try Reconnect" button.
2. In polling mode, `fetchMessagesPoll()` runs every 3 seconds against `GET /api/chat/poll?streamId=…&since=…` and renders any new approved messages.
3. The `since=` parameter is the ISO timestamp of the last rendered message; the server filters server-side so polling is incremental, not full-feed.
4. Posting in polling mode falls through to `POST /api/chat/post` with the CSRF token (read from `meta[name="csrf-token"]` or hidden `_csrf` input).
5. The polling endpoint returns `{ success: true, data: [...] }` on success and `400` on missing/invalid `streamId`.
6. Manual reconnect (button click) clears the polling interval, resets the reconnect attempt counter, hides the banner, and re-tries the WebSocket.
7. Polling does not double-render messages that were already on screen (dedupe by existing `msg-${id}` DOM node).

## Tasks / Subtasks

- [x] `switchToPollingMode()` in `live-chat.js` with banner display and interval start.
- [x] `fetchMessagesPoll()` with incremental `since=` filtering and dedupe via `appendMessage`.
- [x] `postMessageREST(text)` for polling-mode posts (CSRF-aware).
- [x] `manualReconnect()` to drop polling and retry WS on demand.
- [x] `GET /api/chat/poll` controller (`chatController.getMessagesPoll`) and route registration.
- [x] Tests for polling endpoint contract (`__tests__/integration/chatRoutes.test.js`).

## Dev Notes

- 3-second poll interval is a compromise between perceived liveness and server load. PRD NFR-Sc1 targets ≤20 concurrent at MVP; at that scale this is fine.
- CSRF token discovery checks both the meta tag and a hidden input — different rendering paths populate one or the other.
- The polling endpoint is intentionally read-only-public (no auth) so guests can see chat history even if they bounce off the WS; posting still requires CSRF.

### Architecture Compliance

- Polling uses the same `ChatService.getApprovedMessagesForStream` as the WS bootstrap, so message-shape stays in sync across the two paths.
- No new caching layer; CacheService isn't appropriate for a 3-sec poll loop that needs fresh data.

### File List

- `public/js/live-chat.js` (switchToPollingMode, fetchMessagesPoll, postMessageREST, manualReconnect)
- `src/controllers/chatController.js` (getMessagesPoll)
- `src/routes/api.js` (GET /api/chat/poll)
- `public/css/live-chat.css` (slow-connection-banner styles)
- `__tests__/integration/chatRoutes.test.js`

### References

- Source: _bmad-output/planning-artifacts/epics.md § Epic 4 Story 4.5
- Source: _bmad-output/planning-artifacts/prd.md, FR20

## Completion Notes

- Polling endpoint logs errors via the logger but returns a generic 500 message — no internal error leakage.
- Banner uses an existing aria-live region (the chat status header) implicitly via DOM proximity; explicit aria-live on the banner itself was considered but not required by AC.
