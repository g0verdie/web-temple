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

## Deferred from: donations (Epic 8) mock-MVP build + 3-persona code review (Opus 4.8, 2026-06-14)
Accepted residuals (the P0/P1 integrity + dashboard-correctness findings were fixed in the build):

- Mock checkout intentionally trusts the client-supplied demo outcome — acceptable for a no-money Board demo and bounded by the ownership cookie, the per-IP rate limiter, and idempotent finalize. MUST be replaced by provider-authoritative capture (verified PayPal callback) before real payments go live [src/services/payments/MockPaymentProvider.js].
- MRR has no active/cancelled subscription lifecycle (the mock has no recurring-charge scheduler), so MRR reflects recurring *intents*, not realized revenue. Add a subscription status/cancelled_at lifecycle with live PayPal subscriptions [src/services/DonationService.js getDashboardMetrics].
- The 3-strike failure counter degrades silently if Redis is unavailable (CacheService swallows errors → count stays 0 → alert never fires). The per-IP rate limiter is the primary abuse guard; a DB-count fallback for the alert is the follow-up [src/controllers/donationController.js].
- Major-donation alert (Story 8.7) currently includes amount + date but not donor name or transaction id — minor spec gap [src/controllers/donationController.js sendReceiptAndAlerts].
- donor_email_hash deterministic column for SQL-side donor dedup/counting (app-side decrypt+dedupe is fine at congregation scale).

## Deferred from: announcements (Epic 5) + event calendar (Epic 6) parallel build + 3-persona code review (Opus 4.8, 2026-06-14)
Accepted residuals (the 3 P1 review findings — calendar-email stored XSS, reminder double-fire, stale event cache — and 3 hardening items were FIXED in this pass; see commit 5b3226a).

Cross-cutting (both epics):
- Tokenized one-click unsubscribe + a real `/unsubscribe` route. No `/unsubscribe` handler exists; the email footer points recipients to account settings (satisfies FR88 "manage preferences"). Calendar emails pass `unsubscribeToken: member.id` (raw UUID); announcement emails pass no token. Now exercised at much higher volume by the two new fan-outs. Before real bulk email goes out, add the route + a signed single-purpose token (HMAC over user id) — do NOT trust the raw UUID. [emailTemplateService.appendUnsubscribe / EventService.notifyMembers / AnnouncementService.fanOutAnnouncementEmails]
- Bulk fan-out has no active/verified/soft-deleted user filter (recipients chosen purely by notification_preferences). Matches the existing RecordingService convention (not a regression); deactivated users still receive calendar/announcement email.

Announcements (Epic 5):
- Admin-alert-after-3-failures vs the existing queue `MAX_ATTEMPTS=5`: accepted the 5-attempt behavior (changing the global backoff affects all email types). AC variance noted. [emailQueueService]
- Server-persisted drafts: autosave is localStorage-only; no `/drafts` row state / cross-device drafts.
- Cron-based featured expiry: lazy read-time expiry only (KTD5) — a stale `featured=true` flag can persist in the admin list past 30 days though it stops pinning/badging on the homepage.
- No image-upload pipeline (URL-referenced, alt-required images only) and no dedicated public `/announcements` archive page (homepage shows latest 5).

Event calendar (Epic 6):
- Social Chair members-only parity (OQ4 accepted): `MANAGE_CALENDAR` lets Social Chair create members-only events, though FR27 says "public calendar only." Trusted staff role, no anonymous leak. Follow-up = a visibility-scoped permission if FR27 is binding. [roles-permissions.js / EventService.validate]
- Calendar page (`getEventsInRange`) intentionally does NOT merge scheduled streams — only the homepage paths (`getEvents`) do. Confirm product intent; if livestreamed services should appear on `/calendar`, extend the range read to merge streams.
- Recurring events / RRULE, VTIMEZONE richness, subscribable `webcal://` feed, non-24h reminder windows, and a client-side calendar grid are all deferred per plan scope (KTD3 + Scope Boundaries).
