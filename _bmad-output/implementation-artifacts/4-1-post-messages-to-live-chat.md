# Story 4.1: Post Messages to Live Chat

Status: done

<!-- Retrospective story: code authored prior to story drafting; AC verified against shipped implementation. -->

## Story

As a visitor or member watching a live stream,
I want to post messages into the live chat panel during a service,
so that I can participate in the community conversation in real time.

## Acceptance Criteria

1. When a stream's `scheduled_streams.status = 'active'`, the homepage renders a chat panel attached to the active stream's ID.
2. Logged-out visitors are prompted for a display name before posting (stored in `sessionStorage` so they don't re-enter on refresh).
3. Logged-in users post under their resolved display name (first+last → first → email local-part) without an extra prompt.
4. Each posted message is validated server-side: display name ≤50 chars, message body ≤500 chars, both required.
5. Suspected spam (>70% uppercase or contains URL-like substrings) is auto-routed to `status = 'deleted'` server-side; everything else lands as `status = 'pending'` for moderation.
6. WebSocket posts return a `message_posted` receipt to the poster and broadcast `message_pending` to moderators when status is `pending`.
7. A REST fallback at `POST /api/chat/post` accepts the same payload and broadcasts to WS clients when it succeeds.
8. The chat input is keyboard-accessible, has `aria-label`, and persists unsent text across refreshes via `sessionStorage`.

## Tasks / Subtasks

- [x] Validate message payload server-side (`ChatService.validateMessage`).
- [x] Implement spam heuristic (`ChatService.checkIsSpam` — caps ratio + URL regex).
- [x] Write `ChatService.createMessage` with pending/deleted status branching.
- [x] Wire WebSocket `post_message` handler to call `createMessage` + emit receipt + broadcast pending notice to moderators.
- [x] REST fallback `POST /api/chat/post` in `chatController.postMessage`.
- [x] Client-side guest name prompt + display-name resolution for logged-in users (`public/js/live-chat.js`).
- [x] Unit tests for validation, spam detection, and createMessage status routing.

## Dev Notes

- Spam check is intentionally conservative: any URL-shaped substring auto-deletes. Moderators see deleted messages only if they query directly; the UI never renders them.
- `userId` is left `NULL` for guest posters; `display_name` is the canonical render source either way.
- WebSocket and REST paths share `ChatService.createMessage` — there is no parallel posting path.

### Technical Requirements

- All chat writes are transactional inserts into `chat_messages` (one row per post).
- Guest display name capped at 50 chars at both client and server validation layers.
- Server logs validation failures via `utils/logger` (no `console.log` in `src/`).

### Architecture Compliance

- Stays within monolith: route/WS handler → controller → service → DB.
- Reuses CSRF via the existing meta-tag / hidden input pattern for the REST path.
- WS receives JWT cookie via the upgrade handler; no parallel auth mechanism.

### File List

- `src/services/ChatService.js` (createMessage, validateMessage, checkIsSpam)
- `src/services/chatSocketServer.js` (post_message handler)
- `src/controllers/chatController.js` (postMessage REST)
- `src/routes/api.js` (POST /api/chat/post)
- `public/js/live-chat.js` (renderNamePrompt, handleSendMessage, postMessageREST)
- `__tests__/services/ChatService.test.js`
- `__tests__/integration/chatRoutes.test.js`

### References

- Source: _bmad-output/planning-artifacts/epics.md § Epic 4 Story 4.1
- Source: _bmad-output/planning-artifacts/prd.md, FR14, FR15, FR16, FR109

## Completion Notes

- All 36 chat-related tests pass.
- Spam heuristic is intentionally aggressive; tuning will happen post-launch based on real moderator workload.
