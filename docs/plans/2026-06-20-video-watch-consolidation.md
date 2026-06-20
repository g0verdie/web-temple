# Video Watch Consolidation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans (inline) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Collapse the site's video surfaces into one public Facebook-sourced "Watch" tab — retire the local DB archive (301 `/archive` → `/watch`, delete recordings code), and surface the live stream on Watch in addition to the homepage hero.

**Architecture:** `/watch` (Facebook via `PastVideoService`) becomes the single video surface. `/archive` redirects to it; the `recordings` table, `RecordingService`, `recordingController`, and admin "publish recording" UI are deleted. `watchController` additionally reads `StreamingService.getPublicEmbedMetadata()` and the Watch view renders a live embed when a stream is live. Live detection stays on `scheduled_streams` + admin "Go Live".

**Tech Stack:** Express 4, EJS SSR, Jest + supertest + jest-axe. Tests mock `src/config/db` and `src/config/redis`; CSRF disabled under `NODE_ENV=test`.

## Global Constraints
- No TypeScript, bundler, or frontend framework. No inline `<script>`/`<style>` (strict CSP). No `console.*` in `src/` (use `src/utils/logger.js`).
- Don't reorder/rename migrations `000_*`–`006_*`; keep migrations `012`–`014` (recordings table) in place even though unused.
- Do NOT touch `/admin/calendar/archive` (calendar event archive — unrelated to video).
- Gate: full suite **3×** + `npm run lint` clean.
- **Spec refinement (YAGNI):** the spec proposed extracting `buildStreamViewModel`; Watch only needs the `live` case, so no extraction — render a minimal live embed directly.

---

### Task 1: Redirect the public `/archive` routes to `/watch`

**Files:**
- Modify (rewrite): `src/routes/recordings.js`
- Create: `__tests__/routes/archiveRedirect.test.js`
- Delete: `__tests__/routes/archiveRoutes.test.js`, `__tests__/routes/recordingsDetail.test.js`, `__tests__/views/recordingsDetail.accessibility.test.js`

**Interfaces:**
- Produces: a redirect router mounted at `/archive` (unchanged mount in `server.js`). No auth.

- [ ] **Step 1: Write the failing test** — `__tests__/routes/archiveRedirect.test.js`

```js
const request = require('supertest');
const app = require('../../src/server');

describe('GET /archive (retired — redirects to /watch)', () => {
    it('301-redirects /archive to /watch', async () => {
        const res = await request(app).get('/archive');
        expect(res.status).toBe(301);
        expect(res.headers.location).toBe('/watch');
    });

    it('301-redirects a recording detail URL to /watch', async () => {
        const res = await request(app).get('/archive/some-old-id');
        expect(res.status).toBe(301);
        expect(res.headers.location).toBe('/watch');
    });
});
```

- [ ] **Step 2: Run it — expect FAIL** (old route requires auth → 302 to /login, not 301 /watch)

Run: `npx jest __tests__/routes/archiveRedirect.test.js`
Expected: FAIL (status 302 / location `/login?...`).

- [ ] **Step 3: Rewrite `src/routes/recordings.js`**

```js
const express = require('express');
const router = express.Router();

// The local recordings archive was retired in favour of the single public
// Facebook-sourced /watch surface. Permanently redirect old archive URLs
// (including member bookmarks of /archive/:id) to /watch.
router.get('/', (req, res) => res.redirect(301, '/watch'));
router.get('/:id', (req, res) => res.redirect(301, '/watch'));

module.exports = router;
```

- [ ] **Step 4: Delete the obsolete public-archive tests**

```bash
git rm __tests__/routes/archiveRoutes.test.js __tests__/routes/recordingsDetail.test.js __tests__/views/recordingsDetail.accessibility.test.js
```

- [ ] **Step 5: Run the redirect test + full suite — expect PASS**

Run: `npx jest __tests__/routes/archiveRedirect.test.js && npx jest`
Expected: redirect test PASS; full suite green (recordingController/RecordingService still exist for admin route — untouched here).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(watch): 301-redirect retired /archive routes to /watch"
```

---

### Task 2: Surface the live stream on the Watch tab

**Files:**
- Modify: `src/controllers/watchController.js`
- Modify: `src/views/watch/index.ejs`
- Test: `__tests__/routes/watchLive.test.js` (create), `__tests__/views/watch.accessibility.test.js` (create if absent; otherwise extend the existing watch a11y test)

**Interfaces:**
- Consumes: `StreamingService.getPublicEmbedMetadata()` → resolves `{ status, title, embedUrl, ... }`; live state is `status === 'live'` with a string `embedUrl`.
- Produces: `viewData.liveStream = { embedUrl, title } | null` passed to `watch/index.ejs`.

- [ ] **Step 1: Write the failing test** — `__tests__/routes/watchLive.test.js`

```js
const request = require('supertest');

jest.mock('../../src/services/StreamingService');
jest.mock('../../src/services/pastVideos/PastVideoService');

const StreamingService = require('../../src/services/StreamingService');
const PastVideoService = require('../../src/services/pastVideos/PastVideoService');
const app = require('../../src/server');

describe('GET /watch live section', () => {
    beforeEach(() => {
        PastVideoService.getVideos.mockResolvedValue({ videos: [], degraded: false });
    });

    it('renders the live embed when a stream is live', async () => {
        StreamingService.getPublicEmbedMetadata.mockResolvedValue({
            status: 'live', title: 'Shabbat Service', embedUrl: 'https://www.facebook.com/plugins/video.php?href=x'
        });
        const res = await request(app).get('/watch');
        expect(res.status).toBe(200);
        expect(res.text).toMatch(/Live Now/);
        expect(res.text).toContain('https://www.facebook.com/plugins/video.php?href=x');
    });

    it('shows no live section when offline', async () => {
        StreamingService.getPublicEmbedMetadata.mockResolvedValue({ status: 'offline', embedUrl: null });
        const res = await request(app).get('/watch');
        expect(res.status).toBe(200);
        expect(res.text).not.toMatch(/Live Now/);
    });

    it('still returns 200 (never 500) when the live lookup throws', async () => {
        StreamingService.getPublicEmbedMetadata.mockRejectedValue(new Error('boom'));
        const res = await request(app).get('/watch');
        expect(res.status).toBe(200);
    });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`liveStream` not passed; no "Live Now" markup)

Run: `npx jest __tests__/routes/watchLive.test.js`
Expected: FAIL on the first assertion (`/Live Now/` not found).

- [ ] **Step 3: Update `src/controllers/watchController.js`** — add the StreamingService import and live lookup, pass `liveStream`

Add to the top imports:
```js
const StreamingService = require('../services/StreamingService');
```
Inside `getWatchPage`, after the existing past-videos try/catch and before `res.render`, add:
```js
    // Surface the current live stream on Watch too (homepage keeps its hero).
    // Only the live case is shown here; never let the lookup 500 the page.
    let liveStream = null;
    try {
        const meta = await StreamingService.getPublicEmbedMetadata();
        if (meta && meta.status === 'live' && meta.embedUrl) {
            liveStream = { embedUrl: meta.embedUrl, title: meta.title };
        }
    } catch (error) {
        logger.warn('watchController live lookup failed', { error: error && error.message });
    }
```
Add `liveStream` to the `viewData` object:
```js
        viewData: {
            videos,
            degraded,
            facebookPageUrl: FACEBOOK_PAGE_URL,
            liveStream
        }
```

- [ ] **Step 4: Update `src/views/watch/index.ejs`** — render the live section at the top, inside `.container`, immediately after the `<p class="watch-intro">…</p>` line

```ejs
        <% if (typeof liveStream !== 'undefined' && liveStream) { %>
            <div class="watch-live" role="region" aria-labelledby="watch-live-heading">
                <div class="watch-live__header">
                    <span class="stream-badge stream-badge--live" role="status" aria-live="polite">Live Now</span>
                </div>
                <div class="watch-player__frame">
                    <iframe src="<%= liveStream.embedUrl %>" title="<%= liveStream.title %> livestream player"
                        allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="eager"
                        referrerpolicy="no-referrer"></iframe>
                </div>
                <h2 class="watch-live__title" id="watch-live-heading"><%= liveStream.title %></h2>
            </div>
        <% } %>
```

- [ ] **Step 5: Run the test + full suite — expect PASS**

Run: `npx jest __tests__/routes/watchLive.test.js && npx jest`
Expected: PASS.

- [ ] **Step 6: Add/extend the Watch accessibility test** (jest-axe) so the live section is covered. If `__tests__/views/` has an existing watch a11y test, add a `liveStream`-present case; otherwise create `__tests__/views/watch.accessibility.test.js` mirroring an existing `*.accessibility.test.js` (render `/watch` with a mocked live stream, assert no axe violations).

- [ ] **Step 7: Run a11y test + lint**

Run: `npx jest __tests__/views/watch.accessibility.test.js && npm run lint`
Expected: PASS, lint clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(watch): show the live stream on the Watch tab when live"
```

---

### Task 3: Delete the recordings subsystem and repoint links

**Files:**
- Delete: `src/controllers/recordingController.js`, `src/services/RecordingService.js`, `src/routes/admin/recordings.js`, `src/views/recordings/` (index.ejs, show.ejs), `src/views/admin/recordings/` (list.ejs), `public/js/admin-recordings.js`
- Delete tests: `__tests__/services/RecordingService.test.js`, `__tests__/integration/adminRecordingsRoutes.test.js`
- Modify: `src/server.js` (remove `adminRecordingsRoutes`/`recordingsRoutes` requires + the `/admin/recordings` mount; keep the `/archive` mount → now the redirect router from Task 1)
- Modify: `src/views/layout.ejs` (remove the "Archive" nav `<li>`, ~line 111)
- Modify: `src/views/admin/dashboard.ejs` (remove the "Recordings" button, ~line 125)
- Modify: `src/views/home.ejs` (repoint the offline-state CTA `/archive` → `/watch`, ~line 76)
- Modify (prune recordings cases only): `__tests__/integration/adminHandlersCsp.test.js`, `__tests__/routes/seo.test.js`, `__tests__/integration/sitemap.test.js`, `__tests__/scripts/seedDemo.test.js`
- Modify: `scripts/seed*` (stop seeding demo recordings)

**Interfaces:**
- Consumes: the Task 1 redirect router (so `/archive` still resolves after the controller is gone).
- Produces: no recordings code remains; nav shows a single "Watch".

- [ ] **Step 1: Repoint the homepage offline CTA** — `src/views/home.ejs` ~line 76

Change:
```ejs
        <a href="/archive" class="stream-link cta-button">View Recordings</a>
```
to:
```ejs
        <a href="/watch" class="stream-link cta-button">Watch Past Services</a>
```

- [ ] **Step 2: Remove the "Archive" nav link** — `src/views/layout.ejs` ~line 111

Delete the line:
```ejs
            <li><a href="/archive" <%=activePath==='/archive' ? 'aria-current="page"' : '' %>>Archive</a></li>
```

- [ ] **Step 3: Remove the admin "Recordings" button** — `src/views/admin/dashboard.ejs` ~line 125

Delete the line:
```ejs
            <a href="/admin/recordings" class="btn btn-outline-primary me-2 mb-2">Recordings</a>
```

- [ ] **Step 4: Remove server wiring** — `src/server.js`

Delete the require lines (~230, ~239):
```js
const adminRecordingsRoutes = require('./routes/admin/recordings');
```
and the `/admin/recordings` mount (~255):
```js
app.use('/admin/recordings', adminRecordingsRoutes);
```
Keep `const recordingsRoutes = require('./routes/recordings');` and `app.use('/archive', recordingsRoutes);` — that is now the Task 1 redirect router.

- [ ] **Step 5: Delete the recordings code + views + obsolete tests**

```bash
git rm src/controllers/recordingController.js \
       src/services/RecordingService.js \
       src/routes/admin/recordings.js \
       public/js/admin-recordings.js \
       __tests__/services/RecordingService.test.js \
       __tests__/integration/adminRecordingsRoutes.test.js
git rm -r src/views/recordings src/views/admin/recordings
```

- [ ] **Step 6: Prune residual recordings references in shared tests + seed**

Read each of these and remove only the recordings-specific cases (leave calendar-archive and unrelated cases intact):
- `__tests__/integration/adminHandlersCsp.test.js` — drop the `/admin/recordings` case from its route table.
- `__tests__/routes/seo.test.js` and `__tests__/integration/sitemap.test.js` — remove any `/archive` assertions (`/archive` is not in `SITEMAP_PATHS`; confirm and adjust).
- `__tests__/scripts/seedDemo.test.js` — drop assertions about seeded recordings.
- `scripts/seed*` (find with `grep -rl "recordings\|RecordingService" scripts/`) — remove the recordings-seeding block.

- [ ] **Step 7: Run full suite + lint — expect PASS**

Run: `npx jest && npm run lint`
Expected: all green, lint clean, no `Cannot find module` for deleted files.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(watch): retire local recordings archive (single Watch surface)"
```

---

## Final verification (after all tasks)
- [ ] Full suite **3×** green + `npm run lint` clean.
- [ ] `npm run dev`; `curl -I localhost:3000/archive` and `/archive/abc` → `301 Location: /watch`.
- [ ] `/watch` renders past videos; with an active scheduled stream (admin Go Live), a "Live Now" embed appears at the top; `/watch` returns 200 even if the streaming lookup fails.
- [ ] Nav shows one "Watch", no "Archive"; admin dashboard has no "Recordings" button; admin streaming Go-Live flow unchanged.
- [ ] Homepage live hero still renders; offline CTA points to `/watch`.

## Self-review notes
- **Spec coverage:** redirect (Task 1), live-on-Watch (Task 2), deletion + link repoint + test/seed prune (Task 3), migrations kept, calendar archive untouched — all covered. Facebook mirroring is operator config (out of code scope), noted in the spec.
- **No placeholders:** all code shown; Step 6 of Task 3 requires reading-then-pruning specific files (their exact current cases aren't enumerable without reading, but the files and the recordings-specific targets are named).
- **Type consistency:** `liveStream = { embedUrl, title }` produced in Task 2 Step 3 matches the view usage in Step 4.
