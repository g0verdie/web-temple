# Story 4.7: Chat Capacity Management

Status: review

<!-- Retrospective story. -->

## Story

As an operator,
I want the chat WebSocket server to enforce a per-stream connection cap,
so that a viral moment or a malicious flood can't exhaust server resources during a live service.

## Acceptance Criteria

1. `chatSocketServer.MAX_CONCURRENT_CONNECTIONS = 50` is the per-stream cap.
2. New connections counted against `connections[streamId].size` at upgrade time; once size ≥ cap, the upgrade is rejected with `HTTP/1.1 503 Service Unavailable` and the socket is destroyed.
3. The cap is enforced **before** authentication, so spam connection attempts can't bypass it.
4. `getActiveConnectionCount(streamId)` is exported and returns 0 for unknown stream IDs.
5. Closed connections (clean or unclean) are removed from `connections[streamId]` in the `'close'` handler.
6. When all sockets for a stream close, the `streamId` key is deleted from the `connections` object so it doesn't grow unbounded across many streams.
7. `closeAllConnections()` exists as a shutdown helper that closes every open client and clears the connections map.

## Tasks / Subtasks

- [x] Define `MAX_CONCURRENT_CONNECTIONS` constant.
- [x] Cap check inside the `/ws/chat` upgrade branch (before auth).
- [x] Per-stream `Set` tracking with `.add` on connect, `.delete` on close.
- [x] Empty-set cleanup of the stream ID key.
- [x] `closeAllConnections()` shutdown helper.
- [x] Tests covering 50-conn enforcement and post-close cleanup.

## Dev Notes

- **Open gap vs. PRD NFR-Sc1:** the PRD specifies that an over-cap connection should be **redirected to Facebook Live** with a friendly message, not just rejected with 503. Current behavior is hard-rejection. **This is flagged for the code-review pass before Epic 4 close-out** — see Review Findings.
- The cap is per stream, not server-wide. If the temple ever runs two simultaneous streams, the effective cap doubles. Accept for MVP.
- `connections[streamId]` is process-local; if the app is ever load-balanced across multiple Node processes, this state needs to move to Redis. Out of scope for MVP — explicitly note in the deployment runbook.

### Technical Requirements

- Capacity rejection must happen pre-auth so guests and authenticated users are throttled equally.
- The 50-conn ceiling is hardcoded; if it needs to be configurable, expose via `process.env.CHAT_MAX_CONNECTIONS` in a follow-up.

### Architecture Compliance

- All connection state lives in `chatSocketServer.js` — no parallel registry elsewhere.
- No shared global state with other services; the WS server is self-contained.

### File List

- `src/services/chatSocketServer.js` (MAX_CONCURRENT_CONNECTIONS, getActiveConnectionCount, closeAllConnections, cap check in upgrade handler)
- `__tests__/integration/chatSocket.test.js`

### References

- Source: _bmad-output/planning-artifacts/epics.md § Epic 4 Story 4.7
- Source: _bmad-output/planning-artifacts/prd.md, NFR-Sc1, NFR-Sc2, NFR-R3, FR18, FR20, FR61

## Review Findings

- [ ] [Review][Gap] Over-cap redirect to Facebook Live not implemented (PRD NFR-Sc1 specifies friendly redirect; current code returns bare 503). Decide between (a) implementing the redirect in the upgrade handler with a JSON body the client can render, or (b) accepting 503 + client banner as MVP behavior and updating the PRD.

## Completion Notes

- 50-conn cap exceeds the PRD's 20-concurrent MVP target with headroom for the Month 6 30-50 target without code change.
- The 1000-conn growth scenario in the PRD requires the redirect-to-Facebook overflow behavior — punted to Phase 2 unless flagged otherwise.
