---
date: 2026-06-14
type: feat
origin: docs/brainstorms/2026-06-14-facebook-video-archive-requirements.md
---

# feat: Public "Past Services" — Facebook video archive

## Summary

A new **public** "Past Services" page (`/watch`, no login) that lists Temple B'nai Israel's previous Facebook videos newest-first and plays each **inline** via the CSP-safe `plugins/video.php` iframe the live stream already uses. Videos come from a **swappable source** behind a small provider seam (mirroring `src/services/payments`): a curated/config list works today and as a fallback, and the Facebook Graph API flips in via one env var when a Page Access Token lands. A cached, resilient service layer fetches server-side, caches the normalized list for hours, degrades gracefully (curated list → empty state with a Facebook-page link, never an error page), and alerts the operator on token failure. The existing members-only manual recordings archive (`/archive`) is left untouched.

---

## Problem Frame

The temple streams services to its Facebook page, so a back-catalog of past services already exists there — but the only way to watch them is to leave the website for Facebook. The site's members-only recordings archive (`/archive`, `requireAuth`) could hold them but is manual-publish and currently unused, so in practice the website surfaces no past services at all. Newcomers and members who come to "watch a recent service" hit a dead end. Pulling the page's already-public videos onto a public on-site page closes that gap and reuses content that is already public on Facebook — exactly what the Board MVP needs to feel complete.

The auto-pull path has one external prerequisite (a Facebook Page Access Token — see Risks), so the design keeps the **curated source** as a first-class interim and fallback: the page ships and demos with curated data now, and the API becomes a config flip when credentials land. **Research correction:** reading the temple's *own* page does **not** require Facebook's full App Review feature queue (that gates reading *arbitrary* pages) — only `pages_read_engagement` + `pages_show_list`, a page-admin long-lived token, and (for Live mode) basic business verification. The prerequisite is lighter and faster than the origin requirements doc assumed.

---

## Requirements

Traceability to origin (`see origin: docs/brainstorms/2026-06-14-facebook-video-archive-requirements.md`).

**Display surface**
- R1. A public `/watch` "Past Services" page (no login) lists the temple's past Facebook videos and plays each inline on the site.
- R2. Videos render newest-first as cards (thumbnail, title, date); selecting one plays it via the on-site `plugins/video.php` embed without leaving the site.
- R3. New, separate surface; the members-only manual recordings archive (`/archive`) is unchanged (no migration, no shared code path beyond the embed helper).

**Video source**
- R4. Past videos are auto-pulled from the temple's Facebook Page via the Facebook Graph API (`GET /{page-id}/videos`).
- R5. The video source is swappable via config: a curated/manual list of Facebook video URLs is both the interim source (before the token lands) and the fallback, interchangeable with the API source.
- R6. By default the page shows all of the page's public videos (service-only filtering deferred).

**Freshness & resilience**
- R7. The normalized video list is cached server-side for several hours and refreshed on expiry — never fetched per page request.
- R8. When the API is unavailable or the token is missing/expired, the page degrades gracefully: curated list if configured, else an empty state linking to the temple's Facebook page — never an error page — and the operator is alerted on token failure.

**Access & privacy**
- R9. Only public Facebook videos are surfaced (filter to `status.video_status === 'ready'` and skip non-public); nothing is exposed that isn't already public on the page.

**Compliance & quality (cross-cutting — verified per unit)**
- R10. CSP guard (`__tests__/security/cspViewCompliance.test.js`) stays green — no inline `<script>`/`<style>`, no FB JS SDK; embeds use the already-allowed `frameSrc https://www.facebook.com`. No `connect-src` change (Graph fetch is server-side).

---

## Key Technical Decisions

- **KTD1. Provider seam, config-selected — mirror `src/services/payments`.** A `PastVideoSource` base class defines one method, `listVideos()`, returning an array of normalized video objects. `src/services/pastVideos/index.js` memoizes and selects the implementation by `PAST_VIDEO_SOURCE` (`curated` default, `graph`), exactly like `payments/index.js` selects by `PAYMENT_PROVIDER` and exposes a `_reset()` test helper. This lets the page run on curated data now and flip to the API later with no view/controller changes. (R4, R5)

- **KTD2. Construct embed URLs from the Graph `id` (numeric Page ID required), never from share/permalink links — and export the embed helper.** Graph returns `id`, not a usable share URL; the project's `share/…` page URL does **not** embed. Build the canonical `https://www.facebook.com/${FACEBOOK_PAGE_ID}/videos/${id}/` and wrap it with `StreamingService.convertToEmbedUrl()` → `plugins/video.php?href=<encoded>&show_text=false`. **`convertToEmbedUrl` is currently a module-level const, not on the exported instance** — it must be exported (`module.exports.convertToEmbedUrl = convertToEmbedUrl`) so both sources can require it instead of duplicating the embed string (keeping live + past-video embeds identical and CSP-safe). **`FACEBOOK_PAGE_ID` must be the numeric Page ID** — a vanity name or share-slug produces a non-embeddable href and every card renders blank while tests still pass (200 + cards present), so this is a hard precondition verified at the probe (see Risks). The curated source normalizes its stored Facebook URLs through the same helper. (R2, R10)

- **KTD3. Long-lived Page Access Token in env, sent as a header and never logged; detect Graph error 190 and alert — no full App Review for own-page reads.** The token is a service credential, so it lives in `FACEBOOK_PAGE_ACCESS_TOKEN` (env, not the encrypted-PII DB path). It is sent via the **`Authorization: Bearer <token>` HTTP header**, not the query string, so a logged request URL never carries it; if a code path must log a URL, the `access_token` value is scrubbed first. Reading the temple's own page needs only `pages_read_engagement` + `pages_show_list` + Live-mode business verification — **not** the App Review feature queue (that gates *arbitrary* pages via Page Public Content Access). The token is effectively non-expiring but is revoked if a page admin changes their password or the role is removed, so the fetch path detects Graph `error.code === 190` (and generic fetch failure) via a tagged `Error` (`err.tokenInvalid = true`), and the service layer both `logger.warn`s (durable signal, independent of email) and alerts the operator. (R4, R8, R9)

- **KTD4. Server-side fetch, multi-hour success cache + short negative cache, single-flight refresh, version-pinned URL.** Graph calls run server-side (no `connect-src` change). The normalized list is cached via `CacheService` under `pastVideos:list` for hours (`PAST_VIDEO_CACHE_TTL_SECONDS`, default 6h) so the page never calls Graph per request. **The degraded/fallback result is also cached, under a short `PAST_VIDEO_FALLBACK_TTL_SECONDS` (default ~15 min)**, so a token outage does not re-hit Graph on every request (which would violate R7) yet recovers quickly once the token is fixed. To avoid a stampede when the cache expires, a refresh acquires a single-flight lock (`SET NX` on `pastVideos:refreshing`); concurrent requests during a refresh serve the last cached value (stale-while-revalidate) rather than each calling Graph. The Graph base URL pins an API version (`FACEBOOK_GRAPH_API_VERSION`, e.g. `v21.0`) because unversioned/oldest-version calls break on Facebook's ~2-year deprecation cycle. (R7)

- **KTD5. Filter to public/ready videos in code, not at query time.** There is no reliable query-time "public only" filter; fetch the page's videos and drop any whose `status.video_status !== 'ready'` (and any the embed can't render — private/unlisted render blank). The curated source is public by construction. (R6, R9)

- **KTD6. Lightbox playback, not one iframe per card.** Cards are `<button>` triggers; clicking one sets the `src` of a single shared `plugins/video.php` player region (driven by an external `public/js/watch.js` — CSP-safe, no inline script). This avoids rendering ~50 simultaneous Facebook iframes (load + third-party-connection cost) and gives one focusable player to manage. Accessibility is specified up front: triggers are `<button>` with `aria-label="Play <title>, <date>"`, the active card carries `aria-current="true"`, and activation moves focus to the player region (`role="region"`, `aria-label="Video player"`, `tabindex="-1"`). (R1, R2, R10)

- **KTD7. The degraded flag drives an operator signal and a visitor notice — it must never look like "no videos yet."** When the Graph source fails but curated has entries, the page returns those entries with `degraded: true`; the most likely production state (Graph dead + curated populated) would otherwise render a healthy-looking grid forever. So `degraded: true` surfaces (a) a `logger.warn` on every failing fetch while `graph` is the active source — the durable operator signal independent of the email alert — and (b) a small visitor notice ("Showing saved past services"). The empty-and-degraded case still renders the empty state with the Facebook-page link. (R8)

---

## High-Level Technical Design

```mermaid
flowchart LR
    V[Visitor] -->|GET /watch| C[watchController]
    C --> S[PastVideoService.getVideos]
    S -->|hit| K[(CacheService\npastVideos:list ~6h\npastVideos:fallback ~15m)]
    S -->|miss, single-flight| SRC{PAST_VIDEO_SOURCE}
    SRC -->|graph| G[GraphApiSource\nGET /{page-id}/videos]
    SRC -->|curated| CU[CuratedSource\nconfig list]
    G -->|err.tokenInvalid / fetch fail| FB[fallback: CuratedSource\nelse empty state, degraded:true]
    FB --> AL[logger.warn + emailService alert\natomic SET NX dedupe]
    G --> N[normalize → convertToEmbedUrl]
    CU --> N
    N --> K
    K --> C --> EJS[watch view: newest-first cards\n→ lightbox plugins/video.php player]
```

Normalized video shape (the seam's contract, all sources return this):
`{ id, title, date (ISO), description, thumbnailUrl, embedUrl }` — `embedUrl` is always the `plugins/video.php` form via the exported `convertToEmbedUrl()`. `getVideos()` returns `{ videos, degraded }`.

---

## Implementation Units

### U1. Provider seam — `PastVideoSource` interface + selector

- **Goal:** Establish the swappable source seam and the normalized video contract both sources return.
- **Requirements:** R4, R5; primes R6, R9.
- **Dependencies:** none.
- **Files:** `src/services/pastVideos/PastVideoSource.js` (base class, one `async listVideos()` throwing "not implemented"), `src/services/pastVideos/index.js` (memoized `getSource()` switching on `PAST_VIDEO_SOURCE`, default `curated`; `_reset()` test helper). Test: `__tests__/services/pastVideos/index.test.js`.
- **Approach:** Copy the shape of `src/services/payments/{PaymentProvider,index}.js` exactly — same memoize + `switch (name)` + `_reset()` structure. Document the normalized shape (above) in a JSDoc on the base class. `index.js` requires both sources but only instantiates the selected one.
- **Patterns to follow:** `src/services/payments/index.js`, `src/services/payments/PaymentProvider.js`.
- **Test scenarios:** Covers R5. `getSource()` returns the curated source by default; returns the Graph source when `PAST_VIDEO_SOURCE=graph`; memoizes (same instance on repeated calls); `_reset()` clears the memo. Unknown value falls back to curated (matches payments' default-case behavior).
- **Verification:** the seam selects a source by env and memoizes; both sources satisfy the `listVideos()` contract; suite green.

### U2. Graph API source — `GraphApiSource`

- **Goal:** Fetch the page's videos from Graph, normalize them, and surface token/fetch failure as a tagged error.
- **Requirements:** R4, R6, R9; advances R10.
- **Dependencies:** U1.
- **Files:** `src/services/pastVideos/GraphApiSource.js`; **modify `src/services/StreamingService.js`** to export the module-level `convertToEmbedUrl` (KTD2 — `module.exports.convertToEmbedUrl = convertToEmbedUrl`). Test: `__tests__/services/pastVideos/GraphApiSource.test.js`. Documents new env vars in `.env.example`.
- **Approach:** `listVideos()` does a server-side `fetch` (native) to `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}/${FACEBOOK_PAGE_ID}/videos?fields=id,description,created_time,picture,status&limit=50`, passing the token in the **`Authorization: Bearer` header**, never the query string (KTD3). **Fetch a single page (`limit=50`) and stop — no `paging.next` follow for the MVP** (a temple page is very unlikely to exceed one page; cursor pagination is a deferred optimization). Map each item: `title` = first line of `description` trimmed and truncated to ~80 chars, falling back to a date-based default like `Service — <formatted date>` (so empty-description videos stay distinguishable, not all identically titled); `date` from `created_time`; `thumbnailUrl` from `picture` (may be absent → handled by U3/U5 placeholder); `embedUrl` by validating `id` matches `/^\d+$/`, building `https://www.facebook.com/${FACEBOOK_PAGE_ID}/videos/${id}/`, and passing it through the exported `convertToEmbedUrl()` (KTD2) — drop non-numeric `id`s with a `logger.warn`. Drop items whose `status.video_status !== 'ready'` (KTD5). **Sort the mapped list newest-first by `date`** (do not rely on Graph's default ordering). On a Graph error body with `error.code === 190` or any non-OK/network failure, throw a tagged `Error` (`err.tokenInvalid = true` for 190) — do NOT return partial/empty silently; U4 decides fallback + alert. Pin the version; never call unversioned.
- **Patterns to follow:** the exported `convertToEmbedUrl` (reuse, don't reimplement); env-driven config like `StreamingService` reading `FACEBOOK_LIVE_WATCH_URL`; `src/utils/logger.js` for diagnostics (no `console.log`).
- **Test scenarios:** Covers R4, R6, R9. Mock `fetch`. (a) Happy path: a videos payload maps to the normalized shape with a correct `plugins/video.php` `embedUrl` built from `id`, sorted newest-first. (b) A `video_status !== 'ready'` item is dropped (R9). (c) A non-numeric `id` is dropped with a warn (S4). (d) An empty-description item gets the date-based default title, not a blank/shared title. (e) `error.code === 190` → throws with `tokenInvalid === true`. (f) Network/non-OK → throws (not silent empty). (g) The fetch URL has no `access_token` query param (token is in the header) and carries the pinned `FACEBOOK_GRAPH_API_VERSION`.
- **Verification:** real-shaped payloads normalize + sort correctly; embed URLs are canonical-numeric-id-derived and CSP-safe; the token never appears in the URL; token failure is detectable by the caller.

### U3. Curated/fallback source — `CuratedSource`

- **Goal:** Serve a developer-maintained list of Facebook video URLs as the interim source and the fallback, normalized identically to the API source — and ship a real seed so the Board demo is never blank.
- **Requirements:** R5.
- **Dependencies:** U1.
- **Files:** `src/services/pastVideos/CuratedSource.js`, `src/services/pastVideos/curatedVideos.js` (committed config: an exported array of `{ url, title, date, description }`). Test: `__tests__/services/pastVideos/CuratedSource.test.js`.
- **Approach:** `listVideos()` reads the committed array, **validates each entry's `url` through the existing `StreamingService.isAllowedProviderUrl` (facebook.com / fb.watch only)** — skipping any that fail with a `logger.warn` (this is the validation gate that must be preserved if an admin CRUD ever replaces the module) — then sorts newest-first by `date` and normalizes to the shared shape (`embedUrl` via the exported `convertToEmbedUrl(url)`, `thumbnailUrl` optional → U5 placeholder when absent). Edited via PR for the MVP (no admin CRUD — confirmed scope). Tolerate an empty list (returns `[]`, drives the empty state in U5). **Seed deliverable (owned, demo precondition):** populate `curatedVideos.js` with 2–4 real *public service* video URLs pulled from the temple page (`https://www.facebook.com/share/18jfSPTgMw/`) before the Board demo — this is the linchpin that makes the page non-empty while the Graph token is pending, so it is a hard U3 acceptance item, not an Open Question.
- **Patterns to follow:** `StreamingService.isAllowedProviderUrl` + exported `convertToEmbedUrl`; the committed-config convention (config modules under `src/`).
- **Test scenarios:** Covers R5. (a) A curated list normalizes to the same shape as the Graph source, newest-first. (b) Each `embedUrl` is the `plugins/video.php` form. (c) Empty list returns `[]` without throwing. (d) A non-facebook.com / malformed `url` is skipped with a warn, not fatal (S3). (e) The shipped `curatedVideos.js` is non-empty (guards the demo against silently shipping a blank page — P2).
- **Verification:** curated entries render identically to API-sourced ones (AE3); only facebook.com URLs embed; the demo seed is present; empty list is safe.

### U4. Resilient service layer — `PastVideoService` (cache + fallback + alert)

- **Goal:** One entry point the controller calls: cached (success + negative), stampede-safe, with graceful degradation, a durable operator log, and a de-duped alert.
- **Requirements:** R7, R8; integrates R5, R9.
- **Dependencies:** U2, U3.
- **Files:** `src/services/pastVideos/PastVideoService.js` (or extend `index.js`); a small `setIfAbsent`/lock helper may be added to `src/services/CacheService.js` (or use the redis client's `SET … NX EX` directly — `CacheService.set` today is plain `EX`). Test: `__tests__/services/pastVideos/PastVideoService.test.js`.
- **Approach:** `getVideos()` returns `{ videos, degraded }`.
  1. **Read cache first** (`pastVideos:list`, then the negative-cache `pastVideos:fallback`); on hit return it, no source call (AE1, R7).
  2. **On miss, acquire a single-flight lock** (`SET pastVideos:refreshing NX EX <few s>`); if the lock is already held, serve the last cached value (stale-while-revalidate) rather than calling Graph — prevents a stampede when the 6h TTL expires (A1, KTD4). The lock holder calls the selected source's `listVideos()`.
  3. **On success:** cache `{ videos, degraded:false }` for `PAST_VIDEO_CACHE_TTL_SECONDS` (default 21600 = 6h) and return.
  4. **On `err.tokenInvalid`/source error when the active source is `graph`:** `logger.warn` the failure (durable signal, fires every failing fetch — independent of email; KTD7/A3/A4). Fall back to `CuratedSource.listVideos()`; return `{ videos: <curated>, degraded:true }` if it has entries, else `{ videos: [], degraded:true }`. **Cache the degraded result under `pastVideos:fallback` for `PAST_VIDEO_FALLBACK_TTL_SECONDS` (default ~900 = 15 min)** so an outage does not re-hit Graph every request (R7) yet recovers within minutes once the token is fixed. Then **alert the operator, de-duped atomically**: `SET pastVideos:alerted NX EX 3600` — send the email only when the key was absent (so a broken token emails at most once/hour); set the TTL once (do not refresh on subsequent failures); if Redis is down (`SET` returns null), allow the alert + rely on the `logger.warn`. The alert body is a **fixed template** — error type (`token invalid (190)` / `fetch failure`) + timestamp + remediation — and never includes `err.message`, the fetch URL, or anything token-derived (S2).
  - Never throw to the controller — the page must not 500 (R8).
- **Patterns to follow:** `StreamingService` cache usage (`CacheService.get/set` + TTL constants, `homeController`'s `.catch(() => default)` resilience); `emailService.sendEmail`; the donation-controller alert precedent (`ADMIN_EMAIL || CONTACT_EMAIL` recipient chain); `src/utils/logger.js` (no `console.log`).
- **Test scenarios:** Covers R7, R8. (a) AE1: fresh cache → cached list returned, source NOT called. (b) Cache miss → source called, success cached with the 6h TTL. (c) AE2: `graph` throws `tokenInvalid`, curated empty → `{ videos: [], degraded:true }`, no throw, `logger.warn` fired, alert sent once (a second failure while `pastVideos:alerted` exists does NOT re-send). (d) Graph throws but curated has entries → returns curated `degraded:true`, and the result is cached under `pastVideos:fallback` so a second request does NOT call `listVideos()` (R7 during outage). (e) Concurrent misses → only the lock holder calls the source; others serve stale (no stampede). (f) Cache backend down → still returns videos by fetching, alert still allowed, never throws.
- **Verification:** the page is fed from cache (success and during outage), no stampede on expiry, degrades without 500s, a durable warn is logged, and the operator is alerted at most once/hour with no token in the body.

### U5. Public "Past Services" page — route, controller, view, nav

- **Goal:** The visitor-facing page: newest-first cards → lightbox playback, distinct degraded/empty states, accessible + responsive, nav entry.
- **Requirements:** R1, R2, R3, R8, R9, R10.
- **Dependencies:** U4.
- **Files:** `src/routes/watch.js` (public, NO `requireAuth`), `src/controllers/watchController.js`, `src/views/watch/index.ejs`, `public/css/watch.css`, `public/js/watch.js` (lightbox player — external, CSP-safe), `public/images/video-placeholder.svg` (thumbnail fallback), `src/views/layout.ejs` (nav link), `src/server.js` (mount `/watch`). Test: `__tests__/routes/watch.test.js`.
- **Approach:**
  - **Mount:** `app.use('/watch', watchRoutes)` near the other prefixed public routers in `src/server.js` (e.g. by `/calendar`, ~line 196). `/watch` is a distinct prefix, so ordering relative to `pagesRoutes` does not matter — `pagesRoutes` is not a wildcard catch-all (it registers literal paths), and the other prefixed routers (`/archive`, `/directory`) already mount after it.
  - **Controller:** calls `PastVideoService.getVideos()` and `res.render('layout', { title: 'Past Services', bodyView: 'watch/index', stylesheets: ['/css/watch.css'], viewData: { videos, degraded } })`. Pass `stylesheets` (layout iterates that array — see `homeController`/`pages.js`); do **not** add a `<link>` in the view, and do **not** pass `activePath` (nav highlighting comes from the global `currentPath` middleware). Wrap in `.catch` resilience like `homeController`.
  - **Lightbox playback (KTD6):** cards are `<button>` triggers carrying `data-embed-url`; `public/js/watch.js` swaps a single shared player region's iframe `src` on click. No per-card iframes (avoids ~50 simultaneous FB embeds). Accessibility: each trigger is `<button aria-label="Play <title>, <date>">`; the active card gets `aria-current="true"`; on activation focus moves to the player region (`role="region"`, `aria-label="Video player"`, `tabindex="-1"`); Enter/Space work natively on `<button>`.
  - **Escaping (S5):** render all source-supplied fields (`title`, `description`) with EJS `<%= %>` (escaped), never `<%- %>`; `embedUrl`/`thumbnailUrl` go into attributes only.
  - **Thumbnails (D4/D6):** when `thumbnailUrl` is present use it, else `/images/video-placeholder.svg`; thumbnail `<img alt="">` (decorative — the button's `aria-label` carries the name).
  - **States (KTD7/D3):** `degraded:true` + videos present → render the grid plus a small notice ("Showing saved past services"); `videos: []` (with or without degraded) → empty state: friendly message + "Watch on our Facebook page" link (`https://www.facebook.com/share/18jfSPTgMw/`); never a 500.
  - **Responsive grid (D5):** `watch.css` — 1 column < 600px, 2 columns 600–1024px, 3 columns > 1024px; player region full-width on mobile.
  - **Nav:** add `<li><a href="/watch" <%= activePath === '/watch' ? 'aria-current="page"' : '' %>>Watch</a></li>` to `layout.ejs` (public, near Calendar/About, outside the `if (user)` block; distinct from members-only Archive) using the existing `activePath` (derived from `currentPath`) pattern.
- **Patterns to follow:** `src/routes/contact.js` / `src/routes/calendar.js` (public router, no auth); `homeController` render (`stylesheets` array) + `.catch` resilience; `recordings/index.ejs` card markup (structure only); the `layout.ejs` nav `currentPath`/`activePath` convention.
- **Test scenarios:** Covers R1, R2, R3, R9, R10. (a) `GET /watch` returns 200 for an **unauthenticated** request (no login redirect — proves public, unlike `/archive`). (b) With videos, the response contains a `<button>` per video carrying a `plugins/video.php` embed URL and a single player region. (c) `videos: []` → empty state with the Facebook-page link, still 200 (AE2/AE4). (d) `degraded:true` + videos present → the "saved past services" notice renders alongside the grid (KTD7). (e) The nav contains a `/watch` link. (f) A video `title`/`description` containing `<script>` is HTML-escaped in the output (S5). (g) CSP guard (`__tests__/security/cspViewCompliance.test.js`) stays green — no inline style/script.
- **Verification:** an anonymous visitor loads `/watch`, plays videos via the lightbox keyboard-accessibly, sees a distinct degraded notice vs. empty state, on a responsive grid; nav links to it; CSP guard green.

---

## Scope Boundaries

**Deferred for later:**
- Filtering to service-only videos (vs all page videos) — R6 shows all by default.
- An admin CRUD UI for the curated list (MVP edits the committed `curatedVideos.js` via PR).
- Unifying with or migrating the members-only manual archive (`/archive` stays separate).
- Per-video search/filter/pagination beyond a simple newest-first cap.
- A scheduled background refresh worker (the cache refreshes lazily on the first request after expiry; a Bull worker is a later optimization).

**Outside this product's identity (non-goals):**
- Facebook comments, reactions, likes; live streaming (existing feature); non-Facebook sources.

---

## Open Questions (deferred to implementation)

- **`video_status` for completed live VODs:** does `GET /{page-id}/videos` return `status.video_status === 'ready'` for finished live broadcasts (vs. a different field/value), with only `pages_read_engagement`? If `status` is absent or needs an extra permission, KTD5's public-only filter (R9) has no data — verify at the probe and adjust the `fields=` list.
- **Operator-alert recipient:** the plan uses the donation precedent's `ADMIN_EMAIL || CONTACT_EMAIL` chain — confirm `ADMIN_EMAIL` is set for ops, since `CONTACT_EMAIL` is the public contact-form address.
- **Board demo expectation:** does the Board expect the page populated with multiple full services, or is the 2–4-entry curated seed (U3) enough to convey the capability? Determines how much seed content U3 needs.
- **Route name:** plan assumes `/watch`; `/past-services` is a trivially swappable alternative — confirm at U5.
- **Pagination depth:** MVP fetches one `limit=50` page (no `paging.next`); revisit if the page ever has more history worth surfacing (add cursor-follow + a "more on Facebook" disclosure).

**Load-bearing assumption to verify (not optional):** "own-page reads need no full App Review" — confirm at the U2 probe. If wrong, the Graph source never works and the feature ships as a curated-only archive (R4 unmet), making the deferred admin-CRUD editor a likely fast-follow. The curated fallback keeps the *page* (and the demo) non-blocking regardless.

---

## Risks & Dependencies

- **External prerequisite (lighter than first assumed): Page Access Token.** Auto-pull needs a Facebook Developer App (Live mode) + a long-lived **Page** Access Token with `pages_read_engagement` + `pages_show_list`, obtained by a page admin. **Correction to the origin doc:** own-page reads do **not** require the full App Review feature queue (only *arbitrary*-page reads via Page Public Content Access do), so the lead time is hours-to-days (business verification), not weeks. This is a load-bearing assumption — verify at the U2 probe (see Open Questions). Mitigation: the curated source (U3) ships and demos now; the API is a `PAST_VIDEO_SOURCE=graph` flip when the token lands.
- **`FACEBOOK_PAGE_ID` must be the numeric Page ID.** A vanity name or share-slug yields a non-embeddable canonical URL → every card renders blank while the route still returns 200 with cards (so tests pass). Mitigation: KTD2 pins the numeric-id requirement; the U2 probe verifies a constructed `{page-id}/videos/{id}/` href actually renders in `plugins/video.php` before wiring the mapping (not just that `GET` works).
- **Token revocation is silent.** A page admin changing their password (or losing the role) invalidates the token; Graph returns `error.code === 190`. Mitigation: U2 detects it, U4 falls back to curated, `logger.warn`s every failing fetch (durable signal), and alerts the operator (atomic once/hour). **Detection latency:** with the 6h success cache, a revocation is only noticed on the first cache-miss after expiry — up to ~6h. A periodic health-check route/worker is deferred hardening that would close this gap.
- **Token must never leak.** Sent via the `Authorization` header (not the query string), so logged URLs are safe; the operator-alert body uses a fixed template with no token-derived content (KTD3/S2). Note for ops: if Winston logs are shipped to a central aggregator, the header approach keeps the token out of them.
- **Operator alert is best-effort.** `emailService` falls back to console mock when `SMTP_HOST` is unset and swallows send errors — so in any env without SMTP the email silently no-ops. Mitigation: U4's `logger.warn` is the durable, SMTP-independent signal; the deferred health-check is the real assurance.
- **Cache backend (Redis) outage.** `CacheService.get` returns null on Redis failure (treated as a miss), so a Redis outage would make every visitor request fetch Graph synchronously. Mitigation: the single-flight lock (KTD4) still funnels concurrent misses; acceptable for MVP since Redis-down is already a degraded mode, but worth noting.
- **Private/unlisted videos render blank.** Mitigation: KTD5 filters to `status.video_status === 'ready'`; R9 surfaces only public videos.
- **Graph field availability uncertain.** `picture`/`status` may be absent or need extra scope; if `status` is unavailable the R9 public-only filter is silently inert. Mitigation: the U2 probe confirms the `fields=` set against the real page+token before the field-mapping tests are written (see Open Questions).
- **Graph API version sunset (~2-year cycle).** Mitigation: pin `FACEBOOK_GRAPH_API_VERSION` (KTD4); calendar reminder to bump before deprecation.
- **Silent truncation at ~50 videos.** The MVP single-page fetch omits older videos with no user-visible disclosure. Acceptable for MVP; revisit with cursor pagination + a "more on Facebook" link if the catalog grows.
- **New env surface.** `FACEBOOK_PAGE_ID` (numeric), `FACEBOOK_PAGE_ACCESS_TOKEN` (secret), `FACEBOOK_GRAPH_API_VERSION`, `PAST_VIDEO_SOURCE`, `PAST_VIDEO_CACHE_TTL_SECONDS`, `PAST_VIDEO_FALLBACK_TTL_SECONDS` — document all in `.env.example` (U2). The token is a secret: env only, never committed, never logged.
- **Reuses (verified this session):** `StreamingService.convertToEmbedUrl` (embed — **to be exported**, U2/KTD2) and `isAllowedProviderUrl` (curated URL gate, U3/S3); `CacheService` (cache, `cache:` prefix; a `SET NX` lock helper may be added, U4); `emailService.sendEmail` with the `ADMIN_EMAIL || CONTACT_EMAIL` recipient chain (operator alert); CSP `frameSrc https://www.facebook.com` (no change); the `layout`+`bodyView`+`stylesheets` render convention and the global `currentPath` nav middleware; the public-router mount pattern in `src/server.js`. No `connect-src` change (server-side fetch).

---

## Sources & Research

- Origin requirements: `docs/brainstorms/2026-06-14-facebook-video-archive-requirements.md`.
- Facebook Graph API research (this session, ce-web-researcher): `GET /{page-id}/videos` readable with a Page token; fields `id, description, created_time, picture, status` (no `permalink_url`/`length`/`embeddable` — build embed from `id`); long-lived non-expiring Page Access Token (revoked on admin password change → error 190); **own-page reads need `pages_read_engagement` + `pages_show_list` + Live-mode business verification, NOT full App Review** (App Review / Page Public Content Access gates *arbitrary* pages); BUC rate limits generous → cache hours; pin the API version (`embed_html` deprecated; ~2-yr version sunset).
- Repo grounding (verified this session): provider seam `src/services/payments/{index,PaymentProvider}.js`; `src/services/StreamingService.js` (`convertToEmbedUrl`, `CacheService` usage, fallback URL); `src/services/CacheService.js` (`cache:` prefix, `get/set/del` + TTL); route mounting `src/server.js:175-209` (public routers before `pagesRoutes`); members-only archive `src/routes/recordings.js` (`requireAuth`) + `recordingController`; nav `src/views/layout.ejs:28-53`; `emailService.sendEmail` + `CONTACT_EMAIL`; render convention `res.render('layout', { title, bodyView, viewData })`.
- Real Facebook page: `https://www.facebook.com/share/18jfSPTgMw/`.
</content>
</invoke>
