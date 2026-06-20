# Video Surface Consolidation — Requirements & Design

**Date:** 2026-06-20
**Status:** Approved (design); ready for implementation plan
**Branch:** `feat/video-watch-consolidation`

## Context

The site exposes three *unrelated* video surfaces backed by two different data sources:

1. **Homepage live** — from the `scheduled_streams` table (public), rendered as a hero on `/`.
2. **`/watch` "Past Services"** — public, sourced from **Facebook** (`PastVideoService` → Graph API or a curated fallback list). Not the database.
3. **`/archive`** — members-only (`router.use(requireAuth)`), from the local `recordings` table (`RecordingService`), with an admin "publish recording" workflow and a recording-detail page that also replays that stream's archived live chat.

Two video nav links ("Watch" and "Archive") confuse visitors, and the two surfaces are entirely separate libraries — not two views of one. The owner's direction: **mirror Facebook as the source of truth instead of storing videos locally, and present a single public "Watch" tab** showing past Facebook videos plus the current live stream when one is available.

## Decisions (locked)

- **Facebook is the source of truth** for past videos. This is already `PastVideoService`'s architecture; true mirroring is operator config, not code.
- **One public "Watch" tab.** Retire the local archive: remove the "Archive" nav link, **301-redirect `/archive` and `/archive/:id` → `/watch`**, and **delete** the recordings code + admin "publish recording" UI (owner approved deletion of unused code).
- **Archived live chat goes away** with the archive (it was a live-service feature; replaying it on past Facebook videos isn't core).
- **Live shows in both places:** keep the homepage live hero AND surface the live stream at the top of the Watch tab when live.
- **Live detection unchanged:** keep `scheduled_streams` + the admin "Go Live" flow (it powers the homepage "upcoming service" countdown). No streaming-admin changes.

Because every Watch item is now public Facebook content, the public-vs-member labeling/gating ideas (#7, #9) and the per-item visibility column (#8) are **out of scope** — they no longer apply.

## Scope

### Remove (delete)
- `src/controllers/recordingController.js`
- `src/services/RecordingService.js`
- `src/routes/admin/recordings.js`
- `src/views/recordings/index.ejs`, `src/views/recordings/show.ejs` (and the `src/views/recordings/` dir)
- `src/views/admin/recordings/list.ejs` (and the `src/views/admin/recordings/` dir)
- `public/js/admin-recordings.js`
- Server wiring in `src/server.js`: the `adminRecordingsRoutes`/`recordingsRoutes` requires (lines ~230, ~239) and the `app.use('/admin/recordings', …)` mount (line ~255).
- The "publish recording → email members" flow (lives inside `RecordingService`) and its email template usage `new-recording-available` (template file may be left in place, harmless, or removed — implementer's call; note it if left).

### Replace with redirects
- `src/routes/recordings.js` becomes a thin **redirect router**: `GET /` → `301 /watch`, `GET /:id` → `301 /watch`. Stays mounted at `app.use('/archive', …)`. Public (no `requireAuth`) so old member bookmarks resolve.

### Repoint links
- `src/views/layout.ejs:111` — remove the "Archive" nav `<li>`.
- `src/views/admin/dashboard.ejs:125` — remove the "Recordings" admin button.
- `src/views/home.ejs:76` — repoint the offline-state CTA `/archive` → `/watch` (keep or adjust the "View Recordings" label).
- `src/views/admin/streaming/index.ejs:113` — minor copy: "reverts the site to showing recordings" → reflect Watch (optional polish).

### Add — live on the Watch tab
- Extract `buildStreamViewModel` out of `src/controllers/homeController.js` into a small shared helper (e.g. `src/utils/streamViewModel.js`) imported by both `homeController` and `watchController`. (Targeted refactor to avoid duplicating the live view-model logic.)
- `src/controllers/watchController.js` — also call `StreamingService.getPublicEmbedMetadata().catch(() => …)` (same defensive pattern as the homepage), build the `stream` view-model, and pass it in `viewData`. Never let `/watch` 500 (preserve the existing try/empty-state guarantee).
- `src/views/watch/index.ejs` — render a live section at the top when `stream.status === 'live'` (embed). When not live, render the existing past-videos grid unchanged.

### Keep (do NOT touch)
- Migrations `012`–`014` (recordings table) — historical; the table simply goes unused. The "don't reorder/rename migrations" rule stands.
- Everything under `/admin/calendar/archive` — that is the **calendar event** archive, unrelated to video.
- `PastVideoService` and its sources (`GraphApiSource`, `CuratedSource`, curated list) — unchanged.
- `scheduled_streams`, `StreamingService`, the streaming admin flow, and the homepage live hero.

## Operator follow-up (not code)
True Facebook mirroring is enabled by setting `PAST_VIDEO_SOURCE=graph` plus `FACEBOOK_PAGE_ID` and `FACEBOOK_PAGE_ACCESS_TOKEN` (and optionally `FACEBOOK_GRAPH_API_VERSION`). `GraphApiSource` already exists and degrades to the curated list on failure. Document this in the env/runbook; no application code is required for it in this feature.

## Testing (TDD)
**Add:**
- `GET /archive` → `301` with `Location: /watch`; `GET /archive/:id` → `301 /watch`.
- `/watch` renders the live section when `StreamingService.getPublicEmbedMetadata()` reports `live`, and renders only the past-videos grid when offline. `/watch` still returns 200 (never 500) when the streaming lookup throws.

**Remove (obsolete):**
- `__tests__/services/RecordingService.test.js`
- `__tests__/routes/archiveRoutes.test.js` (replace with the redirect test)
- `__tests__/routes/recordingsDetail.test.js`
- `__tests__/integration/adminRecordingsRoutes.test.js`
- `__tests__/views/recordingsDetail.accessibility.test.js`

**Update (prune recordings cases only; leave calendar-archive cases alone):**
- `__tests__/integration/adminHandlersCsp.test.js`, `__tests__/routes/seo.test.js`, `__tests__/integration/sitemap.test.js`, `__tests__/scripts/seedDemo.test.js`.
- `scripts/seed*` — stop seeding demo recordings.

**Gate:** full suite **3×** + `npm run lint` clean. Accessibility test for the updated Watch view (jest-axe, mirroring existing `*.accessibility.test.js`).

## Non-goals
- Per-item public/members visibility on videos (#7/#8/#9) — N/A now that everything is public.
- Auto-detecting "live" from the Facebook Graph API — keeping the admin "Go Live" flow.
- Auto-drafting a recording when a stream ends (#5) — moot once the local recordings store is retired.
- Deleting or reordering migrations.

## Verification (end-to-end)
1. `npm run dev` against the local stack; `GET /watch` shows past videos (curated fallback) and, with an active scheduled stream, a live section at top.
2. `GET /archive` and `/archive/<id>` 301 to `/watch` (curl `-I`).
3. Nav shows a single "Watch" (no "Archive"); admin dashboard has no "Recordings" button; admin can still schedule/Go-Live.
4. Homepage live hero still renders; offline CTA points at `/watch`.
5. Full suite 3× + lint green; Watch a11y test green.
