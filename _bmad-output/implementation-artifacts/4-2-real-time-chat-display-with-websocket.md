# Story 4.2: Real-Time Chat Display with WebSocket

Status: review

<!-- Retrospective story. -->

## Story

As a viewer of a live stream,
I want approved chat messages to appear in real time without page refresh,
so that the conversation feels live alongside the broadcast.

## Acceptance Criteria

1. A WebSocket server is mounted at `/ws/chat?streamId=…` and shares the HTTP server (single port, no separate process).
2. Connections authenticate via the existing `auth_token` JWT cookie when present; otherwise require a non-empty `guestName` query param (≤50 chars).
3. On connect, the server returns a `connection_established` packet with display name, role, and stream ID, then the client fetches initial approved messages via REST so the feed isn't blank.
4. When a message is approved (auto or by moderator), the server broadcasts `message_approved` to all clients on that `streamId`; clients append it.
5. Duplicate rendering is prevented client-side via `postedMessageIds` and an existing-element check keyed by `msg-${id}`.
6. The chat messages container is `aria-live="polite"` with `aria-relevant="additions"`; a toggle lets users mute screen-reader announcements.
7. Connection status (connecting / live / disconnected) renders as a colored dot + text label in the chat header.
8. The server cleans up `connections[streamId]` Set on every `close` event and drops the streamId key when the Set is empty.

## Tasks / Subtasks

- [x] Initialize `ws.Server({ noServer: true })` and hook the HTTP upgrade event for `/ws/chat`.
- [x] Implement `connectionContext` payload (streamId, userId, displayName, role) and attach to wsClient.
- [x] Implement `broadcastMessage(streamId, payload)` that skips non-OPEN sockets.
- [x] Client `connectWebSocket()` with status updates and `fetchInitialMessages` on open.
- [x] Client `handleSocketPacket` switch (connection_established, message_approved, message_posted, message_deleted, chat_paused, error).
- [x] `removeMessageFromUI` for deletions broadcast by moderators.
- [x] Integration tests for socket connect/auth/broadcast (`__tests__/integration/chatSocket.test.js`).

## Dev Notes

- `ws` (not `socket.io`) was chosen to keep the dependency surface narrow and align with the project's no-frontend-framework stance.
- Display-name resolution lives in `chatSocketServer.resolveUserDisplayName` and mirrors the controller helper — kept duplicated rather than extracting because they need to handle different fallback values.
- Approved-message broadcast also fires from the moderator approve path so that pending → approved transitions surface to all viewers without refresh.

### Architecture Compliance

- WS server attaches to the existing HTTP server in `src/server.js` line 221-222 via `initChatSocketServer(server)`; respects `app.enable('trust proxy')` and the X-Forwarded-For header for IP detection.
- No new long-running process — same `node src/server.js` entry point.
- Cookie parsing reuses the standard semicolon split rather than pulling in `cookie-parser` inside the WS path.

### File List

- `src/services/chatSocketServer.js` (initChatSocketServer, broadcastMessage)
- `src/server.js` (wires WS upgrade handler)
- `public/js/live-chat.js` (connectWebSocket, handleSocketPacket, appendMessage, removeMessageFromUI)
- `src/views/home.ejs` (loads live-chat.js when stream.status === 'live')
- `public/css/live-chat.css`
- `__tests__/integration/chatSocket.test.js`

### References

- Source: _bmad-output/planning-artifacts/epics.md § Epic 4 Story 4.2
- Source: _bmad-output/planning-artifacts/prd.md, FR15, FR18, FR20, NFR-Sc1, NFR-P2
- Source: _bmad-output/planning-artifacts/architecture.md (WebSocket section)

## Completion Notes

- WebSocket auth covers both JWT cookie and guest name fallback in a single upgrade handler.
- Verified broadcast hits only the matching `streamId` connection set, not all sockets.
