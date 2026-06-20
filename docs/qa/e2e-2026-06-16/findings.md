# E2E User Test — Findings (2026-06-16)

**Branch:** `fix/e2e-walkthrough-2026-06-16` (off `dev`)
**Method:** Agent-driven browser walkthrough (agent-browser 0.27.3) against a locally-seeded stack
**Mode:** `NODE_ENV=development` (so auth cookies work over `http://localhost`; prod-mode checks deferred to hosting)
**Scope:** Public flows + authenticated member + live chat + admin/dashboard + RBAC across all 5 roles
**Stack:** docker compose (Postgres 15 + Redis 7) · `npm run migrate` (000–023) · `npm run seed` · `npm run dev` :3000
**Screenshots:** `docs/qa/e2e-2026-06-16/shots/` (≈30 PNGs, local)

## Verdict

The MVP is in **strong shape end-to-end.** Every user and admin journey reached its expected end state. One **significant user-facing bug** was found and fixed (contact form). Three other items are **flagged for the hosting/launch phase** (not fixed today by design — they are security-/topology-/deploy-coupled decisions). No 500s, no privilege-escalation, no broken core flows.

---

## Defects

### 1. ✅ FIXED — Contact form rejected every submission (CSRF) — **HIGH**
- **Symptom:** Submitting `/contact` returned **403 "Failed to send message."** for any real user.
- **Root cause:** `public/js/contact-form.js` POSTed JSON via `fetch` with **no CSRF token**, and `src/views/contact.ejs` had no `_csrf` field. `csurf` rejected it before the controller ran (`POST /contact 403` in <1ms).
- **Why tests missed it:** integration tests run under `NODE_ENV=test`, where CSRF is globally disabled — so the suite cannot catch a missing client-side token. See Test Gap below.
- **Scope of impact:** the temple's primary "get in touch" channel was broken in **dev *and* production** (CSRF is active in both).
- **Fix:** read the `csrf-token` meta tag and send it as a `CSRF-Token` header, exactly matching the existing `public/js/login.js` pattern. Commit `305d771`.
- **Verified:** re-submitted → **`POST /contact 201`**, "Message sent successfully!", message appears in admin inbox count. `npx jest contact` green, `npm run lint` clean.

### 2. 🚩 FLAG — `trust proxy: true` weakens IP rate limiting — **HIGH (pre-launch)**
- **Symptom:** server log throws `express-rate-limit ValidationError: The Express 'trust proxy' setting is true, which allows anyone to trivially bypass IP-based rate limiting.`
- **Cause:** `src/server.js` uses `app.enable('trust proxy')` (= trust *all* proxies). A client can spoof `X-Forwarded-For` to dodge the auth/contact/donation rate limiters.
- **Recommended fix:** `app.set('trust proxy', 1)` for the documented single-Nginx-hop deployment (`docs/SETUP.md`/`RUNBOOK.md`). **Confirm the hop count during hosting research** — e.g. Cloudflare-in-front-of-Nginx would be `2`. Left unfixed today because the correct value is coupled to the final hosting topology you're about to choose.

### 3. 🚩 FLAG — `scripts/create-admin.js` is broken (documented prod bootstrap fails) — **MEDIUM (pre-launch)**
- **Symptom:** `npm run create-admin` would error at runtime.
- **Cause:** `scripts/create-admin.js:39` inserts `(username, …, password, …, is_active)`, but the real `users` table (`migrations/000_*`) has `email` + `password_hash` and **no** `username`/`is_active` columns.
- **Impact:** `docs/SETUP.md:444` instructs operators to run `npm run create-admin` to create the first admin — that step is broken. (`scripts/seed-demo.js` uses the correct insert shape and is the working reference.)
- **Recommended fix:** align `create-admin.js` to the real schema (email/password_hash/first_name/last_name/role, bcrypt-hashed) mirroring `authService.registerUser` / `seed-demo.js`. Flagged not-fixed today: it touches password hashing + the auth insert path and deserves a deliberate fix + a smoke test. Ties into the "provision real Rabbi/admin accounts" launch item.

### 4. 🚩 FLAG (already known) — Email links fall back to `http://localhost:3000` — **MEDIUM (pre-launch)**
- **Confirmed empirically:** the password-reset email queued during testing contained `http://localhost:3000/auth/reset-password?token=…`.
- **Cause:** `APP_URL`/`APP_BASE_URL` unset → localhost fallback in email/reminder links (already noted in deploy-readiness review). **Set `APP_URL` in production.** Expected in dev; listed here as empirical confirmation for the hosting checklist.

### Test gap (no code change today)
The contact CSRF bug shipped green because `NODE_ENV=test` disables CSRF globally, so **no test exercises CSRF-token presence on JSON/fetch forms.** Consider a thin test that asserts each client-driven form includes the `csrf-token` meta read + header (or a non-test-env integration test for one representative form). Recommend tracking separately.

---

## What passed (by flow)

### Public (unauthenticated)
| Flow | Result | Notes |
|---|---|---|
| Homepage `/` | ✅ | Hero, LIVE NOW stream card, seeded countdown/events/announcements, legal footer (correct **Florence, AL** address) |
| `/watch` (Past Services) | ✅ | Curated mock videos + player |
| `/calendar` | ✅ | Month nav, members-only notice, seeded events |
| `/about`, `/privacy`, `/terms`, `/accessibility` | ✅ | Render (legal content is placeholder — known content task) |
| Donations `/donations` (mock) | ✅ | **Success** → thank-you (+ receipt queued); **Failure** → "no charge" retry page; **Cancel** → back; **Anonymous** (no email) → success. No real charge. |
| `/contact` | ✅ (after fix) | See defect #1 |
| `/register` | ✅ | 12-char password rule enforced client-side; 201 → redirect → logged in |
| `/login` + logout | ✅ | `POST /api/auth/login 200`; logout `200`; CSRF token sent correctly |
| Password reset request + reset form | ✅ | Non-enumerating message; reset email queued; `/auth/reset-password?token=` renders form; **no CSP violations** |
| `/robots.txt`, `/sitemap.xml`, `/health`, `/ready` | ✅ | `/ready` → `{db:ok, redis:ok}` |

### Authenticated member (demo-member)
| Flow | Result | Notes |
|---|---|---|
| `/archive` + `/archive/:id` | ✅ | Filter combobox; playback page with "Archived Chat History" |
| `/directory` + search | ✅ | Member cards render |
| `/account/settings` | ✅ | Profile / Preferences / Change-Password sections; **`PUT /api/account/preferences 200`** ("Preferences updated") |

### Live chat
| Flow | Result | Notes |
|---|---|---|
| Homepage chat (logged-in + guest paths) | ✅ | Posted message round-trips; console "WS connection confirmed"; correct attribution + timestamp; prior history shown |

### Admin / dashboard (demo-admin)
| Flow | Result | Notes |
|---|---|---|
| `/admin` dashboard | ✅ | 6-metric hub populated (mock donations show **$90 month**; contact test in inbox count); backup-failure warning expected in dev |
| All sections load (announcements, calendar, donations, directory, streaming, chat-moderation, recordings, pages, audit-logs) | ✅ | All `200`, no 500s |
| Admin **write** path | ✅ | Created+published an announcement (`POST /admin/announcements 201`) → **appears on public homepage** |
| Donations CSV export | ✅ | `GET /admin/donations/export.csv 200` (downloads) |
| Chat moderation queue | ✅ | Correct empty state (member messages aren't pre-moderated) |
| CMS Quill editor (`/admin/pages/about`) | ✅ | Rich-text toolbar loads, **no CSP violations** |

### RBAC (all 5 roles) — all correct, no privilege leaks
| Route | member | treasurer | social_chair | rabbi | admin |
|---|---|---|---|---|---|
| `/admin` (dashboard) | 403 | 403 | — | 200 | 200 |
| `/admin/donations` | 403 | **200** | 403 | 200 | 200 |
| `/admin/announcements` | 403 | 403 | **200** | 200 | 200 |
| `/admin/calendar` | — | — | **200** | — | 200 |
| `/admin/chat-moderation` | 403 | — | **200** | — | 200 |
| `/admin/pages/about` (admin-only content) | 403 | 403 | 403 | **403** | 200 |
| `/admin/audit-logs` (page = admin+rabbi by design) | — | — | — | **200** | 200 |

Note: `/admin/audit-logs` *page* is guarded by `requireAdminAccess` = ADMIN+RABBI (same as the dashboard); the JSON API `/api/admin/audit-logs` is super-admin-only. Rabbi access to the page is intentional, not a leak.

---

## Out of scope today (→ hosting/launch phase)
Real mobile Safari / cross-browser sweep · manual screen-reader pass (donation + login) · `NODE_ENV=production` run (secure cookies, PG SSL, hCaptcha fail-closed) · graceful-shutdown/SIGTERM · real PayPal · real SMTP + SPF/DKIM/DMARC · Lighthouse-in-prod. Items #2–#4 above feed directly into the hosting checklist.
