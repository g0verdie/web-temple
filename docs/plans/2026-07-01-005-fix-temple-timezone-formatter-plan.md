--- 
title: One Temple-Timezone Datetime Formatter - Plan
type: fix
date: 2026-07-01
topic: temple-timezone-datetime-formatter
execution: code
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# One Temple-Timezone Datetime Formatter - Plan

## Goal Capsule

- Objective: route every user-facing event/stream time through one DST-aware, temple-timezone formatter so the same instant renders identically on every surface.
- Product authority: IDEA I3, `docs/ideation/2026-07-01-full-project-review-ideation.html`.
- Open blockers: two Resolve-Before-Planning items — completing the call-site audit, and deciding whether calendar day-cell bucketing (currently UTC) must move with the display timezone.

---

## Product Contract

### Summary

Introduce one server-side formatter bound to a single configured `TEMPLE_TIMEZONE` (default `America/Chicago`) and make it the only path that turns a stored instant into a user-facing event or stream time. Every ad-hoc `timeZone: 'UTC'` and every bare local `toLocale*` call for event times is replaced by a call to it.

### Problem Frame

The same event renders at two different clock times depending on the surface. The public calendar formats with `timeZone: 'UTC'` while the admin table formats with no timezone (server-local), producing a clean multi-hour disagreement for one instant. Because the homepage, the calendar popup, reminder emails, stream pages, and JSON-LD each format independently, the same disagreement can surface anywhere, and there is no single place that defines what a temple event time means.

### Key Decisions

**Store-as-instant, format-only.** Event and stream columns are `TIMESTAMPTZ` (see Sources), so the `pg` driver hands views absolute-instant `Date` objects. The formatter therefore only *projects* an instant into the temple zone for display; it must not reinterpret naive input. Input-side interpretation stays where it already lives.

**IANA zone name, not a fixed offset.** The formatter is configured with an IANA zone (`America/Chicago`) rather than a fixed offset, because the temple observes CST/CDT and a fixed offset cannot be DST-correct. This is deliberately distinct from the existing fixed-offset `APP_TIMEZONE_OFFSET` used for input parsing.

### Requirements

**Formatter contract**
R1. A single server-side formatter (e.g. `formatInTempleTz`) is the sole source of truth for rendering user-facing event and stream times.
R2. The formatter projects an absolute instant into the configured temple timezone and formats only; it does not reinterpret naive or offset-less input.
R3. The formatter exposes the display variants surfaces need today (full date-plus-time, and time-only) so no surface hand-rolls `Intl` options.
R4. Every `timeZone: 'UTC'` formatting call and every bare local `toLocale*` call for an event or stream time is removed and replaced by a call to the formatter.

**Configuration**
R5. The temple timezone is configured via one env var `TEMPLE_TIMEZONE` holding an IANA zone name, defaulting to `America/Chicago` when unset.
R6. `TEMPLE_TIMEZONE` is documented in `.env.example`.

**Surface coverage**
R7. The public calendar month grid renders event times via the formatter (`src/views/calendar/index.ejs`).
R8. The calendar event popup shows the same time as that event's grid cell, derived from the same server-formatted value rather than a second client-side UTC format (`public/js/calendar-event-modal.js`).
R9. The admin calendar list and archive render event times via the formatter (`src/views/admin/calendar/list.ejs`, `src/views/admin/calendar/archive.ejs`).
R10. Homepage upcoming events and the next-service time render via the formatter (`src/server.js` `app.locals.formatEventDate`, `src/controllers/homeController.js`).
R11. Reminder emails render event date and time via the formatter (`src/services/emailTemplateService.js`).
R12. Stream schedule surfaces render scheduled start via the formatter (`src/views/streams/show.ejs`, `src/views/admin/streaming/index.ejs`).
R13. Calendar JSON-LD `startDate` emits an ISO-8601 string carrying the temple-zone offset for the stored instant (`src/controllers/calendarController.js`).

**DST correctness**
R14. Formatting is DST-aware: the one formatter yields the CST or CDT offset according to each instant's date, exercised by tests spanning a spring-forward and a fall-back transition.

### Acceptance Examples

AE1. Covers-R2,R7,R9: an event stored at a fixed UTC instant renders the identical local time string on the public calendar and the admin table.
AE2. Covers-R8: opening the popup for an event shows the same time already displayed in that event's grid cell.
AE3. Covers-R14: an instant in July formats with a -05:00 (CDT) offset and one in January with -06:00 (CST), both from the one formatter.
AE4. Covers-R13: the JSON-LD `startDate` carries -05:00 for a summer event and -06:00 for a winter event, each denoting the same instant as the stored value.

### Success Criteria

- The formatter is covered by tests including a DST transition.
- No `timeZone: 'UTC'` or bare-local event/stream-time formatting remains in the audited call sites (grep-clean).

### Scope Boundaries

- Administrative record timestamps not tied to event scheduling (audit-log timestamps, `created_at`/`updated_at`, `published_at`, donation dates, member join dates) are OUT unless the planner folds them in — see Outstanding Questions.
- Input-side parsing of `datetime-local` form values (`EventService`/`StreamingService` via `APP_TIMEZONE_OFFSET`) is OUT; this change is display-only.
- Client-side relative/live timestamps (e.g. live chat message times) are OUT.
- No database migration; the stored representation is unchanged.

### Dependencies / Assumptions

- Event and stream time columns are `TIMESTAMPTZ`, so `pg` returns absolute-instant `Date` objects and display-only projection is correct (`migrations/020_create_events_table.sql`, `migrations/015_create_scheduled_streams_table.sql`).
- Node ≥18 ships full ICU, so `America/Chicago` is available via `Intl` with no extra timezone library.

### Outstanding Questions

**Resolve Before Planning**
- First planning step: complete the call-site audit. This document lists the known set; the planner must confirm nothing feeding an event/stream time was missed before routing.
- Re-confirm the stored representation is UTC instants (`TIMESTAMPTZ`), not naive local, so the formatter can remain format-only rather than also interpreting.
- Calendar day/month bucketing (grid cell placement and the month window) is computed in UTC in `src/controllers/calendarController.js`. If display moves to `America/Chicago` while bucketing stays UTC, an event near local midnight can show a temple-local time that disagrees with its grid day cell — decide whether bucketing must also move to the temple zone to avoid reintroducing cross-surface drift.

**Deferred to Planning**
- Whether to also route the broader admin record timestamps through the formatter, and in which timezone, or leave them as-is.
- Relationship to the existing `APP_TIMEZONE_OFFSET`: keep the fixed-offset input parser, or converge input interpretation onto `TEMPLE_TIMEZONE` (which would also fix input-side DST, at larger scope).
- Whether user-facing event-time labels should carry an explicit zone abbreviation, given `src/views/streams/show.ejs` currently appends a literal "(UTC)".

### Sources / Research

- `src/views/calendar/index.ejs:4` — public calendar `timeFmt` hardcodes `timeZone: 'UTC'`; also `:51` (`data-datetime`) and `:58` (grid time).
- `src/views/admin/calendar/list.ejs:39` — admin table `toLocaleString` with no timezone (server-local); the observed multi-hour drift.
- `src/views/admin/calendar/archive.ejs:34` — archive reuses the bare-local pattern.
- `public/js/calendar-event-modal.js:32` — popup re-formats client-side with `timeZone: 'UTC'`.
- `src/server.js:115` and `src/controllers/homeController.js:22` — duplicate `formatEventDate` helpers, both bare-local.
- `src/services/emailTemplateService.js:5` and `:13` — reminder-email `formatEventDateTime`/`formatEventTime`, bare-local; fed by `src/workers/reminderWorker.js:97`.
- `src/controllers/calendarController.js:253` — JSON-LD `startDate` via `toISOString()`; `:271` — month label via `timeZone: 'UTC'`.
- `src/views/streams/show.ejs:13` and `src/views/admin/streaming/index.ejs:46` — stream start, UTC-labelled vs bare-local.
- `migrations/020_create_events_table.sql:12` (`starts_at TIMESTAMPTZ`), `migrations/015_create_scheduled_streams_table.sql` (`scheduled_start`) — confirm stored instants.
- `src/services/EventService.js:43` and `src/services/StreamingService.js:82`, `.env.example:21` — existing fixed-offset input handling (`APP_TIMEZONE_OFFSET`).
