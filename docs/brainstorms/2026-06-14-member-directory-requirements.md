---
date: 2026-06-14
topic: member-directory
---

# Member Directory — Requirements

## Summary

An authenticated-members-only directory for the temple site. Members fill out a
profile, opt in to be listed, and control which contact details are shown; other
logged-in members can browse the opted-in list and search it by name or interest.
Default is fully private — nobody appears unless they choose to, and the people
*named in* a profile are protected too.

---

## Problem Frame

The site replaces florencetemple.org, where members have no way to find or reach
each other online. The original PRD deferred "member profiles / community portal"
to Phase 2 (`_bmad-output/planning-artifacts/prd.md:169`), but the owner-defined
MVP elevates a member directory to a launch feature: a congregation's core value
is connection, and a self-service directory is the lightest way to deliver it.

Two constraints shape the design. First, privacy — members stay invisible by
default and decide exactly what they expose, and a profile must not expose people
who never consented. Second, the end-of-July deadline, which rules out heavier
sub-features like photo uploads and in-app messaging.

The directory's value is a network effect: it is only worth browsing if enough
members opt in. With opt-in private-by-default, the likeliest failure is not a bug
but a near-empty directory, so launch includes a deliberate invitation to opt in
(see R20) rather than relying on a buried setting. Planning should record the
assumed member base and the minimum participation that makes the directory useful.

---

## Key Decisions

- **Opt-in, private by default, with hide-switches for sensitive fields.** Members
  appear only after enabling a listing; phone, email, and household are each
  individually hideable. Chosen over all-or-nothing (too blunt) and full per-field
  control (too much UI for the MVP).
- **Visibility is enforced server-side, not at render.** Hidden fields and
  unlisted profiles are excluded from query results and response payloads, so a
  value a member chose to hide never reaches another member's browser.
- **Initials avatars only.** Locally-generated initials avatars avoid file storage
  and image moderation, and — unlike Gravatar — send no member identifier to a
  third party. Photo uploads remain deferred.
- **Browse plus search by name and interest**, both restricted to listed profiles
  and rate-limited to prevent bulk harvesting.
- **Contact via shown details, not in-app messaging.** Members connect through the
  phone/email a profile reveals; in-app messaging waits on the deferred inbox (Epic 7).
- **Admin sees all; members see only opted-in.** Rabbi/admin keep a full member
  view for pastoral and administrative needs, separate from the member-facing directory.
- **Interests are free-text, searched by substring match for the MVP.** A curated
  preset list is a possible later refinement if free-text proves noisy.

---

## Actors

- A1. Member — any authenticated congregant. Owns and edits their own profile,
  opts in/out, browses and searches the directory.
- A2. Listed member — a member who has opted in. Appears in browse and search
  results, exposing only the fields their visibility choices allow.
- A3. Rabbi / Admin — sees all members (opted in or not) in an admin context and
  can moderate profiles.

---

## Requirements

**Profile and self-service editing**

- R1. A member can create and edit their own profile fields: phone, family /
  household, a short "About me" bio, and committees / interests. First name, last
  name, and email continue to be edited through the existing account-settings page.
- R2. Each profile shows a locally-generated initials avatar derived from the
  member's name. No photo upload and no third-party avatar service (e.g., Gravatar)
  in this release — no member identifier is sent off-site for avatars.
- R3. Free-text fields (bio, household, interests) are length-limited and treated
  as untrusted input — escaped on render under the existing strict CSP. The
  profile-edit UI includes guidance discouraging members from entering information
  about people who have not consented (e.g., naming minors in the household field).
- R4. Interests are a free-text field, searched by case-insensitive substring
  match (`ILIKE`), consistent with the recordings-archive search. A curated
  interest vocabulary is deferred.

**Visibility and privacy**

- R5. The directory is opt-in and private by default: a member does not appear in
  the member-facing directory until they enable "List me in the directory."
- R6. When a member is listed, their name, avatar, bio, and interests are visible
  to authenticated members. Phone, email, and household are each hidden unless the
  member explicitly enables showing that field.
- R7. Visibility is enforced server-side: when a field's show-toggle is off, or a
  profile is not listed, that data is excluded from query results and response
  payloads sent to other members — not merely omitted from the rendered template.
- R8. Browse and search filter on the listed flag in the database query itself
  (not in presentation). Disabling a listing takes effect immediately: any cached
  directory pages are invalidated synchronously before the unlist request returns.
- R9. A member can leave the directory at any time by disabling the listing; their
  profile data is retained but is no longer visible to other members.
- R10. The opt-in listing and the per-field visibility toggles are profile-form
  fields saved together with the rest of the profile. Enabling the listing — a
  publicly-consequential action — requires explicit confirmation before the
  profile becomes visible.

**Browse, search, and contact**

- R11. An authenticated member can browse a paginated list of all listed profiles,
  mirroring the recordings-archive list and pagination pattern.
- R12. A member can search listed profiles by name and by committee / interest.
  Search never returns members who are not listed.
- R13. Browse and search are rate-limited per authenticated user (using the
  existing Redis infrastructure), and there is no unpaginated bulk export of the
  directory. (The reused recordings route has no rate limiting to inherit, so it
  must be added.)
- R14. From a profile, a member can reach another member only through the contact
  details that profile chose to show — phone as a `tel:` link, email as a `mailto:`
  link. There is no in-app messaging.

**Access and moderation**

- R15. The directory (browse, search, and profile views) is available only to
  authenticated users; unauthenticated visitors are redirected to login and see
  no directory data.
- R16. Rabbi/admin can view all members — including those not listed — in an admin
  context that is separate from the member-facing directory.
- R17. Rabbi/admin can moderate a profile — unlist it and clear offending
  free-text fields — through a standalone admin action that does not depend on the
  not-yet-built Rabbi dashboard; moderation actions are audit-logged via the
  existing audit service. When the Rabbi dashboard is built, it surfaces this
  action rather than introducing it.

**Experience and accessibility**

- R18. The directory specifies its non-happy-path states: profile-save feedback
  (in-progress, success, field-level validation error, server error), the
  empty-directory state (expected at launch), the search no-results state, and
  graceful rendering of sparse profiles (optional fields omitted, not shown blank).
- R19. All directory surfaces (profile edit, toggles, listing, search, pagination,
  profile view) meet WCAG 2.1 AA, consistent with the site's existing accessibility
  coverage; toggle controls expose programmatic state labels.
- R20. To avoid an empty directory at launch, members are invited to opt in at a
  deliberate moment — a one-time prompt during onboarding and/or a Rabbi nudge —
  not solely through a buried setting.

---

## Key Flows

- F1. Opt in and complete a profile
  - **Trigger:** A member opens their profile/account settings.
  - **Actors:** A1
  - **Steps:** Member fills phone, household, bio, interests → sets show-toggles
    for phone, email, and household → enables "List me in the directory" →
    confirms → saves.
  - **Outcome:** The member appears in browse and search, exposing only the fields
    their visibility choices allow.
  - **Covers:** R1, R3, R5, R6, R10

- F2. Find and contact another member
  - **Trigger:** A member opens the directory.
  - **Actors:** A1, A2
  - **Steps:** Member browses the listed profiles or searches by name/interest →
    opens a profile → uses a shown `tel:`/`mailto:` link to make contact.
  - **Outcome:** Contact happens outside the app via the details the profile owner
    chose to reveal.
  - **Covers:** R11, R12, R14

- F3. Leave the directory
  - **Trigger:** A listed member opens their profile settings.
  - **Actors:** A1
  - **Steps:** Member disables "List me in the directory" (with confirmation) →
    saves.
  - **Outcome:** The member is immediately removed from browse and search (caches
    invalidated); their profile data is retained and still editable by them.
  - **Covers:** R8, R9

---

## Acceptance Examples

- AE1. **Covers R5.** Member A has not opted in. Member B browses and searches the
  directory; A never appears in either.
- AE2. **Covers R6, R7.** Member A is listed with show-phone off, show-household
  off, and show-email on. Member B sees A's name, avatar, bio, interests, and a
  `mailto:` link — but no phone and no household appear on the profile, and neither
  value is present in the response payload B receives.
- AE3. **Covers R12.** Member B searches the interest "Youth Committee." Results
  include only listed members who list that interest; opted-out members with the
  same interest are excluded.
- AE4. **Covers R16.** The Rabbi opens the admin member view and sees member C, who
  has not opted in. Member D (a non-admin) never sees C anywhere in the directory.
- AE5. **Covers R8.** Member A is currently listed and appears on a browse page.
  A disables their listing; on the next request — including a page another member
  had cached — A no longer appears.

---

## Scope Boundaries

**Deferred for later**

- Photo uploads — initials avatars stand in for the MVP.
- In-app member-to-member messaging — waits on the deferred inbox (Epic 7).
- Per-field visibility beyond phone, email, and household.
- Structured household (spouse/children as discrete records) — free-text for now.
- A curated interest vocabulary — free-text for the MVP.

**Outside this release's scope**

- Collecting home/mailing addresses.
- Member self-service account deletion / data export — handled by general account
  features, not the directory.

---

## Dependencies / Assumptions

- Builds on the existing JWT auth, the account-settings page (`PUT /account/profile`
  in `src/controllers/`), and the `notification_preferences` JSONB pattern
  (`migrations/009_add_notification_preferences_to_users.sql`) as the model for the
  directory opt-in / visibility flags.
- Reuses the recordings-archive search and pagination pattern
  (`src/services/RecordingService.js` and its route/view) for browse and search,
  and adds per-user rate limiting (R13) since that route has none today.
- Moderation (R17) audit-logs through the existing audit service
  (`src/services/auditService.js`); a new audit action is added for directory
  moderation.
- **Phone and household are PII and must never be stored in plaintext.**
  Implementation must either encrypt them at rest (using
  `src/utils/encryptionHelper.js`) or store them in a role-filtered location not
  readable by the member role. Planning chooses the mechanism; the no-plaintext
  floor is fixed. Note: the encryption helper uses a per-value random IV
  (non-deterministic ciphertext), so any encrypted field must be kept out of
  search/filter SQL paths — which the directory's search (name + interest only)
  already respects.
- The `member` role currently has no RBAC permissions; member-facing directory
  access is gated by authentication. A dedicated permission for the admin
  view/moderation surface (R16/R17) is a planning decision.

---

## Outstanding Questions

**Deferred to planning**

- Storage shape: profile fields as new columns on `users`, a separate
  `member_profiles` table, or a JSONB blob.
- Which no-plaintext mechanism to use for phone/household — encryption-at-rest vs.
  a role-filtered store (the floor itself is fixed; see Dependencies).
- Field length limits for the free-text fields.
- Whether a member is notified when an admin moderates (unlists or clears) their
  profile.
