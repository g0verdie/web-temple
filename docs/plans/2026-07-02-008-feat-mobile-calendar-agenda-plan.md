---
title: Mobile Calendar Agenda View - Plan
type: feat
date: 2026-07-02
topic: mobile-calendar-agenda-view
execution: code
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# Mobile Calendar Agenda View - Plan

## Goal Capsule

Objective: Below a small-screen breakpoint, replace the 7-column month grid with a chronological, date-grouped agenda list of the month's events, so a phone member can see every service (including both Saturday services) without hunting for an off-screen column. Keep the desktop grid exactly as-is.

Product authority: `docs/ideation/2026-07-01-full-project-review-ideation.html:282` (idea I4), verified against current `dev`.

Open blockers: Breakpoint value and the agenda's day-range are unresolved product calls (see Outstanding Questions — Resolve Before Planning).

## Product Contract

### Summary

The public calendar renders a single fixed-width month table (`.calendar-grid` has `min-width: 700px` and `table-layout: fixed`, `public/css/calendar.css:201`) with no media query that touches the grid. At 390px the table cannot reflow, so the right weekday columns sit off-screen by default. This plan adds a second, server-rendered EJS rendering — a date-grouped agenda list — shown only below a breakpoint via a CSS media query, driven from the same event data as the grid so the two cannot drift. Times route through the existing temple-timezone formatter, not a new bare `toLocale` call.

### Problem Frame

The I4 basis says the clipped columns have "no visible scroll affordance." Verified nuance: the grid wrapper does set `overflow-x: auto` (`public/css/calendar.css:197`), so the table is technically horizontally scrollable — but on a 390px viewport the Thu/Fri/Sat columns start off-screen with no visible scrollbar cue, so the two seeded Saturday services are not visible without a horizontal-scroll gesture the user has no reason to expect. The defect is discoverability and mobile fit, not a literal un-scrollable clip. The fix is the same either way: don't force a phone to hold a 700px table.

### Requirements

**Rendering switch**
R1. Below a small-screen breakpoint the page renders the agenda list; at or above it the page renders the month grid.
R2. The switch is a CSS media query toggling `display` on the two renderings; no JavaScript view-switcher, no framework, no inline `<style>`/`<script>`.
R3. Exactly one rendering is exposed at a time; the inactive one is `display: none` so it leaves the accessibility tree.
R4. The desktop month grid is visually and structurally unchanged above the breakpoint.

**Agenda content**
R5. Agenda items are ordered chronologically ascending by event date.
R6. Items are grouped by calendar day, each group introduced by a date heading.
R7. Each item shows the event time, title, and the same metadata the grid item carries (location, members badge, and the live-stream marker where present).
R8. The agenda and the grid are built from the same fetched event set so their contents cannot diverge.
R9. The agenda has its own empty state when the viewed window holds no events, mirroring the grid's "No events scheduled this month."

**Interaction parity**
R10. Agenda items open the same event popup as grid items by reusing the existing `.calendar-event-trigger` button + `#calendarEventModal` mechanism (`src/views/calendar/index.ejs:49`), ideally via one shared EJS partial used by both renderings so the trigger markup is authored once.

**Time formatting**
R11. All agenda dates and times render through `formatEventDate`/`formatEventTime` (the `utils/templeTime` locals wired in `src/server.js:128`); no bare `toLocaleString`/`toLocaleTimeString` is introduced.

### Acceptance Examples

AE1 (Covers R1, R5, R6, R7). At a 390px viewport with the July seed data, the page shows a vertical agenda: a Friday Kabbalat Shabbat and a Saturday morning service each appear in full, in date order, grouped under their day, with no horizontal scroll needed to read either.

AE2 (Covers R4). At a 1200px viewport the same month renders the existing 7-column grid unchanged, and the agenda list is not present in the accessibility tree.

AE3 (Covers R11). An event stored at a temple-local 6:00 PM renders as "6:00 PM" in the agenda in both CST and CDT dates, matching the grid cell and popup for the same event (no offset drift).

AE4 (Covers R9). At 390px in a month with no events, the agenda shows the empty-state message rather than a blank region.

### Success Criteria

Beyond the requirements: at 390px, every event in the viewed window is reachable without any horizontal scroll.

### Scope Boundaries

Out of scope: the admin calendar (create/edit/list/archive views), the month prev/next navigation behavior, the event data model, the schema.org JSON-LD, and the event fetch query itself (unless the day-range question below decides to change the window). No visual change to the desktop grid. No new client-side view-switching logic.

### Dependencies / Assumptions

Assumes the temple-timezone formatter (`src/utils/templeTime.js:42`) stays the single formatting path; the agenda reuses `formatEventDate`/`formatEventTime` already exposed as `app.locals` (`src/server.js:129`).

The controller currently passes only `weeks` (grid rows) and nav/label locals to the view — no flat chronological list (`src/controllers/calendarController.js:268`). Implementation will either add a chronological agenda list to `viewData` built from the same `events` array, or derive it in-template from `weeks`; the controller already fetches a month-scoped set (`src/controllers/calendarController.js:195`) and computes an `upcoming` split (`src/controllers/calendarController.js:203`) that can seed it.

Assumes CSP-clean delivery: all styling lives in `public/css/calendar.css`; no inline assets.

### Outstanding Questions

Resolve Before Planning:
- Breakpoint value: the idea suggests ~640–700px. The grid's `min-width` is exactly 700px (`public/css/calendar.css:203`), so overflow begins around 700px plus page padding; recommend switching to the agenda at 700px so the changeover lands at the actual overflow point, but 640px is the alternative on the table.
- How many days ahead the agenda shows: the grid is scoped to the whole viewed month (`src/controllers/calendarController.js:195`). Option A — agenda mirrors that same viewed-month window, keeping grid and agenda in sync and honoring prev/next nav. Option B — agenda is a rolling N-day-ahead window independent of the month, which decouples it from the grid and the month nav. A must be chosen unless a rolling window is explicitly wanted.
- Whether the agenda includes already-past events in the viewed month or upcoming-only (the controller already has the `upcoming` split available for either choice).

Deferred:
- Sticky date-group headers and a "jump to today" affordance.
- Multi-month / cross-month agenda grouping if a rolling window is ever adopted.

### Sources / Research

- `docs/ideation/2026-07-01-full-project-review-ideation.html:282` — idea I4 (mobile agenda vs clipped grid), including the verified-basis note.
- `public/css/calendar.css:201` — `.calendar-grid { min-width: 700px; table-layout: fixed }`.
- `public/css/calendar.css:197` — `.calendar-grid-wrap { overflow-x: auto }` (the "scroll" nuance in Problem Frame).
- `public/css/calendar.css:291` — media queries at 768px/480px touch only the form layout and page/admin headers, never `.calendar-grid` or its wrapper, so the grid keeps its 700px floor at 390px.
- `src/views/calendar/index.ejs:26` — the grid table markup; `:49` — the reusable `.calendar-event-trigger` button + popup pattern.
- `src/controllers/calendarController.js:195` — month-scoped event fetch; `:203` — upcoming/past split; `:219` — `weeks` grid build; `:268` — `viewData` (no flat agenda list today).
- `src/server.js:128` — temple-timezone formatter wired as `formatEventDate`/`formatEventTime` locals.
- `src/utils/templeTime.js:42` — `formatEventDateTime` (full) and `formatEventTime` (time-only) definitions.
