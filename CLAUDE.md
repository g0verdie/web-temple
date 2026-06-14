# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read AGENTS.md first

`AGENTS.md` at the repo root is the authoritative agent-facing doc — stack snapshot, commands, architecture, test-environment escape hatches, env var surface, security pipeline gotchas, conventions, and a "Things to not do" list. Treat it as primary; this file only adds Claude-Code-specific notes and the high-frequency commands.

`README.md` is partly stale (still describes only Story 1.1). Trust `AGENTS.md`, `_bmad-output/planning-artifacts/`, and the code over the README narrative.

## High-frequency commands

```bash
npm run dev               # nodemon src/server.js
npm test                  # jest --coverage (CI runs this on Node 18; threshold 60% global)
npm run test:leaks        # use when the suite hangs (--detectOpenHandles)
npm run lint              # eslint src/**/*.js (__tests__ is NOT linted)
npm run migrate           # node scripts/migrate.js
npx jest <path>           # single file
npx jest -t "<name>"      # single test by name
```

Local stack (Postgres 15 + Redis 7): `docker compose up -d && npm run migrate`.

## Architecture in one paragraph

Express 4 + EJS server-rendered MPA on Node ≥18, plain CommonJS JavaScript (no TS, no bundler, no frontend framework — intentionally). `src/server.js` wires all middleware and mounts routers in order; read it first. Layering: `routes/` → `controllers/` → `services/` (where business logic + DB queries live; controllers don't query directly). Persistence is Postgres via `pg`; Redis (`ioredis` + `bull`) backs caching and the email queue worker (`src/workers/`). Auth is a JWT in an httpOnly `auth_token` cookie decoded **globally** in `src/server.js` to populate `req.user` / `res.locals.user` — don't add a second decode. CSRF (`csurf`) is applied globally via `conditionalCsrf`; every state-changing endpoint including JSON `/api` routes needs `_csrf`. CSP is strict — no inline `<script>`/`<style>`; put assets in `public/`. Routes are mounted in a specific order in `src/server.js` because `pagesRoutes` is a catch-all for CMS slugs on `/`. Migrations are plain SQL files in `migrations/NNN_*.sql`, applied in lexical order with a hardcoded bootstrap that marks `000_*`–`006_*` as applied if the DB predates the migrations table — don't rename or reorder those.

## Critical: NODE_ENV=test escape hatches

The test suite depends on `NODE_ENV === 'test'` branches throughout the code (server, auth/admin/rbac middleware, redis config, email queue). They short-circuit CSRF, the email worker, real Redis, etc., and let tests set `req.user` directly. **Do not "clean these up"** — the suite will break. Use the same `JWT_SECRET = 'test-jwt-secret'` when minting tokens in tests. Integration tests mock `src/config/db` (no real Postgres in CI); follow that pattern.

See `AGENTS.md` § "Test environment quirks" for the full list.

## BMad planning artifacts are authoritative

`_bmad-output/planning-artifacts/` (PRD, architecture, epics) is committed and treated as primary spec material for product/architecture decisions. `_bmad-output/implementation-artifacts/` holds the current sprint-status YAML and per-story docs. The current branch (`f/4.1`) is mid-Epic 4; check `sprint-status.yaml` and the relevant story file before scoping new work.

`_bmad/`, `.agents/`, `.cursor/`, `.gemini/`, `.claude/`, `.opencode/` are gitignored tooling — don't commit anything inside them.

## Hard rules (from AGENTS.md "Things to not do")

- Don't introduce TypeScript, a bundler, or a frontend framework — SSR EJS MPA is the intentional design.
- Don't bypass `NODE_ENV === 'test'` branches in middleware.
- Don't reorder/rename `migrations/000_*` … `006_*` (bootstrap logic hardcodes those names).
- Don't add `console.log` in `src/` — use `src/utils/logger.js` (winston, rotates to `logs/`).
- Don't commit `.env`, `logs/`, `coverage/`, `.lighthouseci/`, or anything under the gitignored tooling dirs.
