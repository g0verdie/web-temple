# July MVP — Execution Plan (locked 2026-06-14)

Supersedes the build-order recommendation in `mvp-status-and-next-steps-2026-06-14.md`
for the **owner-defined MVP scope** below. The status doc's assessment (epics 1–4 done,
618 tests, ~45–50% to PRD MVP) still stands as the baseline.

**Target:** functional replacement for florencetemple.org, owner-defined MVP, **by end of July 2026** (~6.5 weeks from today).

## Scope decision (why this differs from the PRD)

The owner's stated MVP and the BMad PRD's Phase-1 MVP had diverged:

- The PRD treats **member profiles / community portal as Phase 2** (`prd.md:169`). The owner
  considers a **member directory** a core MVP feature. → **Elevated to MVP.**
- The team built **Epic 4 (Live Chat)** — the hardest subsystem — which is in the PRD MVP
  but not in the owner's list. It stays (already shipped), but no further chat investment for MVP.
- The PRD MVP also carries **inbox (Epic 7)**, **full admin dashboard (Epic 9)**, and
  **YouTube simultaneous streaming**. → **Deferred to post-launch** for the July target.

**Locked MVP = owner's 5 features + a thin Rabbi dashboard:**

| # | Feature | Maps to | State today |
|---|---------|---------|-------------|
| A | Facebook Live streaming | Epic 3 | ✅ Done |
| B | **Member directory** (own info, opt-in search, auth-only) | *new (was Phase 2)* | ❌ Not built — unspecified |
| C | Rabbi announcement page | Epic 5 | ⬜ Service is in-memory placeholder |
| D | Donations (PayPal, recurring, anonymous, tax receipts, donor dashboard) | Epic 8 | ⬜ Persistence stub only; no PayPal/page |
| E | Event calendar | Epic 6 | ⬜ EventService stubbed; homepage shows hardcoded events |
| F | Rabbi dashboard (donation metrics + moderation queue glue) | Epic 9 subset | ⬜ Not built |

**Explicitly out for July:** unified inbox (Epic 7), full admin CMS/dashboard (Epic 9), YouTube streaming.

## Build order

1. **Member directory** (B) — START NOW. Unblocked, fully in our control, and the only
   unspecified feature → brainstorm first, then build, so early iteration pays off.
2. **Donations** (D) — riskiest external integration; **blocked on PayPal business credentials**
   from owner (gather in parallel with #1). Start once credentials are in hand.
3. **Announcements** (C) — low-risk, high-visibility Rabbi win; first real email-queue payload.
4. **Event calendar** (E) — also fixes the hardcoded-homepage-events correctness bug; reuses email pattern.
5. **Rabbi dashboard glue** (F) — build last; only meaningful once D + chat feed it.
6. **Launch readiness** — Lighthouse `<2s` pass in a real stack; reconcile PRD uptime inconsistency.

## Effort estimate (net dev)

- Member directory ~20–30h · Donations ~40–45h · Announcements ~15–20h · Calendar ~15–20h ·
  Rabbi dashboard ~20–25h · Launch pass ~small. **Total ~110–140h.** Feasible by end of July;
  donations is the schedule risk.

## Open dependency (owner action)

- **PayPal business account + API credentials** (client ID/secret, sandbox + live). Needed before
  donations (#2) can start. Also: confirm donation levels/tiers and whether tax receipts need
  specific 501(c)(3) language.

## Conventions (carried forward)

Branch off `dev` per feature (`f/<name>`); commit per task; on done, merge `--no-ff` into `dev`
**and push** (standing authorization); `Co-Authored-By:` trailer on commits.

## Status

- [x] Assessment + scope lock (this doc)
- [ ] (1) Member directory — brainstorm spec → build → merge  ← **in progress**
- [ ] (2) Donations (Epic 8)
- [ ] (3) Announcements (Epic 5)
- [ ] (4) Calendar (Epic 6)
- [ ] (5) Rabbi dashboard glue
- [ ] (6) Launch readiness pass
