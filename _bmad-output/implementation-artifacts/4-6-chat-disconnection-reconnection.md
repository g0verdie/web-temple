# Story 4.6: Chat Disconnection & Reconnection

Status: done

<!-- Retrospective story. -->

## Story

As a viewer whose WebSocket drops momentarily (laptop sleep, brief network blip, mobile-to-WiFi handoff),
I want the chat to silently reconnect and resume,
so that a transient drop doesn't force me to refresh the page or lose my place.

## Acceptance Criteria

1. When the WebSocket `close` fires with `event.wasClean === false`, the client triggers `attemptReconnection()`.
2. Reconnection backoff is 2s, then 5s, then 10s for attempts 1 through 3.
3. During each backoff, the connection status indicator shows "Connecting..." (yellow/connecting dot).
4. If `connectWebSocket()` succeeds on a reconnect attempt, `reconnectAttempts` resets to 0 and any active `reconnectTimer` is cleared.
5. After 3 consecutive failures, control transfers to polling-mode (Story 4.5) — reconnection logic does not loop indefinitely.
6. A "Try Reconnect" button in the slow-connection banner lets the user force a fresh WS attempt at any time after polling kicks in (`manualReconnect()`).
7. Unsent input text persists across the reconnect because it is mirrored to `sessionStorage` on every `input` event and restored when the chat panel re-renders.
8. Clean closes (`event.wasClean === true`, e.g. server-initiated shutdown) do NOT trigger auto-reconnect.

## Tasks / Subtasks

- [x] `attemptReconnection()` with bounded retry counter and indexed interval array.
- [x] Pre-connect socket close in `connectWebSocket()` to guard against stale handles.
- [x] Status indicator updates on each transition (`updateStatus('connecting'|'connected'|'disconnected')`).
- [x] `sessionStorage` mirror for unsent input on every input event.
- [x] `manualReconnect()` clears polling interval + reconnect counter, re-opens WS.
- [x] Tests covering reconnect counter reset on successful open and polling transition after 3 failures.

## Dev Notes

- Backoff array (2s / 5s / 10s) is chosen to ride out short blips while not hammering the server during sustained outages. Total worst-case wall-clock before polling kicks in: ~17s.
- The pre-connect `socket.close()` inside `connectWebSocket()` is defensive — in normal flow `socket` is null or already-closed at that point.
- `event.wasClean` is the only signal differentiating a moderator-side kick or server shutdown from a network failure. If the server later needs to force-reconnect specific clients, this is the lever to flip.

### Architecture Compliance

- Reconnection logic lives entirely on the client; server has no concept of "expecting a reconnect" — it just sees a new WS upgrade with the same JWT cookie or guest name.
- Polling fallback is the failure mode for reconnect, not the other way around — keeps the two stories' boundaries clean.

### File List

- `public/js/live-chat.js` (attemptReconnection, reconnectIntervals, manualReconnect, sessionStorage input mirror)
- `__tests__/integration/chatSocket.test.js`

### References

- Source: _bmad-output/planning-artifacts/epics.md § Epic 4 Story 4.6
- Source: _bmad-output/planning-artifacts/prd.md, FR112

## Completion Notes

- The 50-conn cap (Story 4.7) means a reconnect attempt during a full stream returns 503; the client treats it as a generic close and proceeds to the next backoff slot. That's acceptable behavior — eventually polling kicks in and the user still sees messages.
