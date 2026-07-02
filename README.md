# Temple B'nai Israel Website

A modern, accessible website for Temple B'nai Israel — live streaming, donations,
a member directory, a community calendar, and a full admin/Rabbi back office.

Server-rendered for performance and accessibility, designed for self-hosted
deployment, and built to WCAG AA standards.

## Overview

This is a server-rendered Multi-Page Application (MPA) built with Node.js/Express
and EJS — **no TypeScript, bundler, or frontend framework, by design**. Business
logic and data access live in a `services/` layer; controllers stay thin. Auth is
a JWT in an httpOnly cookie with RBAC; CSRF, a strict Content-Security-Policy, and
field-level encryption at rest are applied throughout.

> **For contributors and coding agents:** [`AGENTS.md`](AGENTS.md) is the
> authoritative engineering doc (architecture, test-environment quirks, env var
> surface, security pipeline gotchas, and a "things to not do" list). Read it before
> making changes.

## Features

**Public**
- Homepage with mission, live-service countdown, and upcoming events
- Live streaming (Facebook Live embed with scheduled-stream / live-window logic)
- Live chat during streams (WebSocket) with reserved-name guards and moderation
- Video archive of past recordings (with captions metadata)
- Community calendar with event details and an iCal feed
- Announcements, About, Contact form, and CMS-managed static/legal pages

**Members**
- Registration, login, password reset, email-change, and onboarding
- Notification preferences and one-click email unsubscribe
- Opt-in member directory with household members, live search, and CSV/JSON export
- Account settings (including the directory profile editor)

**Donations**
- Online donations with PDF receipts and donor history
- Pluggable payment provider — ships with a **mock provider** (real PayPal is gated
  behind Board authorization)

**Admin / Rabbi dashboard**
- Pages CMS, recordings, streaming schedule, donations, member directory,
  announcements, and calendar management
- Role-based access control, audit logging, and dashboard metrics

**Cross-cutting**
- Accessibility (WCAG AA), SEO (sitemap, JSON-LD, Open Graph), security headers
- Background email queue + service reminders (Redis/Bull)
- Error tracking (Sentry) and rotating structured logs (winston)

## Tech Stack

- **Runtime:** Node.js v18+, Express 4 (CommonJS)
- **Views:** EJS server-rendered templates via a shared `layout.ejs`
- **Database:** PostgreSQL (`pg`), plain SQL migrations
- **Cache & queue:** Redis (`ioredis` + `bull`)
- **Realtime:** `ws` (live chat)
- **Auth & security:** `jsonwebtoken`, `bcrypt`, `csurf`, `helmet`, `express-rate-limit`,
  `sanitize-html`, field-level encryption
- **Email & docs:** `nodemailer`, `pdfkit` (receipts), iCal calendar feed
- **Observability:** `@sentry/node`, `winston` + daily-rotate
- **Testing & QA:** Jest, Supertest, jest-axe, Lighthouse CI, ESLint

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- PostgreSQL 15 and Redis 7 (or Docker, which provides both — see below)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file and fill in the values
cp .env.example .env
#    .env.example is the source of truth for configuration — at minimum set
#    ENCRYPTION_KEY and JWT_SECRET (generation hints are inline in the file).

# 3. Start Postgres + Redis (Docker Compose provides Postgres 15 and Redis 7)
docker compose up -d

# 4. Apply database migrations
npm run migrate

# 5. (Optional) Create an admin user and/or seed demo data
npm run create-admin
npm run seed

# 6. Run the dev server (nodemon)
npm run dev
```

The app boots from [`src/server.js`](src/server.js) and listens on `PORT` (default 3000).

## Scripts

```bash
npm run dev               # nodemon src/server.js (development)
npm start                 # node src/server.js (production)
npm test                  # jest --coverage (CI gate; 60% global threshold)
npm run test:watch        # jest in watch mode
npm run test:a11y         # accessibility tests only (jest-axe)
npm run test:leaks        # jest --detectOpenHandles (use when the suite hangs)
npm run test:performance  # Lighthouse CI (lhci autorun)
npm run lint              # eslint src/**/*.js  (__tests__ is not linted)
npm run lint:fix          # eslint --fix
npm run migrate           # apply SQL migrations (scripts/migrate.js)
npm run create-admin      # bootstrap an admin user
npm run seed              # seed demo data (scripts/seed-demo.js)
```

Run a single test file: `npx jest __tests__/integration/authRoutes.test.js`
Run by name: `npx jest -t "rejects expired token"`

## Testing

The suite uses Jest + Supertest, with jest-axe for accessibility and Lighthouse CI
for performance. Integration tests **do not** require a live database — they mock
`src/config/db`, and `NODE_ENV=test` short-circuits CSRF, the email worker, and
real Redis. See the "Test environment quirks" section of [`AGENTS.md`](AGENTS.md)
before adding tests, and keep using the `JWT_SECRET = 'test-jwt-secret'` convention.

## Project Structure

```
web-temple/
├── src/
│   ├── server.js          # middleware wiring + route mounting (read this first)
│   ├── config/            # db, redis, roles-permissions, sentry
│   ├── routes/            # express.Router per area; admin/* nested
│   ├── controllers/       # request handlers (no direct DB access)
│   ├── services/          # business logic + SQL (most logic lives here)
│   ├── middleware/        # requireAuth, requireRbac, sessionTimeout, requestId
│   ├── workers/           # Bull queue workers (email, reminders)
│   ├── utils/             # logger, encryption, sanitize, tokens
│   └── views/             # EJS templates (rendered through layout.ejs)
├── public/                # static assets (css, js, images, fonts) served from /
├── __tests__/             # unit, integration, security, views, ...
├── migrations/            # plain SQL, applied in lexical order (NNN_*.sql)
├── scripts/               # migrate, create-admin, seed, backup, ops
├── docs/                  # ops docs: RUNBOOK, SETUP, SSL_TLS_SETUP, SECURITY_*, ...
├── _bmad-output/          # BMad PRDs, epics, stories, sprint-status.yaml
├── docker-compose.yml     # Postgres 15 + Redis 7 for local dev
├── AGENTS.md              # authoritative engineering / agent guide
└── package.json
```

## Architecture (in brief)

- **Layering:** `routes/ → controllers/ → services/`. Services own all business logic
  and SQL; controllers don't query the database directly.
- **Routing:** All middleware and routers are wired in [`src/server.js`](src/server.js)
  in a deliberate order — `pagesRoutes` is a catch-all serving CMS slugs on `/`, so it
  mounts last.
- **Auth:** A JWT in an httpOnly `auth_token` cookie is decoded **globally** in
  `server.js` to populate `req.user` / `res.locals.user`. RBAC is enforced via
  `requireRbac`.
- **Security:** CSRF (`csurf`) is applied globally — even JSON `/api` routes need a
  `_csrf` token. CSP is strict (no inline `<script>`/`<style>`; assets live in
  `public/`). Sensitive fields are encrypted at rest.
- **Migrations:** Plain SQL in `migrations/NNN_*.sql`, applied in lexical order. Files
  `000_*`–`006_*` are bootstrap-marked — **do not rename or reorder them**.

See [`AGENTS.md`](AGENTS.md) and `_bmad-output/planning-artifacts/architecture.md`
for the full picture.

## Configuration

[`.env.example`](.env.example) documents the full configuration surface (database,
auth, Redis/queue, email/SMTP, streaming, captcha, encryption, and backups) with
inline guidance. Copy it to `.env` and fill in the values. `ENCRYPTION_KEY` and
`JWT_SECRET` are required outside of tests.

## Deployment

The app expects to run behind a reverse proxy (Nginx) in production:
`app.enable('trust proxy')` is set and `x-forwarded-proto` drives the HTTPS redirect.
See [`docs/SETUP.md`](docs/SETUP.md), [`docs/SSL_TLS_SETUP.md`](docs/SSL_TLS_SETUP.md),
and [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for provisioning, TLS, and operational
procedures.

**Single-process invariant:** web-temple runs as exactly one web+worker process,
enforced at production boot by a Postgres advisory lock (`src/config/singleProcessLock.js`).
A second concurrent process refuses to start (it fails closed and exits non-zero),
because per-IP rate limits, the WS connection cap, and the reminder scan are all
per-process by design — do not run more than one instance.

## Accessibility

Built to WCAG AA: semantic HTML with proper landmarks, 4.5:1 minimum color contrast,
visible focus indicators, skip links, and ARIA live regions for dynamic content.
Accessibility is enforced in CI via jest-axe (`npm run test:a11y`).

## Documentation

- [`AGENTS.md`](AGENTS.md) — authoritative engineering / agent guide
- [`docs/`](docs/) — operational docs (setup, runbook, security, troubleshooting)
- `_bmad-output/` — BMad planning artifacts (PRD, architecture, epics, stories)

## License

UNLICENSED — private project for Temple B'nai Israel.

## Contact

Developer: Ilya
