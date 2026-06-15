---
date: 2026-06-14
topic: facebook-video-archive
---

# Public "Past Services" — Facebook video archive

## Summary

A new **public "Past Services" page** that automatically lists Temple B'nai Israel's previous Facebook videos and plays each **inline on the site** (no login, no leaving for Facebook). Videos are auto-pulled from the temple's Facebook Page via the Graph API, behind a **swappable source** so a curated/manual list works in the interim and as a fallback. The existing members-only manual recordings archive is left untouched.

## Problem Frame

The temple already streams services to its Facebook page, so a back-catalog of past services exists there — but the only way to watch them is to leave the website and go to Facebook. The site's members-only recordings archive (`/archive`) could hold them, but it is manual-publish and currently unused, so in practice the website surfaces no past services at all. Newcomers and members who come to the site to "watch a recent service" hit a dead end. Pulling the page's videos onto a public on-site page closes that gap and reuses content that is already public on Facebook.

---

## Actors

- A1. **Visitor** (public, unauthenticated) — browses and watches past services on the site.
- A2. **Admin / Operator** — configures the video source (Facebook token or curated list); is alerted when the token fails.
- A3. **Facebook Graph API** (external system) — the source of the page's video list.

---

## Requirements

**Display surface**
- R1. A public "Past Services" page (no login) lists the temple's past Facebook videos and plays each inline on the site.
- R2. Videos render newest-first as cards (thumbnail, title, date); selecting one plays it via an on-site embed without leaving the site.
- R3. This is a new, separate surface; the existing members-only manual recordings archive is unchanged.

**Video source**
- R4. Past videos are auto-pulled from the temple's Facebook Page via the Facebook Graph API.
- R5. The video source is swappable: a curated/manual list of Facebook video URLs serves as both an interim source (before API credentials land) and a fallback, interchangeable with the API source via configuration.
- R6. By default the page shows all of the page's public videos (service-only filtering is deferred — see Outstanding Questions).

**Freshness & resilience**
- R7. The video list is cached server-side for several hours and refreshed on expiry — never fetched per page request.
- R8. When the API is unavailable or the token is missing/expired, the page degrades gracefully: show the curated list if configured, otherwise an empty state linking to the temple's Facebook page — never an error page — and the operator is alerted on token failure.

**Access & privacy**
- R9. Only public Facebook videos are surfaced; nothing is exposed that isn't already public on the page.

---

## Key Flows

- F1. **View past services (happy path).** **Trigger:** Visitor opens the Past Services page. **Steps:** page renders newest-first video cards from cache → visitor selects one → it plays inline via the on-site embed. **Covers R1, R2.**
- F2. **List refresh.** **Trigger:** the cached list has expired. **Steps:** the next request triggers a server-side Graph API fetch → the list is updated and re-cached for several hours. **Covers R4, R7.**
- F3. **Degraded / fallback.** **Trigger:** Graph API error or missing/expired token. **Steps:** the page shows the curated list if configured, else an empty state with a "Watch on our Facebook page" link; the operator is alerted. **Covers R5, R8.**

---

## Acceptance Examples

- AE1. **Covers R7, F2.** Given the cached list is fresh, when a visitor loads the page, no Facebook API call is made and the list renders from cache.
- AE2. **Covers R8, F3.** Given the Page Access Token is missing or expired, when a visitor loads the page, they see the curated fallback (if configured) or an empty state with a Facebook-page link — never an error page — and the operator is alerted.
- AE3. **Covers R5.** Given the API source is not yet configured (pre-review) but the curated source has entries, when a visitor loads the page, those videos display identically to the API-sourced experience.
- AE4. **Covers R9.** Given a Facebook video is public, it embeds in the on-site player; a private or unlisted video is not shown.

---

## Key Decisions

- **Public, separate page.** A new public "Past Services" surface; the members-only manual archive stays untouched (no migration). Chosen over unifying or replacing it.
- **Swappable video source with curated fallback.** The Graph API needs a Facebook App + long-lived Page token + App Review (owner action, days–weeks lead time) that gates go-live, so the source is abstracted: curated data works now (incl. the Board demo), and the API flips in via config when credentials land. Mirrors the project's existing swappable-provider pattern (`src/services/payments`).
- **Reuse the existing CSP-safe embed.** Each video embeds via the same `plugins/video.php` iframe the live stream uses (`src/services/StreamingService.js` `convertToEmbedUrl`) — no Facebook JS SDK (blocked by CSP), no new frame domains (`frameSrc` already allows `www.facebook.com`).
- **Show all page videos by default, newest-first.** Simplest, and matches how the temple uses its page (mostly services); service-only filtering deferred.
- **Server-side fetch + multi-hour cache.** Graph calls run server-side (no CSP `connect-src` change), cached for hours to respect rate limits and keep the page fast.

---

## Scope Boundaries

**Deferred for later:**
- Filtering to service-only videos (vs all page videos).
- Unifying with or migrating the existing members-only manual archive.
- Richer per-video features for Facebook videos (captions, archived live-chat, Torah-portion metadata) — those remain with the manual archive.

**Outside this product's identity (non-goals):**
- Facebook comments, reactions, or likes.
- Live streaming (handled by the existing live feature; this is past videos only).
- Pulling from platforms other than Facebook.

---

## Dependencies / Assumptions

- **Hard prerequisite (owner action, lead time):** a Facebook Developer App + long-lived Page Access Token + Facebook App Review for `pages_read_engagement` / Page Public Content Access. Auto-pull cannot show live data until this lands; the curated fallback covers the gap, including the end-of-July Board demo.
- Reuses the live-embed mechanism (`src/services/StreamingService.js`) and the existing CSP (`src/server.js` `frameSrc` allows `www.facebook.com`). Server-side Graph fetches need no `connect-src` change (verified this session).
- The temple's real Facebook page is `https://www.facebook.com/share/18jfSPTgMw/`.
- Assumes the page's service videos are posted publicly.

---

## Outstanding Questions

**Resolve before planning:** none — scope is confirmed.

**Deferred to planning:**
- Exact Graph API endpoint/fields and pagination / how-far-back behavior.
- Token storage (env vs encrypted DB) and refresh/expiry handling specifics.
- Cache duration value and invalidation trigger.
- The curated-source data shape (where/how admins enter video URLs).
- The operator-alert mechanism for token failure (likely reuse the existing email/admin-alert path).

---

## Sources / Research

- This session's brainstorm dialogue (audience = public; surface = new separate page; source = Graph API with curated fallback).
- Live-embed mechanism: `src/services/StreamingService.js` (`convertToEmbedUrl` → `plugins/video.php`), `src/views/home.ejs`.
- CSP: `src/server.js` (`frameSrc` allows `https://www.facebook.com`; `scriptSrc` excludes the FB JS SDK).
- Existing members-only manual archive: `src/routes/recordings.js`, `src/controllers/recordingController.js`, `src/services/RecordingService.js`, `src/views/recordings/index.ejs` + `show.ejs`.
- Swappable-provider precedent: `src/services/payments`.
- Facebook Graph API access requirements: Developer App + long-lived Page Access Token + App Review (`pages_read_engagement` / Page Public Content Access).
