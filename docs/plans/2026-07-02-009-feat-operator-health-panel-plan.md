---
title: "Admin Dashboard Operator Health and Honest Recurring Label - Plan"
type: feat
date: 2026-07-02
topic: admin-dashboard-operator-health
execution: code
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# Admin Dashboard Operator Health and Honest Recurring Label

## Goal Capsule

Objective: make the admin dashboard readable and honest for a non-technical operator (a Rabbi) before the Board demo — replace raw backup-pipeline internals and engineer-speak with plain-language service status plus next-step links, surface Redis/email-queue degradation as an honest banner instead of a swallowed log line, and relabel the recurring-donation figure so it reads as pledged intent rather than banked revenue.

Product authority: `docs/ideation/2026-07-01-full-project-review-ideation.html:315` (operator health panel, the ops idea) and `docs/ideation/2026-07-01-full-project-review-ideation.html:229` (honest recurring label, the I1 companion).

Open blockers: link destination for "here's how" next-step actions is undecided (no `/admin/help` route exists today); final label wording and the backup "healthy window" definition are unresolved. See Outstanding Questions.

## Product Contract

### Summary

Two presentation-layer corrections on admin screens, both riding the error taxonomy and formatters already on `dev`. First, the `/admin` System Status card and metrics strip stop leaking `pg_dump | openssl` internals, a meaningless "Server uptime 4m", and a bare "Last backup —", and instead show plain OK / degraded / not-configured status for backups, live chat, and email sending, each with a next step; infrastructure degradation (Redis down, email-queue read failure) becomes an on-page banner rather than a swallowed winston line or a whole-dashboard 500. Second, the `/admin/donations` "Monthly recurring" figure is relabeled to read as pledged intent, because it sums initial gift amounts flagged recurring, not realized monthly charges.

### Problem Frame

The raw internals live in two places. The red "Backup Failure Detected" block renders `latestAttempt.message` verbatim (`src/views/admin/dashboard.ejs:158`), which carries the `pg_dump | openssl` pipeline error; the "Server uptime" tile shows `process.uptime()` formatted as e.g. "4m" (`src/views/admin/dashboard.ejs:114`, `src/controllers/adminController.js:113`); and "Last backup" collapses to "—" when null (`src/views/admin/dashboard.ejs:122`).

The recurring figure is not on the main dashboard — it is on the donations admin screen, labeled "Monthly recurring" (`src/views/admin/donations.ejs:12`). Its value `monthlyRecurringRevenueCents` sums the initial gift amount of each donor whose `donation_type='recurring'` (`src/services/DonationService.js:197`), so it is stated intent; the mock provider has no monthly-charge engine, so no such revenue is banked.

There is a tension to resolve deliberately: today the backup and email-queue reads sit in the outer `Promise.all` whose rejection 500s the dashboard (`src/controllers/adminController.js:137`, comment at `:134`), and `emailQueueService.getQueueStats` has no try/catch so a Redis outage throws (`src/services/emailQueueService.js:83`). The honest-banner requirement means the email-queue read must degrade to a status marker instead of 500-ing.

### Requirements

**Operator health panel (backups, chat, email)**

R1. The System Status card must not render raw backup-pipeline internals to the operator; the `latestAttempt.message` string (which contains `pg_dump | openssl`) must not appear in the rendered dashboard.

R2. Backup status must resolve to one of three operator-plain states — not configured (no attempt recorded), failing (an attempt exists and its status is not SUCCESS), or OK (a successful backup exists) — each with plain copy such as "Backups: not configured", "Backups: last attempt failed", "Backups: OK (last <date>)".

R3. Every non-OK status (backups, chat, email) must carry a next-step link with plain-language anchor text (e.g. "how to set up backups"), not a bare state with no action.

R4. The card must show plain-language service statuses for live chat and email sending, each expressed as OK / degraded / down with operator copy, not raw internals or counts alone.

R5. Redis or email-queue-read degradation must render as an explicit on-page banner (an honest degraded state) instead of only a swallowed winston log line or a whole-dashboard 500; the dashboard must still return 200 with the banner when the email-queue stats read fails.

R6. The raw "Server uptime" tile must be removed or repurposed into a plain operator indicator; a bare duration like "4m" carries no operator-actionable meaning.

R7. Severity mapping must be honest: a degraded or failing state must never render as OK, and an OK state must not use danger/alarm styling.

R8. Any date rendered in the status panel (e.g. last-backup timestamp) must go through the temple-timezone formatter `src/utils/templeTime.js` rather than bare `toLocaleString()` / `toLocaleDateString()` as used today at `src/views/admin/dashboard.ejs:122`, `:157`, `:166`.

**Honest recurring label**

R9. The "Monthly recurring" label on `src/views/admin/donations.ejs:12` must be renamed to read as pledged intent, not banked revenue (e.g. "Pledged recurring / mo").

R10. The screen must make explicit — via the label or an adjacent caption — that the figure sums stated recurring pledges (initial gift amounts flagged `donation_type='recurring'`), not realized recurring charges.

R11. The computation of `monthlyRecurringRevenueCents` in `src/services/DonationService.js:197` must not change; this is a presentation-only relabel.

**Cross-cutting (error handling, CSP, tests)**

R12. Genuinely exceptional paths in the status-gathering code must flow through the I14 error taxonomy (`src/errors/index.js`) and the terminal `src/middleware/errorHandler.js`; the email-queue and backup reads that back status cards must self-degrade to a known status rather than 500 the dashboard where R5 requires a banner.

R13. All new or changed markup must stay CSP-safe: no inline `<script>` or `<style>`; styling via classes in `public/css/admin.css`; all logging via `src/utils/logger.js` (winston), no `console.log`.

R14. New status markup should reuse the shared EJS component kit (`src/views/partials/button.ejs`, `src/views/partials/page-header.ejs`, `src/views/partials/empty-state.ejs`) rather than ad-hoc markup where a component fits.

R15. New or updated admin-dashboard tests must keep the just-merged flake-fix pattern of mocking `StreamingService.getPublicEmbedMetadata` (see `__tests__/integration/adminDashboardRoutes.test.js:12`) so the render is deterministic.

### Acceptance Examples

AE1. Covers R1, R2: given a latest backup attempt with `status='FAILED'` and a message containing "pg_dump | openssl …", the rendered `/admin` shows "Backups: last attempt failed" with a next-step link and contains neither the substring "pg_dump" nor "openssl".

AE2. Covers R2, R3: given no backup attempt and no successful backup on record, the card reads "Backups: not configured" with a setup link, and does not render a red "Backup Failure Detected" alert.

AE3. Covers R2, R7, R8: given a successful backup on record and a latest attempt of SUCCESS, the card reads "Backups: OK" with the last-backup date formatted via `templeTime`, using non-alarm styling.

AE4. Covers R5, R12: given the email-queue stats read throws (Redis down), `GET /admin` still responds 200 and renders an "Email sending: degraded" banner rather than the 500 error view.

AE5. Covers R9, R10, R11: the `/admin/donations` metrics strip shows the recurring figure labeled as pledged (e.g. "Pledged recurring / mo") with a caption clarifying it is pledged intent, does not use the label "Monthly recurring", and the underlying value is unchanged.

AE6. Covers R7: given a fully healthy system (backup OK, chat reachable, email queue readable), no status element renders in danger/alarm styling.

### Success Criteria

A non-technical operator reading `/admin` sees service health in plain words with a next step for anything wrong, never a shell pipeline or a bare uptime figure; a Redis/email outage is visibly flagged rather than silent; and the Board reading `/admin/donations` sees the recurring figure honestly framed as pledges, not banked revenue.

### Scope Boundaries

In scope: presentation and status-derivation for the `/admin` System Status card, its metrics tiles, and the `/admin/donations` recurring label, plus the minimal controller change to degrade the email-queue read to a banner.

Out of scope: the backup mechanism itself (no new backup daemon; "not configured" is derived from the existing absence-of-attempts signal), the `monthlyRecurringRevenueCents` computation, the mock/PayPal provider work (I1), the transactional-outbox and Redis-independent alert (I8), and any new health-probe infrastructure beyond reading the existing `backupLogService`, `emailQueueService`, `StreamingService`, and `chatSocketServer` signals.

### Dependencies / Assumptions

Depends on the I14 taxonomy already on `dev` (`src/errors/index.js`, `src/middleware/errorHandler.js`), the temple-tz formatter (`src/utils/templeTime.js`), and the component kit (`src/views/partials/`).

Assumes email-sending and live-chat health can be derived from existing signals: email = success/failure of the `emailQueueService.getQueueStats` read plus its failed count (`src/services/emailQueueService.js:83`); chat = success of the stream/active-connection read in `gatherLiveMetrics` (`src/controllers/adminController.js:82`).

Assumes `backupLogService.getLastSuccessfulBackup` and `getLastBackupAttempt` remain the backup-status source (`src/controllers/adminController.js:138`).

### Outstanding Questions

Resolve before planning:
- Where do "here's how" next-step links point — an internal runbook page, an external docs URL, or a new `/admin/help` route that does not exist today?
- Final wording of the recurring label ("Pledged recurring / mo" vs alternative), and whether to also relabel the adjacent "Recurring donors" metric (`src/views/admin/donations.ejs:11`).
- What defines backup "OK" vs "stale" — a freshness window (e.g. last success within 24h/7d), or simply show the last-success date with no staleness judgment?
- Is the "Server uptime" tile removed entirely, or repurposed as a plain "Site: running" indicator?

Deferred:
- A true live-chat server health probe (today only "active stream present" vs read error is distinguishable) is out of scope.
- The Redis-independent failure-alert fallback and full transactional outbox (I8) are tracked separately.

### Sources / Research

- `docs/ideation/2026-07-01-full-project-review-ideation.html:315` — operator health panel idea (I5 in doc); companion honest-MRR at `:229` (I1 in doc).
- `src/controllers/adminController.js:47` — `formatUptime`; `:62` — `gatherLiveMetrics`; `:113` — `serverUptimeSeconds`; `:137` — backup/email reads in outer `Promise.all` that 500 on throw; `:146` — `alerts.backupFailed`.
- `src/views/admin/dashboard.ejs:114` — "Server uptime" tile; `:122` — "Last backup —"; `:154` — System Status card; `:158` — raw `latestAttempt.message`; `:171` — "No successful backups found".
- `src/services/DonationService.js:197` — recurring-type summation; `:203` — `mrr`; `:211` — `monthlyRecurringRevenueCents`.
- `src/views/admin/donations.ejs:11` — "Recurring donors"; `:12` — "Monthly recurring" label.
- `src/errors/index.js:22` — `AppError`; `:39`–`:92` — Validation/NotFound/Auth/Provider/Internal; `:101` — `mapError`.
- `src/middleware/errorHandler.js:1` — terminal error sink (JSON/HTML negotiation, winston, EBADCSRFTOKEN 403).
- `src/utils/templeTime.js:16` — `templeTimezone()` default `America/Chicago`; `:89` — exports `formatEventDateTime`, `formatEventTime`, `toTempleIso`.
- `src/services/emailQueueService.js:83` — `getQueueStats` (no try/catch, throws when Redis down); `:124` — admin-alert failure swallowed to a winston log.
- `src/views/partials/button.ejs`, `src/views/partials/page-header.ejs` — component kit (I15).
- `__tests__/integration/adminDashboardRoutes.test.js:12` — flake-fix `StreamingService.getPublicEmbedMetadata` mock to keep in new admin tests.
