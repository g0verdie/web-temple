# MVP Status & Next Steps — 2026-06-14

Handoff / "pick up later" snapshot. Captures where the project stands vs. the
Phase-1 MVP, what was just done, and the recommended next move.

## Snapshot

- **Branch:** `dev` (in sync with `origin/dev`). Default integration branch.
- **Tests:** 618 passing / 66 suites. **Lint:** clean.
- **Done epics:** 1 (Foundation), 2 (Auth/RBAC), 3 (Facebook Live + Archive), 4 (Live Chat).
- **Backlog epics:** 5 (Announcements), 6 (Calendar/Events), 7 (Messaging/Inbox), 8 (Donations), 9 (Admin dashboard — MVP subset only).
- **Progress to MVP:** ~45–50% (4/9 epics; ~35/76 stories; ~205h of the PRD's ~470h estimate). Hardest engineering (auth, encryption, backups, audit, email queue, WebSocket live chat, FB Live, archive) is shipped; what remains is mostly CRUD-plus-integration product surface — and the two biggest business pain points (donations = revenue; Rabbi admin = announcements/calendar/inbox) are still entirely in backlog.

## Working conventions (agreed 2026-06-14)

- Branch off `dev` per feature (`f/<name>`); never work directly on `dev`.
- Commit per task executed.
- When a feature is done: merge back into `dev` (`--no-ff`) **and push** the branch to its remote (push-after-merge is standing authorization).
- End commit messages with the `Co-Authored-By:` trailer. (See memory: `git-feature-branch-workflow`.)

## Recent work shipped to `dev`

1. **Epic 4 live chat** — implemented + adversarial review (15 confirmed findings); fixed the 2 HIGH WS-robustness issues (per-connection flood guard; upgrade-socket error/timeout → no process crash), the connection-cap TOCTOU, built the moderator Pause/Resume UI (Story 4.3 AC6 now MEET), +12 tests. Merge `4c1cfd8`.
2. **Launch verification pass** (`f/launch-verification`, merge `e2cf5d6`):
   - WS upgrade now enforces session revocation (jti blacklist + `token_version`), mirroring `requireAuth`.
   - Guest authors tagged with a `Guest` badge across all chat surfaces (anti-impersonation).
   - Automated real-WebSocket concurrency test: 65 concurrent upgrades admit exactly 50 (cap holds); broadcast fans out to 20 clients.
   - WCAG AA (axe) coverage for the live chat panel + moderation queue.

## Remaining MVP work — recommended build order

| # | Epic | Scope (stories) | Net est. | Why this order |
|---|------|-----------------|----------|----------------|
| 1 | **8 — Donations** | page w/ levels, one-time + recurring PayPal, anonymous, PDF tax receipts, donor dashboard, >$100 alert, failure handling (8) | ~40–45h | Revenue pain point + **riskiest external integration** → de-risk first. No dep on 5/6/7. Substrate ready: encrypted `donations` table (migration 004), stub `donationController`, `TREASURER`/`VIEW_DONATIONS` wired. |
| 2 | **5 — Announcements** | create/edit/delete, homepage display, email-all-members, prefs, pinned (7) | ~15–20h | Lowest-risk, highest-visibility Rabbi win; first real payload on the built email queue. `AnnouncementService` is an in-memory placeholder. |
| 3 | **6 — Calendar/Events** | public + members-only events, 3-mo display, new-event email, 24h iCal reminders (7) | ~15–20h | Fixes a **current correctness gap**: homepage "Upcoming Events" + next-service countdown render HARDCODED placeholder data because `EventService` create/update/delete are stubs. Reuses Epic 5's email pattern. |
| 4 | **7 — Messaging/Inbox** | contact form (≈done in Epic 1), member form, Rabbi unified inbox + replies, reply emails, spam, logging (7) | ~15h | Completes the announce/calendar/inbox triad. 7.1 largely pre-built — verify, don't rebuild. `messageController` only exports `submitMessage`; the inbox/reply tooling is the new work. |
| 5 | **9 — Admin (MVP subset only)** | 9.1 6-metric dashboard, 9.3 moderation queue (chat+messages), 9.4 banners, 9.5/9.6 content CMS + version history, 9.11 sliver (external uptime monitor + downtime page) | ~25–30h | Glue layer — build last; 9.1/9.3 only meaningful once 8/4/7 feed them. |

### Carve-outs (do NOT build for MVP)
- **Don't rebuild** (epic-9 redundant with done epic-1): 9.7 backups ≈ 1.7; 9.8 restore ≈ 1.7 AC; 9.9 security ≈ 1.2/1.6/2.4/2.5; 9.10 audit ≈ 1.8; most of 9.11 ≈ 1.9. Surface existing infra in the admin UI, don't re-implement.
- **Phase 2:** 9.2 advanced analytics; YouTube simultaneous streaming (PRD self-contradicts L160 vs L855 → Phase 2); SOCIAL_CHAIR role (and consider revoking the `MODERATE_CHAT` grant Epic 4 gave it); audio descriptions (FR76); merch, holiday-API, push notifications, member profiles, RSVP, native app, multi-language, forum, MFA, WCAG AAA.

## Launch criteria (PRD prd.md:892–915) — status

- ✅ **Chat 15+ concurrent** — evidence via automated real-WS concurrency test (cap holds at 50; 20-client fanout). A production load test on the actual box is still nice-to-have.
- ✅ **WCAG AA** — axe covers home/about/contact/recordings + (new) chat panel + moderation queue.
- ⏳ **<2s load (Lighthouse)** — NOT yet run here: `lhci` is installed/configured (`.lighthouserc.json` → `/`, `/about`, `/contact`, asserts perf/a11y/best-practices/SEO ≥0.9) but needs the running stack (Postgres+Redis) + headless Chrome. **Run `npm run test:performance` in the deploy env / CI.** (axe-in-jsdom can't check color contrast — Lighthouse is the authority.)
- ⛔ **Hard-blocked by backlog:** PayPal test donations (E8); Rabbi posts 3 announcements (E5); email <2min has a built pipe but no real payload yet (E5/6/7/8); first visitor reply (E7 inbox); donor thank-you (E8); "calendar populated" (E6, blocked by stub EventService).
- ⛔ **99.5% uptime** — needs the E9 sliver (external monitor — a single self-hosted box can't self-alert). Also reconcile the PRD inconsistency: NFR-R1 says 95% vs 99.5% in success criteria.

## Still-open deferred LOW items (Epic 4 review)
Recorded in `deferred-work.md`. Two were resolved in the verification pass (guest badge; WS revocation). Remaining: inline-style vs strict CSP in the new views; reconnect jitter + wire `closeAllConnections` to SIGTERM/SIGINT; dead `msg.role` moderator-badge branch; push the poll `since` filter into SQL (perf, fine at MVP scale).

## Recommended next move
**Start Epic 8 (Donations).** Branch `f/8.1` off `dev`, build story-by-story (8.1 page → 8.2 one-time → 8.3 recurring → 8.4 anonymous → 8.5 receipts → 8.6 dashboard → 8.7 alerts → 8.8 failure handling). Alternatively, a 1–2 day Epic 5 (Announcements) warm-up first. Separately, run the Lighthouse pass (`npm run test:performance`) in a real environment to close the `<2s load` criterion.
