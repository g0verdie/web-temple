# Facebook Integration Test Plan (test accounts, APIs, and verification)

**Status:** test plan / runbook — **execute in a later session.** Covers both Facebook surfaces (Live embed + Graph "Past Services" archive). One small code change ships with this plan (a numeric-Page-ID guard); everything else here is account setup, automated-test additions, and a manual checklist.

## TL;DR

"Facebook integration" in this app is **two surfaces** plus passive Open Graph tags:

1. **Facebook Live embed** (homepage + `/watch`) — builds a CSP-safe `plugins/video.php` iframe from an admin-pasted watch URL. **Makes no Facebook API call** — "live" is admin-asserted and time-bounded (8h window).
2. **Past Services archive** (`/watch`) — a swappable source: a committed *curated* list (default) or the **Facebook Graph API** (`GET /{page-id}/videos`). The Graph adapter is fully coded and unit-tested **against a mocked `fetch`**, but has **never run against the real Facebook API**.

The existing jest suite covers the mocked Graph adapter, the fallback/degradation logic, and the env-driven live embed. It **cannot** catch a bad real-world credential or a non-numeric Page ID — CI has no secrets and `NODE_ENV=test` mocks `fetch`, disables CSRF/Redis/workers. So this plan does what CI can't:

- **Part A** — stand up a **dedicated test Facebook Page + Developer App + long-lived Page Access Token** (isolated from the production temple page).
- **Part B** — add the automated tests that close the gaps: an **opt-in live contract test** (skipped in CI) and a **numeric-Page-ID guard**.
- **Part C** — a `- [ ]` **manual validation checklist** for both surfaces against a real local stack.
- **Part D** — a **production acceptance** pass against the real temple Page before go-live.

**Decision (confirmed):** validate against a **dedicated test Page + Dev App**, not the production temple page — see "Why a dedicated test page" below.

## Why a dedicated test page, not the production page

| | Dedicated test Page + App (chosen) | Production temple Page |
|---|---|---|
| Isolation | Upload/delete sample videos, go Live, rotate tokens freely — no public visibility | Every test action is on the live org page |
| Token blast radius | A leaked/expired test token affects nothing real | A token for the real page reads real content |
| Reproducibility | Seed exactly the videos the checklist expects | Whatever the org happens to have posted |
| Cost / effort | A few minutes to create a Page + App | None to create, but riskier to test on |

We use the test page for Parts A–C, then do a **final acceptance pass (Part D) against the production page** with its real numeric Page ID and a page-admin token, so go-live config is proven before launch.

## What the app already assumes (mostly no code change)

- **Source selection** is env-driven: `src/services/pastVideos/index.js` picks `curated` (default) or `graph` from `PAST_VIDEO_SOURCE`. The Graph path activates only when `PAST_VIDEO_SOURCE=graph` **and** `FACEBOOK_PAGE_ID` + `FACEBOOK_PAGE_ACCESS_TOKEN` are set.
- **The Graph call** (`src/services/pastVideos/GraphApiSource.js`): `GET https://graph.facebook.com/<version>/<page-id>/videos?fields=id,description,created_time,picture,status&limit=50`, token in the **`Authorization: Bearer` header** (never the query string), 5s timeout, API version pinned (`FACEBOOK_GRAPH_API_VERSION`, default `v21.0`).
- **Graceful degradation** (`src/services/pastVideos/PastVideoService.js`): success cache 6h, outage cache 15m, single-flight refresh lock, curated fallback on failure, and a **once-per-hour operator alert email** when the token is invalid (Graph error code 190). This source never throws to the page — it serves last-good/curated and renders an empty state at worst.
- **The live embed** (`src/services/StreamingService.js`): resolution order is 30s cache → `STREAM_PROVIDER_UNAVAILABLE` error state → DB active stream (within `STREAM_MAX_LIVE_HOURS`) → DB upcoming → env-var fallback → offline. The embed URL is gated to HTTPS `facebook.com`/`fb.watch` by `isAllowedProviderUrl()` and wrapped by `convertToEmbedUrl()` into `https://www.facebook.com/plugins/video.php?href=<encoded>&show_text=false`.
- **CSP** (`src/server.js`): `frameSrc` allows `https://www.facebook.com`; `scriptSrc` **excludes** the Facebook JS SDK (embeds are iframe-only); no inline script/style.

The one code change this plan adds is **B2** below (a startup warning when `FACEBOOK_PAGE_ID` is non-numeric). Everything else is configuration + verification.

---

## Part A — Set up the dedicated test infrastructure

> Goal: a Facebook Page you control, a numeric Page ID, and a long-lived Page Access Token — enough for the Graph path (C1–C2) and a real Live broadcast (C4).

### Step A1 — Create the test Facebook Page (+ sample videos)

1. Create a new Facebook **Page** from a personal account you control (Pages → Create → name it e.g. "web-temple QA"). You become its admin.
2. Upload **2–3 short videos** to the Page (Page → Videos → Upload). Wait until each shows as published/processed — the Graph `status.video_status` must be **`ready`** or the card is dropped by `_normalize`.
3. *(Optional, for C4 only)* note you can later run a short **Live** broadcast on this Page; a finished Live video also appears in `/videos`.

### Step A2 — Get the **numeric** Page ID

Get the Page ID one of these ways:

- Graph API Explorer (Step A4 tooling): `GET /me?fields=id` while acting **as the Page**, or `GET /{page-username}?fields=id`.
- Page → **About** → **Page transparency** (shows the numeric Page ID).
- Meta Business Suite → Settings → Page details.

- [ ] **⚠️ The Page ID MUST be numeric** (e.g. `123456789012345`). The `facebook.com/share/XXXX` short link and the vanity slug are **NOT** the Page ID. A non-numeric value yields non-embeddable URLs → **every card renders blank while all mocked tests still pass green** (silent failure — see `.env.example` L46–47 and `docs/plans/2026-06-14-007-feat-facebook-video-archive-plan.md` KTD2). Guard B2 now logs a warning when this happens.

### Step A3 — Create the Facebook Developer App

1. At <https://developers.facebook.com> → **My Apps → Create App** → app type **Business**.
2. Keep the app in **Development mode** (top toggle). In dev mode, users with an **Admin / Developer / Tester** role on the app can read a Page they administer **without App Review**.
3. Add the **Graph API Explorer** tool (or the "Pages API" product) so you can mint tokens in Step A4.

> **App Review / Business Verification is NOT needed for this test.** Reading a page *you administer* in dev mode only needs the `pages_read_engagement` + `pages_show_list` scopes. App Review / Business Verification is required only to read pages you do **not** admin, or to operate the app in **Live mode** publicly (relevant to Part D, not here).

### Step A4 — Generate a long-lived Page Access Token

1. Open **Graph API Explorer**, select your app, and request a **User token** with scopes `pages_show_list` and `pages_read_engagement`.
2. `GET /me/accounts` → copy the **Page Access Token** for the test Page (and confirm the numeric `id` matches Step A2).
3. **Exchange for a long-lived token** so it doesn't expire mid-test:
   `GET /oauth/access_token?grant_type=fb_exchange_token&client_id=<app-id>&client_secret=<app-secret>&fb_exchange_token=<short-lived-user-token>` → then `GET /me/accounts` again with the long-lived user token to get a **long-lived Page token** (effectively non-expiring while the underlying user token is valid).
4. Treat this token as a **secret** — it goes in env only, never committed. The code sends it in the `Authorization` header and scrubs it from logs.

### Step A5 — (Live, for C4) prepare a broadcast

1. On the test Page, start a **Live video** via Facebook **Live Producer** or an encoder (OBS) streaming to the Page's RTMP URL + stream key.
2. Copy the live video's **watch URL** (e.g. `https://www.facebook.com/<page>/videos/<id>` or the share URL) — you'll paste it into the admin scheduler in C4.
3. The **env-fallback** live test (C3) needs **no** broadcast — it just sets `FACEBOOK_LIVE_*` env vars.

### Env-var reference (the full Facebook config surface)

Set these in `.env` for the validation run (documented in `.env.example` L38–58 and L148–165):

| Var | Test value | Purpose |
|---|---|---|
| `PAST_VIDEO_SOURCE` | `graph` | Switches `/watch` from the curated list to the Graph API. |
| `FACEBOOK_PAGE_ID` | *(numeric Page ID from A2)* | The page whose videos `/watch` lists. **Must be numeric.** |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | *(long-lived token from A4)* | Secret; sent as `Authorization: Bearer`. |
| `FACEBOOK_GRAPH_API_VERSION` | `v21.0` | Pins the Graph API version (default). |
| `PAST_VIDEO_CACHE_TTL_SECONDS` | `21600` | Success-list cache (6h). Lower it (e.g. `30`) to iterate faster. |
| `PAST_VIDEO_FALLBACK_TTL_SECONDS` | `900` | Outage/negative cache (15m). |
| `FACEBOOK_LIVE_IS_ACTIVE` | `true` (C3 only) | Forces the live state when `EMBED_URL` is set (env-fallback path). |
| `FACEBOOK_LIVE_EMBED_URL` | *(a Facebook video URL)* | The iframe source for the env-fallback live path. |
| `FACEBOOK_LIVE_WATCH_URL` | *(watch URL)* | The "Watch on Facebook" click-through. |
| `FACEBOOK_LIVE_TITLE` | `Friday Evening Shabbat Service` | Labels the player. |
| `FACEBOOK_LIVE_SCHEDULED_START` | *(ISO 8601, future)* | Drives the "upcoming" state. |
| `STREAM_PROVIDER_UNAVAILABLE` | `false` | `true` short-circuits to the degraded/error UI (C6). |
| `STREAM_MAX_LIVE_HOURS` | `8` | Live-window auto-expiry. Set `0` to exercise C5. |

---

## Part B — Automated tests to add

The mocked suite is solid; the gaps are **real-credential validation** and the **silent non-numeric-Page-ID failure**. Two additions close them.

### B1 — Opt-in live Graph contract test

**File:** `__tests__/contract/facebookGraphApi.contract.test.js`

- Gated behind `process.env.FB_LIVE_CONTRACT === '1'` (uses `describe.skip` otherwise), so it **never runs in CI** and a normal `npm test` skips it.
- When enabled with real creds in env, it calls the **real** `GraphApiSource.listVideos()` against live Facebook and asserts: a non-empty array; every item has a string numeric `id` and an `embedUrl` that is a `plugins/video.php` URL. A second case temporarily swaps in a bogus token and asserts the adapter **rejects with `tokenInvalid: true`** (proves it fails loudly, not silently empty).
- This is the only automated layer that catches schema drift in the Graph response, a wrong scope/token, or the vanity-slug Page ID.

Run it (only when you have creds):

```bash
FB_LIVE_CONTRACT=1 \
FACEBOOK_PAGE_ID=<numeric> \
FACEBOOK_PAGE_ACCESS_TOKEN=<token> \
npx jest facebookGraphApi.contract
```

### B2 — Numeric-Page-ID guard (the one code change)

**File:** `src/services/pastVideos/GraphApiSource.js`

- In `listVideos()`, after the missing-credentials check, if `FACEBOOK_PAGE_ID` is set but fails `/^\d+$/`, emit `logger.warn(...)` naming the silent-failure risk (uses `src/utils/logger.js` — no `console`). It **warns, does not throw** — behavior is unchanged; the misconfiguration just becomes visible in logs instead of as mysteriously blank cards.

**Test:** `__tests__/services/pastVideos/GraphApiSource.test.js` — two added cases assert the warning fires for a vanity slug and does **not** fire for a numeric id (spying on `logger.warn`, following the file's existing `global.fetch`/`process.env`-snapshot pattern).

### B3 — Coverage-gap audit (already covered — no new mocked tests)

These already exist and need no duplication:

| Behavior | Existing test |
|---|---|
| Mocked Graph adapter (shape, ordering, header, version, error 190, network failure, non-numeric video id) | `__tests__/services/pastVideos/GraphApiSource.test.js` |
| Degradation: token-190 alert, alert dedupe, curated fallback, cache hit/miss, lock-held last-good, both-sources-fail | `__tests__/services/pastVideos/PastVideoService.test.js` |
| Source selector by `PAST_VIDEO_SOURCE` | `__tests__/services/pastVideos/index.test.js` |
| Env-driven live embed states + live window | `__tests__/services/StreamingService*.test.js` |
| `GET /api/stream/status` route | `__tests__/routes/api.stream.test.js` |
| `/archive` → `/watch` redirect | `__tests__/routes/archiveRedirect.test.js` |
| `/watch` accessibility + structured data | `__tests__/views/watch.accessibility.test.js`, `structuredData.test.js` |

No speculative tests are added beyond B1–B2.

### How to run

```bash
npx jest __tests__/services/pastVideos      # adapter + service + selector
npx jest -t "not numeric"                    # the new guard cases
npm test                                     # full suite, coverage >=60% (contract skipped)
```

---

## Part C — Manual validation checklist

> Execute against a **real local stack** (dev mode — the `NODE_ENV=test` escape hatches are OFF, so CSRF, real Redis, and the email worker are all live). The mocked jest suite structurally cannot cover any of this.

**Bring up the stack** (after setting the Part A env vars in `.env`):

```bash
docker compose up -d && npm run migrate && npm run seed
PAST_VIDEO_SOURCE=graph npm run dev      # FACEBOOK_PAGE_ID / _ACCESS_TOKEN from .env
```

Open the browser dev-tools **Network** tab for the URL/header assertions.

### C1 — Graph past-videos happy path
- [ ] Load `/watch` → past-video **cards render newest-first** with real Facebook thumbnails (not the curated placeholders).
- [ ] Click a card → the inline iframe **swaps** to that video (`public/js/watch.js`).
- [ ] In Network, the outbound call is `graph.facebook.com/v21.0/<numeric-id>/videos?fields=...&limit=50`.
- [ ] **Security:** the token appears in the **`Authorization` request header only — never in the URL** and never in `logs/application-*.log`.
- [ ] Each card's iframe `src` is `https://www.facebook.com/plugins/video.php?href=...&show_text=false`.

### C2 — Graph degradation + operator alert
- [ ] Set an **invalid** `FACEBOOK_PAGE_ACCESS_TOKEN`, restart → `/watch` **falls back to the curated list** (page still renders; no error to the visitor).
- [ ] **One** operator alert email fires (Graph error 190) to `ADMIN_EMAIL`/`RABBI_EMAIL`/`CONTACT_EMAIL`; **⚠️ the token does NOT appear in the email body** (`PastVideoService.test.js` asserts this — confirm live too).
- [ ] A second failure within the hour does **not** re-alert (dedupe).
- [ ] Restore the valid token → after the cache TTL (or a restart) cards return.

### C3 — Live embed via env fallback (no broadcast)
- [ ] Set `FACEBOOK_LIVE_IS_ACTIVE=true` + `FACEBOOK_LIVE_EMBED_URL=<a Facebook video URL>` + `FACEBOOK_LIVE_TITLE=...`, restart → the **homepage shows the live player** with the title.
- [ ] `GET /api/stream/status` returns JSON with `isLive: true` and the embed URL.
- [ ] `public/js/stream-status.js` polls `/api/stream/status` every ~30s and **re-validates the URL host** client-side (a non-`facebook.com` URL is rejected in the browser).
- [ ] Set `STREAM_PROVIDER_UNAVAILABLE=true`, restart → homepage shows the **degraded/error CTA** linking to the temple Facebook page.

### C4 — Live embed via admin scheduling + real broadcast
- [ ] Sign in as an admin with `MANAGE_STREAMING`. Go to `/admin/streaming/new` → enter a title, a **future** `scheduled_start`, and the **test page's live watch URL** (from A5) → save.
- [ ] **Negative checks:** a **past** `scheduled_start` is rejected; a **non-Facebook URL** is rejected (mirrors `docs/qa/2026-06-21-admin-qa-checklist.md` §8).
- [ ] Start the test-page Live broadcast (A5), then click **Start** (`POST /admin/streaming/:id/start`) → within ~30s the **embed appears on `/` and `/watch`** without a reload.
- [ ] Click **Stop** → the player disappears and the page reverts to the offline/archive CTA.

### C5 — Live-window 8h auto-expiry
- [ ] With an active stream, set `STREAM_MAX_LIVE_HOURS=0` (or back-date `live_started_at` via SQL: `UPDATE scheduled_streams SET live_started_at = NOW() - INTERVAL '9 hours' WHERE status='active';`), reload → the stream **auto-falls-back to offline** (a forgotten "active" stream self-heals).

### C6 — CSP / security
- [ ] View source / CSP header: `frame-src` allows `https://www.facebook.com`; **no** `'unsafe-inline'` in `script-src`/`style-src`; the **Facebook JS SDK is not loaded** (iframe-only).
- [ ] No Facebook token or secret appears anywhere in page HTML, `/api/stream/status`, or the logs.

### C7 — Accessibility
- [ ] `npm run test:a11y` → green (renders `/watch` + home and runs jest-axe).
- [ ] Manual keyboard + screen-reader pass of the `/watch` player and card grid (focus order, labels, the iframe title).

---

## Part D — Production acceptance (final pass before go-live)

- [ ] Repeat **C1–C2 against the production temple Page** (`facebook.com/share/18jfSPTgMw`) using its **real numeric Page ID** and a **page-admin long-lived token**.
- [ ] If the app must serve the Graph path while in **Live mode** publicly, confirm whether **Business Verification / App Review** is required for your scope set; for a page the org admins with the app in dev mode + admin roles, it is not.
- [ ] Replace the **placeholder URLs** in `src/services/pastVideos/curatedVideos.js` with **real public video URLs** so the curated fallback (and the default `PAST_VIDEO_SOURCE=curated` demo path) shows real content.
- [ ] Decide the production `PAST_VIDEO_SOURCE` (`curated` for the Board demo vs `graph` once the token lands) and document the chosen value in the deploy env.

---

## Cross-references

- `docs/brainstorms/2026-06-14-facebook-video-archive-requirements.md` — the archive requirements (R1–R9, swappable source, fallback, alert).
- `docs/plans/2026-06-14-007-feat-facebook-video-archive-plan.md` — KTD2 (numeric Page ID), KTD3 (token in header, error 190), KTD4 (cache/single-flight).
- `_bmad-output/implementation-artifacts/3-1-facebook-live-stream-embed.md` … `3-6-*` — Epic 3 live-stream stories (all done).
- `docs/qa/2026-06-21-admin-qa-checklist.md` §8 (Streaming) — the admin scheduling/RBAC checks this plan extends; don't duplicate them.
- `.env.example` L38–58 (Graph) and L148–165 (live) — the documented env surface.

## Cleanup when done

- [ ] Remove the test env vars from `.env` (or set `PAST_VIDEO_SOURCE=curated`).
- [ ] Delete any test `scheduled_streams` rows: `DELETE FROM scheduled_streams WHERE title LIKE '%QA%';`.
- [ ] **Revoke the test Page Access Token** (Facebook → Business Settings → System users / app tokens) and, if the test Page is no longer needed, archive/delete it.
- [ ] Confirm no token landed in git (`git grep -i FACEBOOK_PAGE_ACCESS_TOKEN` should only hit `.env.example` and docs, never a real value).
