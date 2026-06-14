# Story 4.3: Chat Moderation Controls

Status: review

<!-- Retrospective story. -->

## Story

As a moderator (Admin, Rabbi, or Social Chair),
I want to approve, delete, and pause pending chat messages,
so that I can keep the live chat safe and on-topic during services.

## Acceptance Criteria

1. A new RBAC permission `MODERATE_CHAT` is defined and granted to Admin, Rabbi, and Social Chair roles only.
2. A protected admin page at `GET /admin/chat-moderation` lists all `status = 'pending'` messages with author, timestamp, and Approve / Delete actions.
3. Approving a message updates `status = 'approved'`, writes an audit-log entry (`CHAT_MESSAGE_APPROVED`), and broadcasts a `message_approved` packet to every viewer of that stream over WebSocket.
4. Deleting a message updates `status = 'deleted'`, writes `CHAT_MESSAGE_DELETED` audit entry, and broadcasts a `message_deleted` packet so connected clients remove the row from the DOM.
5. Moderation actions are also accepted over WebSocket (`approve_message`, `delete_message`, `pause_chat` packet types) for moderators connected via the chat panel; the server rejects them with `unauthorized` for non-moderator roles.
6. A `pause_chat` broadcast disables the input and changes the placeholder to "Chat has been paused by moderator" on all clients; unpause re-enables the input.
7. REST endpoints `POST /api/chat/message/:id/approve` and `POST /api/chat/message/:id/delete` are protected by `requireRbac('MODERATE_CHAT')`.
8. The moderation queue page returns 200 with an "All caught up" alert when no pending messages remain.

## Tasks / Subtasks

- [x] Add `MODERATE_CHAT` permission constant in `src/config/roles-permissions.js`; assign to `ADMIN`, `RABBI`, `SOCIAL_CHAIR`.
- [x] Extend `auditService.AUDIT_ACTIONS` with `CHAT_MESSAGE_APPROVED` and `CHAT_MESSAGE_DELETED`.
- [x] `ChatService.approveMessage` / `deleteMessage` with audit-log side effects.
- [x] REST routes in `src/routes/api.js` (approve/delete with RBAC gate).
- [x] `chatController.getPendingMessagesPage` rendering `views/admin/chat-moderation.ejs`.
- [x] Moderation queue UI with CSRF-protected fetch buttons, fade-out row removal, and pending count.
- [x] WebSocket handlers for `approve_message`, `delete_message`, `pause_chat` with role check.
- [x] Tests for permission gate and audit-log writes.

## Dev Notes

- Pause is stateless on the server (a broadcast, not a stored stream flag). If a viewer joins after a pause, they don't see paused state until the next pause packet — accepted tradeoff for MVP.
- Moderators see the same chat panel as regular viewers but their WebSocket role lets them issue moderation packets directly without leaving the page.
- `chat-moderation.ejs` uses CSP-friendly external JS only — no inline event handlers.

### Architecture Compliance

- Moderation REST endpoints go through `requireRbac('MODERATE_CHAT')` middleware; no inline role checks in controllers.
- Audit writes share the existing `auditService.log` path; new action constants added to `AUDIT_ACTIONS`, not invented strings.
- Moderation page renders through the standard `res.render('layout', { bodyView, viewData })` pattern.

### File List

- `src/config/roles-permissions.js` (MODERATE_CHAT permission, role grants)
- `src/services/ChatService.js` (approveMessage, deleteMessage)
- `src/services/auditService.js` (CHAT_MESSAGE_APPROVED, CHAT_MESSAGE_DELETED actions)
- `src/services/chatSocketServer.js` (WS approve/delete/pause handlers + hasModeratorPermission)
- `src/controllers/chatController.js` (approveMessage, deleteMessage, getPendingMessagesPage)
- `src/routes/api.js` (moderation REST endpoints)
- `src/routes/admin/dashboard.js` (mount /admin/chat-moderation route)
- `src/views/admin/chat-moderation.ejs`
- `src/views/admin/dashboard.ejs` (chat moderation card linkout)
- `__tests__/integration/chatRoutes.test.js`

### References

- Source: _bmad-output/planning-artifacts/epics.md § Epic 4 Story 4.3
- Source: _bmad-output/planning-artifacts/prd.md, FR16, FR17, NFR-S8

## Completion Notes

- The "pause chat" feature ships as broadcast-only (no DB persistence of paused state). Latecomers won't see the paused state until the next pause packet — accepted tradeoff per MVP scope.
- Social Chair role gets MODERATE_CHAT in this story; the role itself has no other powers yet (per the Epic 3.6 review decision to keep TREASURER additions narrowly scoped).
