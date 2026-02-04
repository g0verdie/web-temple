---
stepsCompleted: 
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
validationStatus: "PASSED - Implementation Ready"
validationDate: "2026-02-04"
inputDocuments:
  - source: "Product Requirements Document"
    path: "prd.md"
    type: "prd"
  - source: "Architecture Decision Document"
    path: "architecture.md"
    type: "architecture"
  - source: "UX Design Specification"
    path: "ux-design-specification.md"
    type: "ux"
---

# Temple B'nai Israel Website Modernization - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Temple B'nai Israel Website Modernization, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Public visitors can view the homepage with temple mission statement, service times, and upcoming events
FR2: Public visitors can see the next upcoming service with a countdown timer
FR3: Members can view a public calendar of all temple services and events
FR4: Members can access a searchable archive of past service recordings organized by date
FR5: Members can filter recording archive by date range, Torah portion, or service type
FR6: Public visitors can view an "About the Temple" page with community values and welcome message
FR7: Public visitors can access a "Contact Us" page with messaging form
FR8: Authorized users can schedule and broadcast Facebook Live during services
FR9: Public visitors can view embedded Facebook Live stream directly on the website without login
FR10: The website displays stream status (live, upcoming, offline) with clear messaging
FR11: If Facebook Live stream becomes unavailable, visitors see graceful error message directing them to alternative
FR12: Rabbi can manually publish recorded services to the archive after livestream ends
FR13: Each recording displays service date, Rabbi, Torah portion (if applicable), and duration
FR14: Website visitors can post messages in live chat during active Facebook service broadcast (no account required)
FR15: Live chat displays messages in real-time with poster name and timestamp
FR16: Chat messages are moderated (approved by Rabbi/Ilya before appearing)
FR17: Moderators can delete inappropriate messages from chat history
FR18: Chat supports up to 20 concurrent users with <500ms message delivery
FR19: Chat persists during service (logs available after for member review)
FR20: If WebSocket connection fails, chat degrades to polling every 3 seconds. User sees "Slow connection mode" indicator but can still send and receive messages
FR21: Visitors can register as members via email + password on the website
FR22: Members can log in with email + password to access members-only content
FR23: Members can reset forgotten passwords via email link
FR24: Authorized users (Rabbi, Admin, Social Chair when added) can log in to admin interface
FR25: Admin role can see all metrics, messages, and content across the site
FR26: Rabbi role can post announcements, manage calendars, reply to messages, view donations
FR27: Social Chair role (Phase 2) can post announcements and manage public calendar only
FR28: Member sessions time out after 30 days of inactivity (security)
FR29: Rabbi can write and post announcements visible on homepage immediately
FR30: Announcements appear in chronological order (newest first) on homepage
FR31: Rabbi can edit published announcements after posting
FR32: Rabbi can delete announcements (removed from homepage, not from archive)
FR33: Announcement posts trigger automatic email to all members with "New Announcement" subject
FR34: Members can opt in/out of announcement emails
FR35: Announcements can include text, images, and links
FR36: Rabbi can create and edit public calendar events (service times, holidays, events)
FR37: Rabbi can create members-only calendar events (board meetings, private classes)
FR38: Public calendar is visible to all visitors (no login required)
FR39: Members-only calendar is only visible to logged-in members
FR40: Calendar events show date, time, title, and description
FR41: Calendar events can include a Zoom link or meeting location (optional)
FR42: Members receive email notification when new events added to calendar
FR43: Calendar displays next 3 months of events + past 1 month archive
FR44: Public visitors can submit a message via "Contact Us" form with CAPTCHA protection
FR45: Visitor messages are queued in Rabbi's inbox with visitor name and email
FR46: Rabbi can read and reply to visitor messages directly from admin dashboard
FR47: Visitor receives email reply when Rabbi responds to their message
FR48: Members can send messages to Rabbi/community through a member-only message form
FR49: All messages are logged with timestamps for accountability
FR50: Admin can view all messages (visitor + member) in unified inbox
FR51: Public visitors can see prominent "Donations" tab on main navigation
FR52: Donations page explains giving options and suggests donation levels ($18, $36, $100+)
FR53: Visitors can make one-time donations via PayPal (no account required)
FR54: Visitors can set up recurring monthly donations via PayPal
FR55: Donors can choose to give anonymously (no name/email tracking)
FR56: Donors receive automated tax receipt via email after donation (PDF with donation date)
FR57: Rabbi/Admin can view donation dashboard with total donated, donor count, recurring donors
FR58: Donation dashboard shows month-to-date and year-to-date totals
FR59: All donations are logged with date, amount, donor email (if not anonymous), recurring status
FR60: Rabbi receives email notification when major donation (>$100) is received
FR61: Admin dashboard displays 6 key metrics on load: new members (this month), total donations (this month), active live chat users (current), pending messages, system uptime (%, last 24h), and last backup timestamp
FR62: Admin can view analytics: page views, recording views, live chat users, donation trends
FR63: Admin can access moderation queue (pending messages, chat messages to approve)
FR64: Admin can set system-wide notifications (maintenance alerts, system status)
FR65: Admin can view audit logs of all sensitive actions (donations, admin edits, message deletions)
FR66: Admin dashboard is accessible from desktop and mobile browsers
FR67: Admin receives email alerts for critical issues (site down, PayPal error, spam detected)
FR68: All pages support keyboard navigation (Tab, Enter, arrow keys) without mouse
FR69: All images have descriptive alt text for screen readers
FR70: All service recordings have captions (burned-in or WebVTT subtitle files)
FR71: All interactive elements have visible focus indicators (3px outline visible on Tab)
FR72: Text can be resized up to 200% zoom without horizontal scrolling
FR73: Color contrast ratio meets 4.5:1 minimum (WCAG AA standard)
FR74: Form labels are explicitly associated with inputs for screen readers
FR75: Website has skip-to-main-content link for keyboard users
FR76: Videos include audio descriptions for visually impaired users (Phase 2 enhancement)
FR77: All pages render correctly on mobile phones (375px width and up)
FR78: All pages render correctly on tablets (768px width and up)
FR79: All pages render correctly on desktop (1200px width and up)
FR80: Touch targets (buttons, links) are minimum 44px for mobile accessibility
FR81: Navigation collapses to hamburger menu on mobile (<768px)
FR82: Videos and images scale responsively without distortion
FR83: Forms are touch-friendly (large input fields, mobile-optimized)
FR84: Members receive email when new service recording is published
FR85: Members receive email when Rabbi replies to their message
FR86: Members receive email when new announcements are posted
FR87: Members receive email reminders for calendar events 24 hours before event start time, including event title, time, location/Zoom link, and ical attachment
FR88: All emails include unsubscribe link (allow members to opt out per email type)
FR89: Donation thank-you emails are sent within 1 hour of donation
FR90: Tax receipts are included in donation confirmation emails
FR91: Rabbi/Admin can view and edit static pages (About, Contact, policies)
FR92: Static pages support rich text formatting (bold, italic, links, images)
FR93: Static pages can be published and unpublished without deletion
FR94: Admin can view previous versions of any static page (up to 10 most recent versions). Can restore any previous version with one click. Timestamp shows when each version was created
FR95: Pages are publicly visible once published, draft until published
FR96: The system performs automated daily backups to cloud storage
FR97: Database backups include all user data, messages, donations, settings
FR98: Backup restore can be tested without affecting live site
FR99: Rabbi/Admin can view last backup timestamp and status
FR100: All data is encrypted in transit via HTTPS/TLS
FR101: Database is encrypted at rest (AES-256)
FR102: Sensitive audit logs (donations, admin actions, messages) are stored securely
FR103: Password reset tokens expire after 24 hours
FR104: Admin sessions automatically log out after 30 minutes of inactivity
FR105: PayPal payment processing delegates PCI compliance to PayPal (no card data stored locally)
FR106: Contact forms include CAPTCHA to prevent spam submissions
FR107: Rabbi receives in-app guided onboarding tour when first logging in, covering announcement posting, calendar management, and message inbox
FR108: Members can access account settings page to manage notification preferences (announcements, calendars, messages) and update profile information
FR109: Live chat requires poster name (member can log in or anonymous visitor can enter name). Name displays with each message
FR110: After service ends, Rabbi can publish recording from admin dashboard. Once published, recording is immediately visible in archive to all members within 5 minutes
FR111: Rabbi can mark an announcement as "featured" to pin it to the top of the homepage for up to 30 days
FR112: If live chat disconnects, user sees "connection lost" indicator and can reconnect with one click. Unsent message is preserved in text field
FR113: System flags likely spam messages using simple heuristics (all caps, external links, repeated identical messages). Admin can auto-delete marked spam or review first
FR114: Recording archive search supports date range, keyword search (title/description), and service type filters. Results show thumbnail, date, and description
FR115: Tax receipts include donation date, amount, donor name (if not anonymous), confirmation of tax-deductible status per IRS guidelines, and temple EIN
FR116: Audit logs record: all announcements posted/edited/deleted (user, timestamp, before/after text), all calendar changes, all donation records, all admin logins, password changes, and user role changes
FR117: Website displays latest 52 weeks of recordings; older recordings available on request
FR118: If PayPal payment fails, user sees clear error message and can retry immediately. Failed payment attempt is logged for review. Repeat failures (3+) trigger admin alert

### NonFunctional Requirements

NFR-P1: Homepage must load primary content in <2 seconds (5G, Lighthouse)
NFR-P2: Live chat messages appear in <2 seconds end-to-end
NFR-P3: Recording archive filtering/search returns in <2 seconds; pagination <1 second
NFR-P4: Recording publish appears in archive within <5 minutes
NFR-P5: Admin operations complete in <1 second
NFR-P6: All pages FCP <3 seconds; admin dashboard <2 seconds
NFR-S1: TLS 1.2+ for all data in transit
NFR-S2: AES-256 encryption at rest for DB and backups
NFR-S3: Password policy: 12+ chars, complexity, no reuse (last 5)
NFR-S4: Sessions timeout after 30 minutes inactivity; secure cookies; MFA Phase 2
NFR-S5: PII minimization (no phone/address/SSN unless required)
NFR-S6: Donation data encrypted at rest with strict RBAC and audit logging
NFR-S7: CAPTCHA and server-side validation on public forms
NFR-S8: Admin access audit trail append-only
NFR-R1: 95% uptime target
NFR-R2: Facebook Live continues even if website down
NFR-R3: Graceful degradation across systems to avoid cascades
NFR-R4: Auto-restart after crash/power loss; graceful shutdown
NFR-R5: Downtime communication page with Facebook link
NFR-Sc1: Support 20 concurrent chat users; target 30–50; max 1000 before queue
NFR-Sc2: If >1000 chat users, display capacity message + queue overflow
NFR-Sc3: Support 200+ viewers during High Holy Days; website handles metadata only
NFR-Sc4: Do NOT store video files locally; store metadata only
NFR-Sc5: Database growth monitoring; local PostgreSQL sufficient for MVP
NFR-M1: Code quality standards and clear documentation
NFR-M2: Automated testing for critical paths; >60% coverage target
NFR-M3: Local logging/monitoring; 30-day online retention, 1-year archive
NFR-M4: Open-source preference; minimize dependencies; document rationale
NFR-M5: Operational documentation (runbook, troubleshooting, backup/restore, escalation)
NFR-M6: Succession planning with first-time setup guide
NFR-I1: PayPal failure handling with user-friendly errors, retry, admin alerts
NFR-I2: Email failures queued locally with exponential backoff and alerts
NFR-I3: Local message queue for notifications; retries and manual retry
NFR-I4: Facebook/YouTube streaming resilience with fallbacks and messages
NFR-I5: Phase 3 investigate self-hosted broadcast option
NFR-I6: External service SLAs standard acceptable (no premium)
NFR-A1: Full keyboard navigation
NFR-A2: Color contrast minimum 4.5:1 (AA)
NFR-A3: Screen reader compatibility with alt text and ARIA
NFR-A4: Captions for all service recordings
NFR-A5: 200% text zoom without horizontal scrolling
NFR-A6: Visible 3px focus indicators
NFR-A7: Mobile accessibility (44px targets, no hover-only)

### Additional Requirements

- Backend: Node.js/Express API-first monolith (MPA server-rendered)
- Database: PostgreSQL for persistent data, Redis for caching/queues
- Real-time: Socket.io with polling fallback for chat
- Authentication: In-house JWT + Bcrypt; RBAC with DB-stored permissions and delegations
- Deployment: Self-hosted Linux server on 5G internet, 95% uptime target
- Backups: Daily encrypted backups to S3; restore drills supported
- Payments: PayPal Checkout integration; no card data stored locally
- Email: Local queue with exponential backoff; alert on repeated failures
- Integrations: Circuit breaker for PayPal/Facebook/Email services
- Caching: Static content cached 24h; announcements 30m; chat 0 TTL
- Watch Live UX: Large CTA above fold; stream start in 2–3 seconds
- Chat UX: Hidden by default; toggle open; live status + viewer count visible
- Streaming resilience: Auto-reconnect, fallback messaging, bandwidth downgrade; audio-only fallback when needed
- Rabbi safety net: Auto-save every 30s, preview, confirm destructive actions, 5-second undo
- Donation UX: One-time/recurring toggle above fold; anonymous option; instant PDF receipt; backup payment methods
- Accessibility: User-controllable text size, 7:1 contrast for key areas, keyboard navigation, screen reader testing
- Responsive: Mobile-first 375px; CTA dominance above fold
- Design system: Tailwind CSS with temple brand tokens (navy + gold, serif headings, sans body)

## Epic List

### Epic 1: Project Foundation & Infrastructure Setup

Development environment ready, hosting operational, core services deployed for all future epics to build upon.

**FRs covered:** FR96, FR97, FR98, FR99, FR100, FR101, FR102, FR103, FR104  
**NFRs covered:** NFR-S1, NFR-S2, NFR-R4, NFR-M1, NFR-M3, NFR-M5  
**Additional requirements:** Node.js/Express setup, PostgreSQL + Redis, self-hosted Linux server, SSL/TLS (Let's Encrypt), AES-256 encryption at rest and in transit, daily cloud backups (S3), audit logging infrastructure, local monitoring, operational documentation (runbook, troubleshooting, backup/restore procedures)

### Epic 2: User Authentication & Access Control

Visitors can register, members can log in, admins access admin interface, role-based permissions enforced throughout the system.

**FRs covered:** FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28  
**NFRs covered:** NFR-S3, NFR-S4, NFR-S8  
**Additional requirements:** In-house JWT + Bcrypt authentication, RBAC with database-stored permissions matrix, role delegation support, session management (30-day member, 30-minute admin timeout), password reset flow, secure cookies (HTTPOnly, Secure flags), audit logging for all auth events

### Epic 3: Public Homepage & Static Content

Visitors see temple mission, service times, events; access About/Contact pages with full accessibility and mobile responsiveness.

**FRs covered:** FR1, FR2, FR6, FR7, FR68, FR69, FR71, FR72, FR73, FR74, FR75, FR77, FR78, FR79, FR80, FR81, FR82, FR83, FR91, FR92, FR93, FR94, FR95  
**NFRs covered:** NFR-P1, NFR-P6, NFR-A1, NFR-A2, NFR-A3, NFR-A5, NFR-A6, NFR-A7  
**Additional requirements:** Mobile-first responsive design (375px-1200px breakpoints), WCAG AA accessibility (4.5:1 contrast, keyboard nav, screen reader support), static page CMS with rich text editor, version control (10 versions), publish/unpublish workflow, Tailwind CSS design system with temple brand tokens

### Epic 4: Rabbi Announcement Management

Rabbi posts announcements with safety nets, members see them on homepage, email notifications sent automatically.

**FRs covered:** FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR86, FR88, FR107, FR111  
**NFRs covered:** NFR-P5, NFR-I2, NFR-I3  
**Additional requirements:** Draft auto-save (every 30 seconds), side-by-side preview before publish, confirmation dialogs for destructive actions, featured announcement pinning (30-day max), email queue with exponential backoff retry, Rabbi onboarding tour (announcement posting, calendar, inbox), mobile-friendly admin interface

### Epic 5: Public & Members-Only Calendar

Visitors see public events, members see private events, email reminders sent 24 hours before with iCal attachments.

**FRs covered:** FR3, FR36, FR37, FR38, FR39, FR40, FR41, FR42, FR43, FR87  
**NFRs covered:** NFR-P5  
**Additional requirements:** Dual calendar system (public/members-only), calendar filtering UI, iCal attachment generation, 24-hour email reminders with event details and Zoom links, next 3 months + past 1 month display, event CRUD operations

### Epic 6: Visitor & Member Messaging System

Visitors send messages via CAPTCHA-protected contact form, members message Rabbi, Rabbi replies from unified inbox with spam filtering.

**FRs covered:** FR44, FR45, FR46, FR47, FR48, FR49, FR50, FR85, FR106, FR113  
**NFRs covered:** NFR-S7  
**Additional requirements:** CAPTCHA protection (hCaptcha with audio fallback), spam filtering heuristics (all caps, external links, repeated messages), unified inbox (visitor + member messages), email notifications for replies, message audit logging with timestamps, admin review queue for flagged spam

### Epic 7: Facebook Live Streaming Integration

Authorized users broadcast Facebook Live, visitors watch embedded stream with status displays, bandwidth monitoring, and graceful error handling.

**FRs covered:** FR8, FR9, FR10, FR11, FR110  
**NFRs covered:** NFR-R2, NFR-Sc3, NFR-I4  
**Additional requirements:** Facebook API integration for stream control, embedded player (no login required), stream status monitoring (live/upcoming/offline), graceful error messaging with fallback to previous recording, bandwidth monitoring with auto-downgrade (1080p → 720p → 480p → audio-only), recording publication workflow from admin dashboard, visible within 5 minutes

### Epic 8: Service Recording Archive

Members search/filter past recordings with captions, recordings auto-publish with metadata, 52-week display with older recordings on request.

**FRs covered:** FR4, FR5, FR12, FR13, FR70, FR84, FR114, FR117  
**NFRs covered:** NFR-P3, NFR-P4, NFR-Sc4, NFR-A4  
**Additional requirements:** Metadata-only storage (no local video files), searchable by date/Torah portion/service type, thumbnail generation, caption support (WebVTT or burned-in), email notifications for new recordings, pagination (<1 second), 52-week rolling display, older recordings archived but available on request

### Epic 9: Live Chat During Services

Visitors post messages during live services with moderation, real-time delivery via WebSocket with polling fallback, rate limiting, and disconnect handling.

**FRs covered:** FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR109, FR112  
**NFRs covered:** NFR-P2, NFR-Sc1, NFR-Sc2  
**Additional requirements:** Socket.io with polling fallback (3-second interval), moderation queue (approve/reject before public display), rate limiting (1 message per 10 seconds), pause chat feature for sacred moments, 20 concurrent users (target 30-50, max 1000 with queue), disconnect handling (reconnect with one click, preserve unsent message), poster name required (member or anonymous)

### Epic 10: Donation System & PayPal Integration

Visitors donate (one-time/recurring) via PayPal, receive instant PDF tax receipts, errors handled gracefully with retry and backup payment options.

**FRs covered:** FR51, FR52, FR53, FR54, FR55, FR56, FR59, FR89, FR90, FR115, FR118  
**NFRs covered:** NFR-S5, NFR-I1, NFR-I6  
**Additional requirements:** PayPal Checkout integration (PCI compliance delegated), one-time and recurring donation support, anonymous giving option (donor_visible_to_treasurer flag), PDF tax receipt generation (donation date, amount, donor name if not anonymous, IRS confirmation, temple EIN), thank-you email within 1 hour, error handling with user-friendly messages and retry capability, failure logging with admin alerts after 3+ failures, backup payment options (Venmo/Zelle instructions)

### Epic 11: Admin Dashboard & Operations

Admin views key metrics, analytics, moderation queue, audit logs, donation dashboard; receives email alerts for critical issues.

**FRs covered:** FR57, FR58, FR60, FR61, FR62, FR63, FR64, FR65, FR66, FR67, FR116  
**NFRs covered:** NFR-P6, NFR-M2, NFR-M4, NFR-M6  
**Additional requirements:** 6 key metrics on dashboard load (new members this month, total donations this month, active chat users, pending messages, system uptime last 24h, last backup timestamp), donation dashboard (month-to-date and year-to-date totals, donor count, recurring donors), analytics (page views, recording views, chat users, donation trends), moderation queue interface, audit logs (announcements, calendar changes, donations, admin logins, role changes), system-wide notification management, email alerts for critical issues (site down, PayPal error, spam detected), mobile-accessible dashboard

### Epic 12: Member Account Settings & Preferences

Members manage notification preferences (announcements, calendars, messages), update profile, control email subscriptions with granular opt-in/opt-out.

**FRs covered:** FR34, FR88, FR108  
**Additional requirements:** Account settings page, notification preference management per type (announcements, calendar events, message replies, new recordings), profile information updates, unsubscribe links in all emails, preference persistence in database

### FR Coverage Map

| FR# | Epic | Description |
|-----|------|-------------|
| FR96 | Epic 1 | Automated daily backups to cloud storage |
| FR97 | Epic 1 | Database backups include all user data, messages, donations, settings |
| FR98 | Epic 1 | Backup restore testable without affecting live site |
| FR99 | Epic 1 | Rabbi/Admin view last backup timestamp and status |
| FR100 | Epic 1 | All data encrypted in transit via HTTPS/TLS |
| FR101 | Epic 1 | Database encrypted at rest (AES-256) |
| FR102 | Epic 1 | Sensitive audit logs stored securely |
| FR103 | Epic 1 | Password reset tokens expire after 24 hours |
| FR104 | Epic 1 | Admin sessions auto-logout after 30 minutes inactivity |
| FR21 | Epic 2 | Visitors register as members via email + password |
| FR22 | Epic 2 | Members log in with email + password |
| FR23 | Epic 2 | Members reset forgotten passwords via email |
| FR24 | Epic 2 | Authorized users log in to admin interface |
| FR25 | Epic 2 | Admin role sees all metrics, messages, content |
| FR26 | Epic 2 | Rabbi role posts announcements, manages calendars, replies to messages, views donations |
| FR27 | Epic 2 | Social Chair role (Phase 2) posts announcements, manages public calendar |
| FR28 | Epic 2 | Member sessions timeout after 30 days inactivity |
| FR1 | Epic 3 | Public visitors view homepage with mission, service times, events |
| FR2 | Epic 3 | Public visitors see next service with countdown timer |
| FR6 | Epic 3 | Public visitors view About page with values/welcome |
| FR7 | Epic 3 | Public visitors access Contact Us page |
| FR68 | Epic 3 | All pages support keyboard navigation |
| FR69 | Epic 3 | All images have descriptive alt text for screen readers |
| FR71 | Epic 3 | All interactive elements have visible focus indicators |
| FR72 | Epic 3 | Text resizable up to 200% zoom without horizontal scrolling |
| FR73 | Epic 3 | Color contrast ratio meets 4.5:1 minimum (WCAG AA) |
| FR74 | Epic 3 | Form labels explicitly associated with inputs for screen readers |
| FR75 | Epic 3 | Website has skip-to-main-content link for keyboard users |
| FR77 | Epic 3 | All pages render correctly on mobile phones (375px+) |
| FR78 | Epic 3 | All pages render correctly on tablets (768px+) |
| FR79 | Epic 3 | All pages render correctly on desktop (1200px+) |
| FR80 | Epic 3 | Touch targets minimum 44px for mobile accessibility |
| FR81 | Epic 3 | Navigation collapses to hamburger menu on mobile (<768px) |
| FR82 | Epic 3 | Videos and images scale responsively without distortion |
| FR83 | Epic 3 | Forms are touch-friendly (large inputs, mobile-optimized) |
| FR91 | Epic 3 | Rabbi/Admin view and edit static pages (About, Contact, policies) |
| FR92 | Epic 3 | Static pages support rich text formatting |
| FR93 | Epic 3 | Static pages published/unpublished without deletion |
| FR94 | Epic 3 | Admin views previous 10 versions of static pages, restores any version |
| FR95 | Epic 3 | Pages publicly visible once published, draft until published |
| FR29 | Epic 4 | Rabbi writes and posts announcements visible on homepage immediately |
| FR30 | Epic 4 | Announcements appear chronologically (newest first) on homepage |
| FR31 | Epic 4 | Rabbi edits published announcements after posting |
| FR32 | Epic 4 | Rabbi deletes announcements (removed from homepage, not archive) |
| FR33 | Epic 4 | Announcement posts trigger automatic email to all members |
| FR34 | Epic 4 | Members opt in/out of announcement emails |
| FR35 | Epic 4 | Announcements include text, images, links |
| FR86 | Epic 4 | Members receive email when new announcements posted |
| FR88 | Epic 4 | All emails include unsubscribe link |
| FR107 | Epic 4 | Rabbi receives in-app onboarding tour on first login |
| FR111 | Epic 4 | Rabbi marks announcement as "featured" to pin to homepage for 30 days |
| FR3 | Epic 5 | Members view public calendar of services/events |
| FR36 | Epic 5 | Rabbi creates and edits public calendar events |
| FR37 | Epic 5 | Rabbi creates members-only calendar events |
| FR38 | Epic 5 | Public calendar visible to all visitors |
| FR39 | Epic 5 | Members-only calendar visible only to logged-in members |
| FR40 | Epic 5 | Calendar events show date, time, title, description |
| FR41 | Epic 5 | Calendar events include Zoom link or meeting location (optional) |
| FR42 | Epic 5 | Members receive email notification when new events added |
| FR43 | Epic 5 | Calendar displays next 3 months + past 1 month archive |
| FR87 | Epic 5 | Members receive email reminders 24h before events with ical attachment |
| FR44 | Epic 6 | Public visitors submit message via Contact form with CAPTCHA |
| FR45 | Epic 6 | Visitor messages queued in Rabbi's inbox with name/email |
| FR46 | Epic 6 | Rabbi reads and replies to visitor messages from admin dashboard |
| FR47 | Epic 6 | Visitor receives email reply when Rabbi responds |
| FR48 | Epic 6 | Members send messages to Rabbi via member-only message form |
| FR49 | Epic 6 | All messages logged with timestamps for accountability |
| FR50 | Epic 6 | Admin views all messages (visitor + member) in unified inbox |
| FR85 | Epic 6 | Members receive email when Rabbi replies to their message |
| FR106 | Epic 6 | Contact forms include CAPTCHA to prevent spam |
| FR113 | Epic 6 | System flags spam messages using heuristics, admin reviews/auto-deletes |
| FR8 | Epic 7 | Authorized users schedule and broadcast Facebook Live |
| FR9 | Epic 7 | Public visitors view embedded Facebook Live without login |
| FR10 | Epic 7 | Website displays stream status (live/upcoming/offline) |
| FR11 | Epic 7 | Graceful error message if stream unavailable |
| FR110 | Epic 7 | Recording published from admin dashboard, visible within 5 minutes |
| FR4 | Epic 8 | Members access searchable archive by date |
| FR5 | Epic 8 | Members filter archive by date range, Torah portion, service type |
| FR12 | Epic 8 | Rabbi manually publishes recorded services to archive |
| FR13 | Epic 8 | Each recording displays date, Rabbi, Torah portion, duration |
| FR70 | Epic 8 | All service recordings have captions |
| FR84 | Epic 8 | Members receive email when new recording published |
| FR114 | Epic 8 | Archive search supports date/keyword/service type filters with thumbnails |
| FR117 | Epic 8 | Website displays latest 52 weeks of recordings |
| FR14 | Epic 9 | Visitors post messages in live chat during broadcast |
| FR15 | Epic 9 | Live chat displays messages real-time with name/timestamp |
| FR16 | Epic 9 | Chat messages moderated before appearing |
| FR17 | Epic 9 | Moderators delete inappropriate messages |
| FR18 | Epic 9 | Chat supports 20 concurrent users with <500ms delivery |
| FR19 | Epic 9 | Chat persists during service, logs available after |
| FR20 | Epic 9 | WebSocket failure degrades to polling with "Slow connection" indicator |
| FR109 | Epic 9 | Live chat requires poster name (member or anonymous) |
| FR112 | Epic 9 | Disconnected users see "connection lost" indicator, reconnect with one click |
| FR51 | Epic 10 | Public visitors see prominent "Donations" tab on navigation |
| FR52 | Epic 10 | Donations page explains giving options, suggests levels ($18, $36, $100+) |
| FR53 | Epic 10 | Visitors make one-time donations via PayPal (no account required) |
| FR54 | Epic 10 | Visitors set up recurring monthly donations via PayPal |
| FR55 | Epic 10 | Donors choose to give anonymously |
| FR56 | Epic 10 | Donors receive automated tax receipt via email after donation |
| FR59 | Epic 10 | All donations logged with date, amount, donor email, recurring status |
| FR89 | Epic 10 | Donation thank-you emails sent within 1 hour |
| FR90 | Epic 10 | Tax receipts included in donation confirmation emails |
| FR115 | Epic 10 | Tax receipts include date, amount, donor name, IRS confirmation, temple EIN |
| FR118 | Epic 10 | PayPal failures show clear error, retry immediately, log failures, alert after 3+ |
| FR57 | Epic 11 | Rabbi/Admin view donation dashboard with totals, donor count, recurring |
| FR58 | Epic 11 | Donation dashboard shows month-to-date and year-to-date totals |
| FR60 | Epic 11 | Rabbi receives email notification for major donations (>$100) |
| FR61 | Epic 11 | Admin dashboard displays 6 key metrics: new members, donations, chat users, messages, uptime, backup |
| FR62 | Epic 11 | Admin views analytics: page views, recording views, chat users, donation trends |
| FR63 | Epic 11 | Admin accesses moderation queue (pending messages, chat approvals) |
| FR64 | Epic 11 | Admin sets system-wide notifications (maintenance alerts, status) |
| FR65 | Epic 11 | Admin views audit logs of sensitive actions |
| FR66 | Epic 11 | Admin dashboard accessible from desktop and mobile browsers |
| FR67 | Epic 11 | Admin receives email alerts for critical issues (site down, PayPal error, spam) |
| FR116 | Epic 11 | Audit logs record all announcements, calendar changes, donations, logins, role changes |
| FR34 | Epic 12 | Members opt in/out of announcement emails |
| FR88 | Epic 12 | All emails include unsubscribe link |
| FR108 | Epic 12 | Members access account settings for notifications/profile |

**Note:** FR68-FR76 (accessibility requirements) and FR76 (Phase 2 audio descriptions) are cross-cutting concerns implemented within each epic's stories as acceptance criteria rather than separate stories.

<!-- Repeat for each epic in epics_list (N = 1, 2, 3...) -->

### Epic 1: Public Website & Content Discovery
Enable public visitors to discover the temple, view mission/values, and access basic information without requiring an account.

**FRs covered:** FR1, FR2, FR3, FR6, FR7, FR38, FR77-FR83  
**User outcome:** Anonymous visitors can learn about the temple, view upcoming services/events, and navigate the site on any device  
**Standalone:** Complete public-facing content foundation with responsive design

### Epic 2: Member Authentication & Account Management
Enable visitors to register as members and manage their accounts, establishing the authentication foundation for members-only features.

**FRs covered:** FR21-FR24, FR28, FR104, FR107, FR108  
**User outcome:** Users can create accounts, log in securely, manage preferences, and access members-only content  
**Standalone:** Complete auth system with RBAC, session management, and onboarding

### Epic 3: Facebook Live Streaming & Video Archive
Enable visitors to watch live services via Facebook Live embed and members to browse/search archived recordings.

**FRs covered:** FR4, FR5, FR8-FR13, FR84, FR110, FR114, FR117  
**User outcome:** Community can participate in live services remotely and access past recordings with search/filtering  
**Standalone:** Complete streaming + archive system with email notifications

### Epic 4: Live Chat During Services
Enable visitors to participate in moderated live chat during Facebook Live services with resilience features.

**FRs covered:** FR14-FR20, FR109, FR112  
**User outcome:** Real-time community connection during services with moderation and graceful degradation  
**Standalone:** Complete chat system with WebSocket + polling fallback

### Epic 5: Announcements & Member Communications
Enable Rabbi to post temple announcements with automatic email notifications to members.

**FRs covered:** FR29-FR35, FR86, FR88, FR111  
**User outcome:** Members stay informed about temple news with email notifications and opt-out controls  
**Standalone:** Complete announcement system with featured posts and email preferences

### Epic 6: Calendar Management & Event Notifications
Enable Rabbi to manage public/members-only calendars and send event reminders to members.

**FRs covered:** FR36, FR37, FR39-FR43, FR87  
**User outcome:** Community can view upcoming events and members receive reminders with calendar files  
**Standalone:** Complete calendar system with public/private events and email reminders

### Epic 7: Visitor & Member Messaging
Enable public visitors and members to send messages to Rabbi/admin with CAPTCHA protection and unified inbox.

**FRs covered:** FR44-FR50, FR85, FR106, FR113  
**User outcome:** Two-way communication between community and leadership with spam protection  
**Standalone:** Complete messaging system with unified inbox and automated replies

### Epic 8: Donations & Financial Transparency
Enable visitors to make one-time or recurring donations via PayPal with automated tax receipts and admin dashboard visibility.

**FRs covered:** FR51-FR60, FR89, FR90, FR115, FR118  
**User outcome:** Easy giving with immediate receipts, recurring options, and transparent reporting  
**Standalone:** Complete donation system with PayPal integration and tax receipts

### Epic 9: Admin Dashboard & Operations
Enable Rabbi/Admin to monitor site health, view analytics, manage content, and access audit logs for all sensitive operations.

**FRs covered:** FR61-FR67, FR91-FR99, FR100-FR105, FR116  
**User outcome:** Site administrators can operate, monitor, secure, and maintain the website  
**Standalone:** Complete admin tooling with metrics, backups, security, and audit trails

---

## Epic 1: Project Foundation & Infrastructure Setup

Development environment ready, hosting operational, core services deployed for all future epics to build upon.

### Story 1.1: Node.js/Express Application Setup

As a **developer**,
I want to set up the Node.js/Express application foundation with PostgreSQL and Redis,
So that all future features have a stable backend to build upon.

**Acceptance Criteria:**

**Given** I am setting up the development and production environments
**When** I initialize the Node.js project
**Then** Node.js v18+ and Express v4+ are installed and configured
**And** PostgreSQL database is installed and running locally
**And** Redis server is installed and configured for caching and queues
**And** Environment variables are configured via .env file (DB connection, Redis URL, JWT secret)
**And** Database migrations framework (e.g., node-pg-migrate) is configured
**And** API endpoints return JSON responses with proper error handling
**And** Server starts successfully on port 3000 (development) or configured port (production)
**And** Health check endpoint `/api/health` returns server status
**And** All configuration follows NFR-M1 (code quality standards, clear documentation)

### Story 1.2: SSL/TLS Security Configuration

As a **system administrator**,
I want all data encrypted in transit via HTTPS/TLS,
So that sensitive information (passwords, donations, messages) is protected from interception.

**Acceptance Criteria:**

**Given** I am configuring the production server
**When** I deploy the application to the self-hosted Linux server
**Then** SSL/TLS certificates are obtained from Let's Encrypt (NFR-S1)
**And** TLS 1.2 or higher is enforced for all connections (NFR-S1)
**And** HTTP traffic automatically redirects to HTTPS
**And** Certificates auto-renew via certbot cron job
**And** HSTS header is set with max-age=31536000 (1 year)
**And** All API endpoints require HTTPS in production
**And** Mixed content warnings are resolved (all assets served via HTTPS)
**And** SSL Labs test scores A or higher

### Story 1.3: Database Encryption at Rest

As a **system administrator**,
I want the database and backups encrypted at rest with AES-256,
So that sensitive data (passwords, donations, PII) is protected if storage is compromised.

**Acceptance Criteria:**

**Given** I am configuring the PostgreSQL database
**When** I enable encryption at rest
**Then** PostgreSQL data directory is encrypted with AES-256 (NFR-S2)
**And** Encryption keys are stored separately from data (key management strategy documented)
**And** Backup files are encrypted before upload to S3 (NFR-S2)
**And** Sensitive columns (passwords) use Bcrypt hashing with salt (NFR-S3)
**And** Donation data is encrypted at rest with strict RBAC (NFR-S6)
**And** Audit logs are encrypted and append-only (NFR-S8)
**And** Encryption performance overhead is <5% (acceptable for self-hosted)
**And** Decryption process is documented for disaster recovery

### Story 1.4: Automated Daily Backups

As a **system administrator**,
I want automated daily backups to cloud storage with restore testing capability,
So that the temple's data is protected and recoverable in case of failure.

**Acceptance Criteria:**

**Given** I am configuring backup infrastructure
**When** The daily backup cron job runs at 2:00 AM EST
**Then** Full PostgreSQL database dump is created with pg_dump (FR96, FR97)
**And** Backup includes all user data, messages, donations, settings (FR97)
**And** Backup file is encrypted with AES-256 before upload (NFR-S2)
**And** Encrypted backup is uploaded to AWS S3 with versioning enabled
**And** Backup retention policy keeps last 30 daily backups + last 12 monthly backups
**And** Backup success/failure is logged locally (NFR-M3)
**And** Last backup timestamp and status are visible on admin dashboard (FR99)
**And** Backup restore can be tested on staging environment without affecting live site (FR98)
**And** Restore procedure is documented in operational runbook (NFR-M5)
**And** Failed backups trigger email alert to admin (FR67)

### Story 1.5: Audit Logging Infrastructure

As a **developer**,
I want comprehensive audit logging for all sensitive actions,
So that security events and admin actions are traceable for accountability and compliance.

**Acceptance Criteria:**

**Given** The application is running in production
**When** Any sensitive action occurs
**Then** Audit logs record all announcements posted/edited/deleted with user, timestamp, before/after text (FR116)
**And** Audit logs record all calendar changes (created/edited/deleted events) (FR116)
**And** Audit logs record all donation records (amount, donor, timestamp) (FR116)
**And** Audit logs record all admin logins and logout events (FR116)
**And** Audit logs record password changes and role changes (FR116)
**And** Audit logs are stored in append-only table (no delete/update permissions) (NFR-S8)
**And** Audit logs are encrypted at rest (NFR-S2)
**And** Admin can view audit logs from admin dashboard with filtering by date/user/action type (FR65)
**And** Audit logs are retained for 1 year minimum (NFR-M3)
**And** Sensitive audit logs (donations, admin actions, messages) are stored securely (FR102)

### Story 1.6: Local Logging & Monitoring

As a **system administrator**,
I want local logging and monitoring with 30-day online retention,
So that I can troubleshoot issues and monitor system health.

**Acceptance Criteria:**

**Given** The application is running in production
**When** Events occur (requests, errors, warnings, info)
**Then** Logs are written to local files in /var/log/temple-app/ directory (NFR-M3)
**And** Log rotation is configured (daily rotation, compress after 1 day)
**And** Online logs are retained for 30 days before archiving (NFR-M3)
**And** Archived logs are compressed and retained for 1 year (NFR-M3)
**And** Logs include: timestamp, severity level (ERROR/WARN/INFO/DEBUG), message, request ID
**And** Application errors are logged with stack traces
**And** API requests are logged with method, path, status code, response time
**And** System metrics (CPU, memory, disk usage) are logged every 5 minutes
**And** Logs are readable with `tail -f` for real-time monitoring
**And** Log format is consistent and parseable for future analysis tools

### Story 1.7: Operational Documentation & Runbook

As a **successor developer or system administrator**,
I want comprehensive operational documentation and troubleshooting guides,
So that I can maintain and troubleshoot the system without prior knowledge.

**Acceptance Criteria:**

**Given** The system is deployed and operational
**When** Documentation is reviewed
**Then** Operational runbook includes: server access procedures, deployment steps, backup/restore procedures (NFR-M5)
**And** Troubleshooting guide includes common failure scenarios with resolution steps (NFR-M5):
  - PayPal API down → Check circuit breaker status, display donation page with Venmo/Zelle fallback
  - Facebook stream fails → Verify API credentials, check stream status endpoint, display error message to users
  - Email queue backlog → Check SMTP connection, review failed emails in queue table, manual retry if needed
  - Database connection errors → Verify PostgreSQL service status, check connection pool limits
  - Redis connection failures → Verify Redis service, check memory usage, restart if needed
**And** First-time setup guide enables successor to deploy from scratch within 4 hours (NFR-M6):
  - Server provisioning checklist
  - PostgreSQL and Redis installation steps
  - SSL certificate setup with Let's Encrypt
  - Environment variable configuration template
  - Initial database migration and seed data
  - Testing checklist before going live
**And** Escalation procedures document who to contact for issues (Rabbi, Ilya, hosting provider)
**And** All documentation is in Markdown format in `/docs` directory
**And** Documentation includes version/last updated date
**And** Architecture diagrams (system overview, database schema) are included

### Story 1.8: WCAG AA Compliance Validation

As a **developer**,
I want automated accessibility testing to validate WCAG AA compliance,
So that all users including those with disabilities can use the website.

**Acceptance Criteria:**

**Given** All public pages and key admin pages are developed
**When** Accessibility testing is performed
**Then** axe DevTools automated scan runs on all pages and shows zero Level A and AA violations
**And** Color contrast meets minimum 4.5:1 ratio for all text (NFR-A2)
**And** All interactive elements show visible 3px focus indicator on keyboard focus (NFR-A6)
**And** All form inputs have explicitly associated labels (FR74)
**And** All images have descriptive alt text (FR69)
**And** Skip-to-main-content link is present and functional (FR75)
**And** All pages support 200% text zoom without horizontal scrolling (FR72, NFR-A5)
**And** Keyboard navigation works for all interactive elements (Tab, Enter, Escape, arrow keys) (FR68, NFR-A1)
**And** Touch targets are minimum 44x44px on mobile (FR80, NFR-A7)
**And** WAVE accessibility checker shows no critical errors
**And** Manual screen reader testing (NVDA or VoiceOver) confirms all content is accessible
**And** Accessibility testing is documented with pass/fail results and remediation notes

### Story 1.9: Performance Benchmarking & Optimization

As a **developer**,
I want to measure and optimize performance against NFR targets,
So that the website loads quickly and provides a responsive user experience.

**Acceptance Criteria:**

**Given** All major features are implemented
**When** Performance testing is conducted
**Then** Homepage loads primary content in <2 seconds on 5G connection (NFR-P1)
**And** Lighthouse performance score is >90 for all public pages
**And** First Contentful Paint (FCP) is <3 seconds for all pages (NFR-P6)
**And** Admin dashboard loads in <2 seconds (NFR-P6)
**And** API endpoint response times are <500ms for standard operations (NFR-P2)
**And** Live chat messages deliver in <500ms end-to-end (NFR-P2)
**And** Recording archive search returns results in <2 seconds (NFR-P3)
**And** Database queries use proper indexes (verified with EXPLAIN ANALYZE)
**And** Images are optimized (WebP format, responsive sizes, lazy loading)
**And** JavaScript bundles are code-split and minified
**And** CSS is minimized and critical CSS is inlined
**And** Performance testing is conducted with Chrome DevTools and Lighthouse CI
**And** Optimization techniques are documented for future reference

### Story 1.10: Redis Caching Infrastructure

As a **developer**,
I want Redis caching for frequently accessed data,
So that database load is reduced and page performance improves.

**Acceptance Criteria:**

**Given** Redis is installed and running
**When** Caching is implemented for key features
**Then** Recording archive queries are cached with 15-minute TTL
**And** Calendar events are cached with 5-minute TTL
**And** Announcements on homepage are cached with 2-minute TTL
**And** Public page static content is cached with 10-minute TTL
**And** Cache is invalidated immediately when content is updated (announcements posted/edited, calendar events changed, recordings published)
**And** Cache keys follow consistent naming convention (e.g., `cache:recordings:all`, `cache:calendar:2026-02`)
**And** Cache hit rate is >70% for cached endpoints (monitored in logs)
**And** Redis memory limit is configured (max 512MB for self-hosted server)
**And** Redis persistence (RDB snapshots every 15 minutes) is enabled
**And** Cache failures degrade gracefully (fetch from database if Redis unavailable)
**And** Cache performance improvement is measurable (compare with/without caching)

### Story 1.11: Automated Test Infrastructure

As a **developer**,
I want automated testing with 60% code coverage,
So that critical functionality is protected from regressions and bugs are caught early.

**Acceptance Criteria:**

**Given** The application codebase is developed
**When** Tests are written and executed
**Then** Jest testing framework is installed and configured
**And** Unit tests cover critical backend logic (authentication, authorization, password hashing, token generation)
**And** Integration tests cover API endpoints for key features (login, donation, messaging, announcements)
**And** Test coverage reaches 60% minimum (NFR-M2)
**And** Critical paths are fully tested:
  - User registration and login flow
  - Password reset flow
  - Donation processing (PayPal integration mocked)
  - Announcement creation and email notification
  - Message submission and Rabbi reply
**And** Tests run automatically before each deployment (CI/CD integration)
**And** Test failures block deployment to production
**And** Test results are logged and visible in CI/CD pipeline
**And** Mock data and fixtures are provided for repeatable testing
**And** Testing documentation explains how to run tests and add new tests

### Story 1.12: Email Queue Infrastructure

As a **developer**,
I want a reliable email queue with retry logic and admin monitoring,
So that email notifications are delivered even when the email service is temporarily unavailable.

**Acceptance Criteria:**

**Given** Email notifications are required for multiple features
**When** An email needs to be sent
**Then** Email jobs are queued in PostgreSQL (email_queue table with status, retries, error_message columns)
**And** Background worker processes email queue every 30 seconds
**And** Failed emails use exponential backoff retry logic: 1 min, 5 min, 15 min, 1 hour, 6 hours (NFR-I2)
**And** After 5 failed attempts, email is marked as permanently failed
**And** Admin can view failed emails in admin dashboard with manual retry button (NFR-I3)
**And** Admin receives email alert after 3 consecutive email delivery failures for any recipient
**And** Email queue supports priority levels (high: password reset, medium: announcements, low: weekly digest)
**And** Email templates are stored as reusable components (welcome email, password reset, donation receipt, announcement notification)
**And** Emails include unsubscribe link with member preference token (FR88)
**And** Email delivery status is logged (sent, failed, bounced)
**And** SMTP connection pooling prevents connection exhaustion
**And** Email queue performance is monitored (average delivery time, queue depth)

---

## Epic 2: Public Website & Content Discovery

Enable public visitors to discover the temple, view mission/values, and access basic information without requiring an account.

### Story 2.1: Homepage with Temple Mission & Upcoming Services

As a **public visitor**,
I want to view the temple's homepage with the mission statement, service times, and upcoming events with a countdown to the next service,
So that I can quickly understand the temple's values and know when to join the community for worship.

**Acceptance Criteria:**

**Given** I am a public visitor on any device
**When** I navigate to the temple website homepage
**Then** I see the temple mission statement displayed prominently above the fold
**And** I see the next upcoming service with a real-time countdown timer (days, hours, minutes)
**And** I see a list of the next 3 upcoming events with dates and titles
**And** The page loads in under 2 seconds on 5G connection (NFR-P1)
**And** All interactive elements have 3px focus indicators for keyboard navigation (NFR-A6)
**And** All images have descriptive alt text for screen readers (NFR-A3)
**And** Color contrast meets 4.5:1 minimum ratio (NFR-A2)

### Story 2.2: Public Calendar View

As a **public visitor or member**,
I want to view a public calendar displaying all temple services and events,
So that I can plan my participation in temple activities.

**Acceptance Criteria:**

**Given** I am on the temple website
**When** I navigate to the calendar page
**Then** I see a calendar displaying the next 3 months of events plus the past 1 month archive (FR43)
**And** Each event shows date, time, title, and description (FR40)
**And** Events can include optional Zoom links or location information (FR41)
**And** The calendar is accessible without requiring login (FR38)
**And** I can navigate between months using prev/next buttons
**And** All controls are keyboard accessible with Tab/Enter navigation (NFR-A1)
**And** The calendar loads in under 2 seconds (NFR-P1)
**And** The page is fully responsive on mobile (375px+), tablet (768px+), and desktop (1200px+) devices (FR77-79)

### Story 2.3: About the Temple Page

As a **public visitor**,
I want to view an "About the Temple" page with the community's values and welcome message,
So that I can learn about the temple's history, beliefs, and community culture before deciding to engage.

**Acceptance Criteria:**

**Given** I am a public visitor
**When** I navigate to the About page from the main navigation
**Then** I see a welcome message introducing the temple community (FR6)
**And** I see the temple's core values and mission prominently displayed
**And** I see information about the Rabbi and community leadership
**And** All text is readable with 4.5:1 contrast ratio (NFR-A2)
**And** The page supports text zoom up to 200% without horizontal scrolling (NFR-A5)
**And** All images have descriptive alt text (NFR-A3)
**And** The page is fully responsive on mobile, tablet, and desktop (FR77-79)
**And** The page loads in under 2 seconds (NFR-P1)

### Story 2.4: Contact Us Page

As a **public visitor**,
I want to access a "Contact Us" page with the temple's contact information,
So that I can find ways to reach out to the temple community.

**Acceptance Criteria:**

**Given** I am a public visitor
**When** I navigate to the Contact Us page
**Then** I see the temple's email address, phone number, and physical address (FR7)
**And** I see a placeholder for the contact form (form functionality will be implemented in Epic 7)
**And** All contact information is keyboard accessible and screen reader compatible (NFR-A1, NFR-A3)
**And** The page is fully responsive on all device sizes (FR77-79)
**And** Touch targets are minimum 44px for mobile accessibility (FR80)
**And** The page loads in under 2 seconds (NFR-P1)

### Story 2.5: Mobile Responsive Design Foundation

As a **website visitor on any device**,
I want all public pages to render correctly and be touch-friendly,
So that I can access temple information from my phone, tablet, or desktop seamlessly.

**Acceptance Criteria:**

**Given** I am visiting the website on any device
**When** I view the homepage, calendar, about page, or contact page
**Then** All pages render correctly on mobile phones (375px width and up) (FR77)
**And** All pages render correctly on tablets (768px width and up) (FR78)
**And** All pages render correctly on desktop (1200px width and up) (FR79)
**And** Touch targets (buttons, links) are minimum 44px for mobile accessibility (FR80)
**And** Navigation collapses to hamburger menu on mobile (<768px) (FR81)
**And** Images and embedded content scale responsively without distortion (FR82)
**And** Forms are touch-friendly with large input fields when applicable (FR83)
**And** The skip-to-main-content link is available for keyboard users (FR75)

---

## Epic 3: Member Authentication & Account Management

Enable visitors to register as members and manage their accounts, establishing the authentication foundation for members-only features.

### Story 2.1: User Registration

As a **public visitor**,
I want to register as a member using my email and password,
So that I can access members-only content and receive temple communications.

**Acceptance Criteria:**

**Given** I am an unregistered visitor on the registration page
**When** I submit the registration form with email and password
**Then** My account is created in the database with encrypted password (NFR-S3)
**And** My password must be at least 12 characters with complexity requirements (NFR-S3)
**And** I receive a confirmation email welcoming me as a member
**And** I am automatically logged in after successful registration
**And** My session is created with JWT token stored in secure HTTP-only cookie
**And** Form validation provides clear error messages for invalid inputs
**And** The form is keyboard accessible and screen reader compatible (NFR-A1, NFR-A3)
**And** Touch targets are minimum 44px on mobile devices (FR80)

### Story 2.2: User Login

As a **registered member**,
I want to log in with my email and password,
So that I can access members-only features and personalized content.

**Acceptance Criteria:**

**Given** I am a registered member on the login page
**When** I submit valid email and password credentials
**Then** My credentials are verified against the encrypted database password
**And** A secure session is created with JWT token in HTTP-only cookie
**And** I am redirected to the homepage or my intended destination
**And** My login timestamp is recorded in the database
**And** If credentials are invalid, I see a clear error message without revealing which field is incorrect (security)
**And** After 5 failed login attempts, my account is temporarily locked for 15 minutes
**And** The login form is fully accessible with keyboard navigation (NFR-A1)
**And** The page loads in under 2 seconds (NFR-P1)

### Story 2.3: Password Reset

As a **registered member who forgot their password**,
I want to reset my password via email link,
So that I can regain access to my account securely.

**Acceptance Criteria:**

**Given** I am on the password reset request page
**When** I submit my email address
**Then** If the email exists in the system, a password reset email is sent with a unique token link
**And** The reset token expires after 24 hours (FR103)
**And** If the email doesn't exist, I see the same success message (security - don't reveal account existence)
**And** When I click the reset link and submit a new password, it must meet password policy requirements (NFR-S3)
**And** The new password cannot be one of my last 5 passwords (NFR-S3)
**And** After successful reset, my old session tokens are invalidated
**And** I receive a confirmation email that my password was changed
**And** The reset form is keyboard accessible (NFR-A1)

### Story 2.4: Admin Authentication & RBAC

As an **authorized admin user (Rabbi or Admin)**,
I want to log in with role-based access permissions,
So that I can access administrative features appropriate to my role.

**Acceptance Criteria:**

**Given** I am a user with an assigned role (Rabbi, Admin, or future Social Chair)
**When** I log in successfully
**Then** My role and permissions are loaded from the database into my session
**And** Admin role can access all metrics, messages, and content (FR25)
**And** Rabbi role can post announcements, manage calendars, reply to messages, view donations (FR26)
**And** Social Chair role (Phase 2) can post announcements and manage public calendar only (FR27)
**And** My admin login is recorded in the audit log with timestamp (NFR-S8)
**And** Admin sessions automatically log out after 30 minutes of inactivity (FR104)
**And** Each admin action checks role permissions before execution
**And** Unauthorized access attempts are logged and display "Access Denied" message

### Story 2.5: Session Management & Timeouts

As a **logged-in member or admin**,
I want my session to be managed securely with appropriate timeouts,
So that my account remains protected when I'm inactive.

**Acceptance Criteria:**

**Given** I am logged in as a member or admin
**When** I remain inactive for the timeout period
**Then** Member sessions time out after 30 days of inactivity (FR28)
**And** Admin sessions time out after 30 minutes of inactivity (FR104)
**And** Upon timeout, I am redirected to the login page with a "Session expired" message
**And** My session token is invalidated in the database
**And** Any unsaved form data shows a warning before timeout (1 minute warning)
**And** Session activity is tracked on each page load and API request
**And** Session tokens are stored in secure HTTP-only cookies with SameSite=Strict
**And** All session data is encrypted in transit via TLS (NFR-S1)

### Story 2.6: Rabbi Onboarding Tour

As the **Rabbi logging in for the first time**,
I want to see a guided onboarding tour,
So that I can quickly learn how to use the admin features.

**Acceptance Criteria:**

**Given** I am the Rabbi logging in for the first time (onboarding flag = false in database)
**When** I successfully log in and reach the admin dashboard
**Then** I see a step-by-step guided tour highlighting key features (FR107)
**And** The tour covers announcement posting, calendar management, and message inbox
**And** I can skip the tour or complete it at my own pace
**And** I can navigate prev/next through tour steps
**And** After completing or skipping the tour, my onboarding flag is set to true
**And** I can re-access the tour from the Help menu at any time
**And** The tour overlay is keyboard accessible with Esc to close (NFR-A1)

### Story 2.7: Account Settings & Preferences

As a **logged-in member**,
I want to access my account settings to manage notification preferences and profile information,
So that I can control how the temple communicates with me and keep my information current.

**Acceptance Criteria:**

**Given** I am a logged-in member
**When** I navigate to my account settings page
**Then** I can update my profile information (name, email)
**And** I can manage notification preferences for announcements, calendar events, and messages (FR108)
**And** I can opt in/out of each email type independently (FR34, FR88)
**And** I can change my password (requires current password for verification)
**And** All changes are saved to the database immediately
**And** I see a success confirmation message after saving
**And** Email changes require verification via confirmation link
**And** The settings page is fully responsive on all devices (FR77-79)
**And** All controls are keyboard accessible (NFR-A1)

---

## Epic 3: Facebook Live Streaming & Video Archive

Enable visitors to watch live services via Facebook Live embed and members to browse/search archived recordings.

### Story 3.1: Facebook Live Stream Embed

As a **public visitor**,
I want to watch the live service embedded directly on the temple website,
So that I can participate in worship without leaving the site or having a Facebook account.

**Acceptance Criteria:**

**Given** I am on the homepage during a scheduled live service
**When** The Rabbi has started the Facebook Live broadcast
**Then** I see the Facebook Live video player embedded on the page (FR9)
**And** The video starts playing automatically or with one click (no Facebook login required) (FR9)
**And** The embedded player is responsive and scales correctly on mobile, tablet, and desktop (FR77-79)
**And** The stream starts playing within 2-3 seconds of page load
**And** I can control volume, fullscreen, and playback without leaving the page
**And** The video player is keyboard accessible (space to pause, arrows for volume) (NFR-A1)
**And** The page supports 200+ concurrent viewers without performance degradation (NFR-Sc3)
**And** Only stream metadata is stored locally, no video files (NFR-Sc4)

### Story 3.2: Stream Status Display & Error Handling

As a **website visitor**,
I want to see the current stream status clearly,
So that I know whether a service is live, upcoming, or offline.

**Acceptance Criteria:**

**Given** I am on the homepage
**When** I view the live stream section
**Then** I see a clear status indicator: "LIVE NOW", "Starting in [countdown]", or "Offline" (FR10)
**And** If the stream is upcoming, I see a countdown timer to the scheduled start time
**And** If the Facebook Live stream becomes unavailable during service, I see a graceful error message (FR11)
**And** The error message directs me to the Facebook page as an alternative viewing option (FR11)
**And** If the stream is offline, I see a message inviting me to view past recordings
**And** The status updates automatically every 30 seconds without requiring page refresh
**And** All status messages are screen reader accessible (NFR-A3)
**And** The status indicator has sufficient color contrast (4.5:1 minimum) (NFR-A2)

### Story 3.3: Rabbi Publishes Recording to Archive

As the **Rabbi**,
I want to manually publish recorded services to the archive after the livestream ends,
So that members can watch past services on-demand.

**Acceptance Criteria:**

**Given** I am logged in as Rabbi and a service recording has finished
**When** I navigate to the admin dashboard recordings section
**Then** I see a list of unpublished Facebook recordings from recent livestreams (FR12)
**And** For each recording, I can add metadata: service date, Torah portion (optional), and duration (FR13)
**And** I can preview the recording before publishing
**And** When I click "Publish", the recording is saved to the database with metadata (FR12)
**And** The recording becomes visible in the member archive within 5 minutes (FR110, NFR-P4)
**And** Members receive an email notification that a new recording is available (FR84)
**And** The publish action is recorded in the audit log (NFR-S8)
**And** I receive confirmation that the recording was published successfully
**And** The form includes auto-save every 30 seconds to prevent data loss

### Story 3.4: Member Archive Browsing & Search

As a **logged-in member**,
I want to browse and search the archive of past service recordings,
So that I can watch services I missed or rewatch meaningful moments.

**Acceptance Criteria:**

**Given** I am a logged-in member
**When** I navigate to the recording archive page
**Then** I see a searchable list of all published service recordings (FR4)
**And** The archive displays the latest 52 weeks of recordings by default (FR117)
**And** Older recordings show a message "Available on request - contact Rabbi"
**And** I can filter recordings by date range (FR5, FR114)
**And** I can filter by Torah portion if applicable (FR5, FR114)
**And** I can filter by service type (Shabbat, Holiday, Special Event) (FR5, FR114)
**And** I can search by keyword in title or description (FR114)
**And** Each recording displays: thumbnail, date, Rabbi name, Torah portion, duration, and description (FR13, FR114)
**And** Search and filter results return in under 2 seconds (NFR-P3)
**And** Results are paginated with max 20 recordings per page, pagination loads in <1 second (NFR-P3)
**And** All search controls are keyboard accessible (NFR-A1)
**And** The page is fully responsive on all devices (FR77-79)

### Story 3.5: Recording Playback with Accessibility

As a **logged-in member**,
I want to play archived service recordings with captions,
So that I can watch past services with accessibility support.

**Acceptance Criteria:**

**Given** I am viewing a recording in the archive
**When** I click to play the recording
**Then** The video player loads and begins playback
**And** All service recordings have captions available (burned-in or WebVTT subtitle files) (FR70)
**And** I can toggle captions on/off if they are WebVTT format
**And** I can control playback speed (0.5x, 1x, 1.5x, 2x)
**And** I can use keyboard shortcuts: Space (pause), Arrow keys (skip), F (fullscreen) (NFR-A1)
**And** The video player is screen reader compatible with ARIA labels (NFR-A3)
**And** The player is fully responsive and works on mobile, tablet, and desktop (FR77-79)
**And** Video playback quality adjusts based on available bandwidth
**And** Only video metadata is stored in our database, video files remain on Facebook (NFR-Sc4)

### Story 3.6: Authorized User Stream Scheduling

As an **authorized user (Rabbi or Admin)**,
I want to schedule and initiate Facebook Live broadcasts for upcoming services,
So that the community knows when services will be streamed live.

**Acceptance Criteria:**

**Given** I am logged in with authorized streaming permissions
**When** I navigate to the streaming management page in admin dashboard
**Then** I can create a scheduled broadcast with service date, time, and title (FR8)
**And** I can link to the Facebook Live stream URL once it's created on Facebook
**And** The scheduled broadcast appears on the homepage with countdown timer
**And** I can update or cancel scheduled broadcasts before they start
**And** When the Facebook Live goes active, the homepage automatically displays the stream (FR8)
**And** The broadcast schedule is synced with the public calendar
**And** All streaming actions are logged in the audit trail (NFR-S8)
**And** The interface includes clear instructions for Facebook Live setup
**And** The form is keyboard accessible and mobile-friendly (NFR-A1, FR77-79)

---

## Epic 4: Live Chat During Services

Enable visitors to participate in moderated live chat during Facebook Live services with resilience features.

### Story 4.1: Post Messages to Live Chat

As a **website visitor during a live service**,
I want to post messages in the live chat,
So that I can share thoughts and connect with the community in real-time.

**Acceptance Criteria:**

**Given** I am on the homepage during an active live service
**When** I open the live chat panel
**Then** I am prompted to enter my name if not logged in (members use their account name) (FR109)
**And** I can type a message in the chat input field (max 500 characters)
**And** When I submit the message, it is sent to the moderation queue (FR16)
**And** I see a "pending approval" indicator on my message
**And** Once approved by a moderator, my message appears in the chat feed (FR16)
**And** Each message displays poster name and timestamp (FR15)
**And** The chat input is keyboard accessible (NFR-A1)
**And** Touch targets are minimum 44px on mobile (FR80)
**And** The chat interface is fully responsive on all devices (FR77-79)

### Story 4.2: Real-Time Chat Display with WebSocket

As a **chat participant**,
I want to see approved messages appear in real-time,
So that I can follow the conversation as it happens.

**Acceptance Criteria:**

**Given** I have the chat panel open during a live service
**When** A moderator approves a message
**Then** The message appears in the chat feed within 500ms of approval (FR18)
**And** Messages are displayed chronologically with the newest at the bottom (FR15)
**And** Each message shows poster name and timestamp (FR15)
**And** The chat auto-scrolls to show the newest messages
**And** I can manually scroll up to view older messages
**And** The chat supports up to 20 concurrent users without lag (FR18, NFR-Sc1)
**And** Messages are delivered in under 2 seconds end-to-end (NFR-P2)
**And** WebSocket connection is established when chat panel opens
**And** The chat feed is screen reader accessible with live region announcements (NFR-A3)

### Story 4.3: Chat Moderation Controls

As a **moderator (Rabbi or Admin)**,
I want to approve or delete chat messages,
So that I can maintain a respectful and appropriate conversation during services.

**Acceptance Criteria:**

**Given** I am logged in as Rabbi or Admin during a live service
**When** I view the moderation panel in the admin dashboard
**Then** I see all pending chat messages awaiting approval (FR16)
**And** I can approve a message with one click, making it visible to all participants
**And** I can delete a message, removing it from the queue without publishing
**And** I can delete an already-approved message from the public chat history (FR17)
**And** When I delete a published message, it is removed from all participants' chat feeds in real-time
**And** All moderation actions are logged in the audit trail with timestamp (NFR-S8)
**And** I can approve/delete multiple messages with keyboard shortcuts (NFR-A1)
**And** The moderation panel updates in real-time as new messages arrive
**And** The interface clearly shows message count: pending, approved, deleted

### Story 4.4: Chat Persistence and History

As a **logged-in member**,
I want to access chat logs from past services,
So that I can review community conversations and reflections.

**Acceptance Criteria:**

**Given** A live service with chat has ended
**When** I am a logged-in member viewing the archived service recording
**Then** I can view the complete chat history from that service (FR19)
**And** Chat messages are displayed alongside the recording with original timestamps
**And** I can expand/collapse the chat history panel
**And** The chat history includes only approved messages (deleted messages are not shown)
**And** Each message shows poster name and timestamp (FR15)
**And** The chat history is searchable by keyword
**And** The history is accessible via keyboard navigation (NFR-A1)
**And** Chat data is stored in the database for member review after the service (FR19)

### Story 4.5: WebSocket Failure & Polling Fallback

As a **chat participant**,
I want the chat to continue working even if my connection degrades,
So that I can stay connected to the community during technical issues.

**Acceptance Criteria:**

**Given** I am participating in live chat
**When** The WebSocket connection fails or times out
**Then** The system automatically switches to HTTP polling every 3 seconds (FR20)
**And** I see a clear indicator: "Slow connection mode - using backup connection" (FR20)
**And** I can still send and receive messages via polling (FR20)
**And** The polling continues to check for new messages every 3 seconds
**And** If WebSocket connection is restored, the system automatically switches back
**And** Messages sent during polling mode are queued and delivered when possible
**And** The connection status indicator is screen reader accessible (NFR-A3)
**And** The fallback mechanism activates within 5 seconds of connection loss

### Story 4.6: Chat Disconnection & Reconnection

As a **chat participant**,
I want to easily reconnect if my chat disconnects,
So that I don't miss community conversation during services.

**Acceptance Criteria:**

**Given** I am in the live chat and my connection is lost
**When** The disconnection is detected
**Then** I see a "Connection lost" indicator with a "Reconnect" button (FR112)
**And** My unsent message is preserved in the text input field (FR112)
**And** When I click "Reconnect", the system attempts to restore the connection
**And** Upon successful reconnection, I can immediately resume chatting
**And** Messages posted while I was disconnected are loaded and displayed
**And** The system attempts automatic reconnection 3 times before showing manual button
**And** Reconnection attempts happen at 2s, 5s, and 10s intervals
**And** The reconnection interface is keyboard accessible (NFR-A1)
**And** All status messages are screen reader compatible (NFR-A3)

### Story 4.7: Chat Capacity Management

As a **system administrator**,
I want the chat to handle capacity limits gracefully,
So that the experience remains stable even during High Holy Days with many participants.

**Acceptance Criteria:**

**Given** The live chat is active during a high-attendance service
**When** The concurrent user count approaches 1000 (maximum capacity)
**Then** New users attempting to join see a message: "Chat at capacity - please try again in a moment" (NFR-Sc1, NFR-Sc2)
**And** Users are placed in a queue and automatically joined when space becomes available
**And** The target capacity is 30-50 concurrent users with best performance (NFR-Sc1)
**And** The system supports up to 20 concurrent users without any performance degradation (FR18, NFR-Sc1)
**And** Performance monitoring tracks active connections, message rate, and latency
**And** Admin dashboard displays current active chat users (FR61)
**And** If capacity exceeds 1000, overflow users are queued with estimated wait time (NFR-Sc2)
**And** The system gracefully degrades rather than crashing under load (NFR-R3)

---

## Epic 5: Announcements & Member Communications

Enable Rabbi to post temple announcements with automatic email notifications to members.

### Story 5.1: Create and Post Announcements

As the **Rabbi**,
I want to write and post announcements that appear immediately on the homepage,
So that I can share important temple news with the community.

**Acceptance Criteria:**

**Given** I am logged in as Rabbi
**When** I navigate to the announcements section in the admin dashboard
**Then** I can create a new announcement with title and body content (FR29)
**And** I can format the announcement text using rich text editor (bold, italic, lists) (FR35)
**And** I can add images to the announcement with alt text for accessibility (FR35)
**And** I can add hyperlinks within the announcement content (FR35)
**And** I can preview the announcement before publishing
**And** When I click "Publish", the announcement appears on the homepage immediately (FR29)
**And** The announcement is saved to the database with timestamp
**And** The publish action is logged in the audit trail (NFR-S8)
**And** The form includes auto-save every 30 seconds to prevent data loss
**And** All form controls are keyboard accessible (NFR-A1)

### Story 5.2: Announcement Display on Homepage

As a **website visitor**,
I want to see temple announcements displayed on the homepage,
So that I stay informed about temple news and events.

**Acceptance Criteria:**

**Given** I am viewing the homepage
**When** Announcements have been published by the Rabbi
**Then** I see announcements displayed in chronological order with newest first (FR30)
**And** Each announcement shows title, date posted, and content preview
**And** I can click to expand/read the full announcement
**And** Images within announcements are displayed responsively (FR35, FR82)
**And** Links within announcements are keyboard accessible and clearly styled (FR35, NFR-A1)
**And** Featured announcements are pinned to the top of the list (FR111)
**And** The announcements section is screen reader compatible (NFR-A3)
**And** All announcement content meets 4.5:1 contrast ratio (NFR-A2)
**And** The homepage loads with announcements in under 2 seconds (NFR-P1)

### Story 5.3: Edit Published Announcements

As the **Rabbi**,
I want to edit announcements after they've been published,
So that I can correct errors or update information.

**Acceptance Criteria:**

**Given** I am logged in as Rabbi viewing my published announcements
**When** I select an announcement to edit
**Then** I can modify the title, content, images, and links (FR31)
**And** I see the original publication date preserved
**And** I can add an "Updated: [date]" indicator to show it was edited
**And** When I save changes, they appear immediately on the homepage (FR31)
**And** The edit action is logged in the audit trail with before/after content (NFR-S8, FR116)
**And** Members who already received the original email are not re-notified
**And** I receive confirmation that the announcement was updated successfully
**And** The form includes auto-save every 30 seconds
**And** All editing controls are keyboard accessible (NFR-A1)

### Story 5.4: Delete Announcements

As the **Rabbi**,
I want to delete announcements from the homepage,
So that I can remove outdated or incorrect information.

**Acceptance Criteria:**

**Given** I am logged in as Rabbi viewing my published announcements
**When** I select an announcement and choose to delete it
**Then** I see a confirmation dialog: "Are you sure? This will remove the announcement from the homepage" (FR32)
**And** After confirming, the announcement is removed from the homepage immediately (FR32)
**And** The announcement record remains in the database archive (soft delete, not hard delete) (FR32)
**And** The deletion action is logged in the audit trail with full announcement content (NFR-S8, FR116)
**And** I can view deleted announcements in an archive section
**And** Deleted announcements are no longer visible to public/members
**And** I see a success confirmation: "Announcement deleted from homepage"
**And** The deletion action is reversible (I can restore from archive)

### Story 5.5: Announcement Email Notifications

As a **member**,
I want to receive email notifications when new announcements are posted,
So that I stay informed even when not visiting the website.

**Acceptance Criteria:**

**Given** A Rabbi publishes a new announcement
**When** The announcement is saved to the database
**Then** An email is automatically queued for all members who have announcement emails enabled (FR33, FR86)
**And** The email subject line is "New Announcement: [announcement title]" (FR33)
**And** The email body includes the full announcement content with images and links (FR35)
**And** The email includes a link back to the website homepage
**And** The email includes an unsubscribe link for announcement notifications (FR88)
**And** Members who opted out of announcement emails do not receive the notification (FR34)
**And** Emails are sent within 5 minutes of announcement publication
**And** If email delivery fails, messages are queued locally with exponential backoff retry (NFR-I2, NFR-I3)
**And** Failed email attempts are logged and alert admin after 3 failures

### Story 5.6: Email Notification Preferences

As a **logged-in member**,
I want to control which email notifications I receive,
So that I can manage communication from the temple according to my preferences.

**Acceptance Criteria:**

**Given** I am a logged-in member in my account settings
**When** I view the notification preferences section
**Then** I can toggle announcement email notifications on/off (FR34)
**And** I can toggle calendar event email notifications on/off (FR34)
**And** I can toggle message reply email notifications on/off (FR34)
**And** I can toggle recording publication email notifications on/off (FR34)
**And** Each preference is saved immediately to the database
**And** I see confirmation when preferences are updated
**And** My preferences apply immediately to future notifications
**And** All email types include an unsubscribe link that updates my preferences (FR88)
**And** The preferences page is keyboard accessible (NFR-A1)
**And** The page is fully responsive on all devices (FR77-79)

### Story 5.7: Featured (Pinned) Announcements

As the **Rabbi**,
I want to mark an announcement as "featured" to pin it to the top of the homepage,
So that critical information remains visible for an extended period.

**Acceptance Criteria:**

**Given** I am logged in as Rabbi viewing my published announcements
**When** I mark an announcement as "featured"
**Then** The announcement is pinned to the top of the homepage announcement list (FR111)
**And** The featured announcement displays a "Featured" badge or visual indicator
**And** The featured status can be active for up to 30 days (FR111)
**And** After 30 days, the featured status automatically expires and the announcement returns to chronological order
**And** I can manually un-feature an announcement before the 30-day limit
**And** Only one announcement can be featured at a time (setting a new one removes previous featured status)
**And** The featured action is logged in the audit trail (NFR-S8)
**And** The featured announcement remains responsive on all devices (FR77-79)
**And** I receive confirmation when an announcement is featured/unfeatured

---

## Epic 6: Calendar Management & Event Notifications

Enable Rabbi to manage public/members-only calendars and send event reminders to members.

### Story 6.1: Create Public Calendar Events

As the **Rabbi**,
I want to create public calendar events visible to all visitors,
So that the community knows about upcoming services, holidays, and public events.

**Acceptance Criteria:**

**Given** I am logged in as Rabbi
**When** I navigate to the calendar management section in the admin dashboard
**Then** I can create a new public calendar event (FR36)
**And** I can specify: date, time, title, and description (FR40)
**And** I can optionally add a Zoom link or physical location (FR41)
**And** I can mark the event as "public" (visible to all visitors) (FR36)
**And** I can preview the event before publishing
**And** When I save the event, it appears on the public calendar immediately (FR36, FR38)
**And** The event creation is logged in the audit trail (NFR-S8, FR116)
**And** Members receive email notification about the new event (FR42)
**And** The form includes auto-save every 30 seconds
**And** All form controls are keyboard accessible (NFR-A1)

### Story 6.2: Create Members-Only Calendar Events

As the **Rabbi**,
I want to create members-only calendar events,
So that I can schedule board meetings, private classes, and other restricted activities.

**Acceptance Criteria:**

**Given** I am logged in as Rabbi creating a calendar event
**When** I mark the event as "members-only"
**Then** The event is saved to the database with members-only visibility flag (FR37)
**And** The event appears on the members-only calendar section (FR39)
**And** The event is NOT visible on the public calendar
**And** Only logged-in members can view members-only events (FR39)
**And** The event includes date, time, title, description, and optional Zoom/location (FR40, FR41)
**And** Members receive email notification about the new members-only event (FR42)
**And** The event creation is logged in the audit trail (NFR-S8, FR116)
**And** I can convert between public and members-only visibility after creation
**And** Anonymous visitors attempting to access members-only calendar see a "Login to view" message

### Story 6.3: Edit Calendar Events

As the **Rabbi**,
I want to edit existing calendar events,
So that I can update times, locations, or other event details as plans change.

**Acceptance Criteria:**

**Given** I am logged in as Rabbi viewing the calendar management
**When** I select an existing event to edit
**Then** I can modify the date, time, title, description, location, or Zoom link (FR36)
**And** I can change the visibility between public and members-only (FR36, FR37)
**And** When I save changes, they appear immediately on the calendar
**And** The edit action is logged in the audit trail with before/after values (NFR-S8, FR116)
**And** Members who were previously notified receive an "Event Updated" email with changes highlighted
**And** The form includes auto-save every 30 seconds
**And** I receive confirmation that the event was updated successfully
**And** All editing controls are keyboard accessible (NFR-A1)

### Story 6.4: Calendar Display with Date Range

As a **website visitor or member**,
I want to view upcoming events on the calendar,
So that I can plan my participation in temple activities.

**Acceptance Criteria:**

**Given** I am viewing the calendar page
**When** The calendar loads
**Then** I see the next 3 months of events displayed by default (FR43)
**And** I can view the past 1 month of events in an archive section (FR43)
**And** Public events are visible to all visitors (FR38)
**And** Members-only events are visible only when I'm logged in as a member (FR39)
**And** Each event displays date, time, title, and description (FR40)
**And** Events with Zoom links or locations show that information clearly (FR41)
**And** I can navigate between months using prev/next controls
**And** The calendar loads in under 2 seconds (NFR-P1)
**And** The calendar is fully responsive on mobile, tablet, and desktop (FR77-79)
**And** All navigation controls are keyboard accessible (NFR-A1)

### Story 6.5: New Event Email Notifications

As a **member**,
I want to receive email notifications when new events are added to the calendar,
So that I don't miss important temple activities.

**Acceptance Criteria:**

**Given** The Rabbi creates a new calendar event
**When** The event is published
**Then** All members who have calendar email notifications enabled receive an email (FR42)
**And** The email includes event title, date, time, description, and location/Zoom link (FR40, FR41)
**And** The email subject is "New Temple Event: [event title]"
**And** The email includes an "Add to Calendar" link/attachment (iCal format)
**And** The email includes an unsubscribe link for calendar notifications (FR88)
**And** Members who opted out of calendar emails do not receive the notification (FR34)
**And** Emails are sent within 5 minutes of event creation
**And** If email delivery fails, messages are queued locally with exponential backoff retry (NFR-I2, NFR-I3)
**And** Failed email attempts trigger admin alerts after 3 failures

### Story 6.6: Event Reminders 24 Hours Before

As a **member**,
I want to receive reminder emails 24 hours before calendar events,
So that I don't forget about upcoming temple activities.

**Acceptance Criteria:**

**Given** A calendar event is scheduled to occur in 24 hours
**When** The automated reminder job runs (hourly)
**Then** All members who have calendar reminders enabled receive a reminder email (FR87)
**And** The reminder email includes event title, time, location/Zoom link (FR87)
**And** The reminder email includes an iCal attachment for calendar apps (FR87)
**And** The reminder email subject is "Reminder: [event title] tomorrow at [time]"
**And** The reminder includes a countdown: "Event starts in 24 hours"
**And** Members who opted out of calendar emails do not receive reminders (FR34)
**And** Each event sends only one 24-hour reminder (tracked in database)
**And** If email delivery fails, reminders are retried with exponential backoff (NFR-I2, NFR-I3)
**And** The email includes an unsubscribe link for calendar notifications (FR88)

### Story 6.7: Delete Calendar Events

As the **Rabbi**,
I want to delete calendar events that are canceled or no longer relevant,
So that the calendar remains accurate and up-to-date.

**Acceptance Criteria:**

**Given** I am logged in as Rabbi viewing calendar events
**When** I select an event and choose to delete it
**Then** I see a confirmation dialog: "Are you sure? This will remove the event from the calendar"
**And** After confirming, the event is removed from both public and members-only calendars immediately
**And** The event record is soft-deleted (archived, not permanently removed)
**And** The deletion action is logged in the audit trail with full event details (NFR-S8, FR116)
**And** Members who were previously notified receive a "Event Canceled" email
**And** I can view deleted events in an archive section
**And** I can restore accidentally deleted events from the archive
**And** I see a success confirmation: "Event deleted from calendar"

---

## Epic 7: Visitor & Member Messaging

Enable public visitors and members to send messages to Rabbi/admin with CAPTCHA protection and unified inbox.

### Story 7.1: Visitor Contact Form with CAPTCHA

As a **public visitor**,
I want to submit a message to the temple via the Contact Us form,
So that I can ask questions or request information without needing an account.

**Acceptance Criteria:**

**Given** I am a public visitor on the Contact Us page
**When** I fill out the contact form with my name, email, and message
**Then** I must complete a CAPTCHA challenge before submitting (FR44, FR106, NFR-S7)
**And** The form validates that name, email, and message are not empty (NFR-S7)
**And** The form validates that the email format is correct
**And** The message is limited to 2000 characters
**And** After successful submission, my message is queued in the Rabbi's inbox (FR45)
**And** I see a confirmation: "Thank you! Your message has been sent to the Rabbi"
**And** The form is cleared after successful submission
**And** All form fields are keyboard accessible with clear labels (NFR-A1, FR74)
**And** The form is touch-friendly on mobile with 44px touch targets (FR80, FR83)
**And** The form is fully responsive on all devices (FR77-79)

### Story 7.2: Member Messaging Form

As a **logged-in member**,
I want to send messages to the Rabbi or temple community through a member-only form,
So that I can communicate directly with leadership.

**Acceptance Criteria:**

**Given** I am a logged-in member
**When** I navigate to the member messaging page
**Then** I can compose a message with subject and body (FR48)
**And** My name and email are pre-filled from my account information
**And** I can select message type: "Question for Rabbi", "Community Request", or "General Inquiry"
**And** The message is limited to 2000 characters
**And** CAPTCHA is not required for logged-in members (trust authenticated users)
**And** When I submit, my message is queued in the unified inbox (FR48)
**And** The message is tagged as "member message" in the system (FR50)
**And** I see confirmation: "Your message has been sent"
**And** All form controls are keyboard accessible (NFR-A1)
**And** The form is fully responsive on all devices (FR77-79)

### Story 7.3: Rabbi Unified Inbox

As the **Rabbi**,
I want to view all visitor and member messages in a unified inbox,
So that I can respond to community inquiries efficiently from one place.

**Acceptance Criteria:**

**Given** I am logged in as Rabbi
**When** I navigate to the Messages section in the admin dashboard
**Then** I see a unified inbox showing both visitor and member messages (FR50)
**And** Each message displays: sender name, email, timestamp, message preview, and type (visitor/member) (FR45, FR49)
**And** Messages are sorted by newest first
**And** I can filter messages by: unread, read, visitor, member, archived
**And** I can search messages by sender name or keyword
**And** Unread messages are visually highlighted
**And** I can mark messages as read/unread
**And** All messages include full timestamp for accountability (FR49)
**And** The inbox loads in under 2 seconds (NFR-P1)
**And** The inbox is keyboard accessible (arrow keys to navigate, Enter to open) (NFR-A1)
**And** The inbox is fully responsive on desktop and mobile (FR66)

### Story 7.4: Rabbi Replies to Messages

As the **Rabbi**,
I want to read and reply to visitor and member messages directly from the dashboard,
So that I can maintain ongoing communication with the community.

**Acceptance Criteria:**

**Given** I am viewing a message in the Rabbi inbox
**When** I click to read the full message
**Then** I see the complete message with sender details and original timestamp (FR46)
**And** I can compose a reply in a text editor below the message (FR46)
**And** I can format my reply with basic text formatting (bold, italic, lists)
**And** I can preview my reply before sending
**And** When I click "Send Reply", the response is emailed to the sender (FR47)
**And** The visitor/member receives the email reply with my response (FR47)
**And** My reply is logged in the message thread with timestamp (FR49)
**And** The message status changes to "Replied"
**And** I can send multiple replies in the same thread
**And** The reply action is logged in the audit trail (NFR-S8)
**And** All reply controls are keyboard accessible (NFR-A1)

### Story 7.5: Email Reply Notifications

As a **visitor or member who sent a message**,
I want to receive an email when the Rabbi responds,
So that I can continue the conversation without constantly checking the website.

**Acceptance Criteria:**

**Given** I submitted a message to the Rabbi
**When** The Rabbi sends a reply
**Then** I receive an email notification with the Rabbi's response (FR47, FR85)
**And** The email subject is "Re: [original message subject or first line]"
**And** The email includes the full reply text from the Rabbi
**And** The email includes a link to view the full conversation on the website (for members)
**And** The email is sent within 1 minute of the Rabbi clicking "Send Reply"
**And** If email delivery fails, the message is queued locally with exponential backoff retry (NFR-I2)
**And** Failed email attempts trigger admin alerts after 3 failures
**And** The email includes the temple's contact information in the signature
**And** The email is formatted for readability on all devices

### Story 7.6: Spam Detection and Flagging

As an **admin**,
I want the system to automatically flag likely spam messages,
So that I can focus on legitimate community inquiries.

**Acceptance Criteria:**

**Given** A visitor submits a message via the contact form
**When** The message is processed
**Then** The system checks for spam indicators using simple heuristics (FR113)
**And** Messages with ALL CAPS text are flagged as potential spam (FR113)
**And** Messages with external links to suspicious domains are flagged (FR113)
**And** Repeated identical messages from the same email are flagged (FR113)
**And** Messages with excessive special characters or emoji are flagged
**And** Flagged messages appear in a separate "Spam Queue" section of the inbox
**And** The admin can review flagged messages before they reach the Rabbi's inbox (FR113)
**And** The admin can mark flagged messages as "Not Spam" to move them to the main inbox
**And** The admin can auto-delete confirmed spam with one click (FR113)
**And** The spam detection rules can be adjusted by the admin
**And** All spam actions are logged in the audit trail (NFR-S8)

### Story 7.7: Message Logging and Accountability

As an **admin**,
I want all messages logged with timestamps for accountability,
So that there's a clear record of all community communications.

**Acceptance Criteria:**

**Given** Any message is sent or replied to in the system
**When** The action occurs
**Then** The message is permanently logged in the database with timestamp (FR49)
**And** The log includes: sender name, sender email, recipient, message content, timestamp
**And** Reply timestamps are logged separately for each response
**And** The admin can view the complete message history (FR50)
**And** Message logs are included in the audit trail export
**And** Logs are retained indefinitely for accountability
**And** Deleted messages remain in the archive log (soft delete only)
**And** The message log is searchable by date range, sender, or keyword
**And** The log interface is keyboard accessible (NFR-A1)
**And** Only Rabbi and Admin roles can access the message logs

---

## Epic 8: Donations & Financial Transparency

Enable visitors to make one-time or recurring donations via PayPal with automated tax receipts and admin dashboard visibility.

### Story 8.1: Donations Page with PayPal Integration

As a **public visitor**,
I want to access a prominent donations page with suggested giving levels,
So that I can easily support the temple financially.

**Acceptance Criteria:**

**Given** I am on the temple website
**When** I navigate to the Donations tab in the main navigation
**Then** I see a prominent Donations link in the top navigation (FR51)
**And** The donations page explains giving options and their impact (FR52)
**And** I see suggested donation levels: $18 (Chai), $36 (Double Chai), $100+ (Major Donor) (FR52)
**And** I can select a pre-set amount or enter a custom amount
**And** I can choose between one-time and recurring monthly donations (FR53, FR54)
**And** The page includes a clear call-to-action: "Donate Now" button
**And** The page explains that donations are tax-deductible
**And** The donations page loads in under 2 seconds (NFR-P1)
**And** The page is fully responsive on all devices (FR77-79)
**And** All controls are keyboard accessible (NFR-A1)

### Story 8.2: One-Time PayPal Donations

As a **donor**,
I want to make a one-time donation via PayPal,
So that I can support the temple without creating an account or recurring commitment.

**Acceptance Criteria:**

**Given** I am on the donations page
**When** I select a one-time donation amount and click "Donate Now"
**Then** I am redirected to PayPal's secure checkout (FR53)
**And** I can complete the payment without creating a temple account (FR53)
**And** PayPal handles all payment processing and PCI compliance (FR105, NFR-I6)
**And** No credit card data is stored locally on the temple server (FR105)
**And** After successful payment, I am redirected back to a "Thank You" page
**And** The donation is logged in the database with date, amount, donor email (if provided), and transaction ID (FR59)
**And** The donation data is encrypted at rest in the database (NFR-S6)
**And** If the PayPal payment fails, I see a clear error message with option to retry (FR118, NFR-I1)
**And** Failed payment attempts are logged for admin review (FR118)

### Story 8.3: Recurring Monthly Donations

As a **donor**,
I want to set up recurring monthly donations via PayPal,
So that I can provide sustained support to the temple automatically.

**Acceptance Criteria:**

**Given** I am on the donations page
**When** I select "Recurring Monthly" and choose an amount
**Then** I am redirected to PayPal's subscription/recurring payment flow (FR54)
**And** I can set up automatic monthly donations through PayPal (FR54)
**And** The recurring donation is logged in the database with recurring status (FR59)
**And** Each month when the payment processes, a new donation record is created
**And** I receive a tax receipt email after each monthly donation (FR56, FR89)
**And** Recurring donors are tracked separately in the donation dashboard (FR57)
**And** I can manage or cancel my recurring donation through PayPal
**And** If a recurring payment fails, the system logs the failure and notifies the admin (FR118, NFR-I1)
**And** The donor receives a friendly notification about the failed payment with retry instructions

### Story 8.4: Anonymous Donations

As a **donor**,
I want the option to give anonymously,
So that my donation is not tracked with my personal information.

**Acceptance Criteria:**

**Given** I am on the donations page
**When** I check the "Give Anonymously" option before donating
**Then** My name and email are not stored in the temple database (FR55, NFR-S5)
**And** The donation record shows "Anonymous Donor" instead of personal information (FR55)
**And** The donation amount and date are still recorded for financial tracking (FR59)
**And** I still receive a tax receipt email (sent via PayPal, not stored in temple DB) (FR56)
**And** Anonymous donations appear in the admin dashboard totals but without donor identification (FR57)
**And** The anonymous flag is clearly visible before payment confirmation
**And** The Rabbi does not receive notification emails for anonymous donations (FR60 only applies to major non-anonymous donations)
**And** PII minimization principles are followed (NFR-S5)

### Story 8.5: Automated Tax Receipts

As a **donor**,
I want to receive an automated tax receipt immediately after donating,
So that I have documentation for tax deductions.

**Acceptance Criteria:**

**Given** I complete a donation via PayPal
**When** The payment is confirmed
**Then** I receive an automated tax receipt email within 1 hour (FR56, FR89)
**And** The tax receipt is attached as a PDF to the email (FR56)
**And** The receipt includes: donation date, amount, donor name (if not anonymous), and confirmation of tax-deductible status per IRS guidelines (FR115)
**And** The receipt includes the temple's EIN (Employer Identification Number) (FR115)
**And** The receipt includes the temple's official name and address
**And** The receipt states: "No goods or services were provided in exchange for this donation"
**And** The thank-you email is sent separately or combined with the receipt (FR89)
**And** Recurring donations generate a receipt for each monthly payment
**And** If email delivery fails, the receipt is queued with exponential backoff retry (NFR-I2)

### Story 8.6: Donation Dashboard for Rabbi/Admin

As the **Rabbi or Admin**,
I want to view a donation dashboard with financial totals and donor information,
So that I can track the temple's financial health and thank supporters.

**Acceptance Criteria:**

**Given** I am logged in as Rabbi or Admin
**When** I navigate to the Donations section in the admin dashboard
**Then** I see total donations received (all-time, year-to-date, month-to-date) (FR57, FR58)
**And** I see total donor count (unique donors) (FR57)
**And** I see recurring donor count and monthly recurring revenue (FR57)
**And** I see a list of recent donations with date, amount, donor name/email (or "Anonymous"), and recurring status (FR59)
**And** I can filter donations by: date range, amount range, recurring/one-time, anonymous/identified
**And** I can export donation data to CSV for accounting
**And** All sensitive donation data is encrypted at rest (NFR-S6)
**And** Access to donation data is logged in the audit trail (NFR-S6, NFR-S8)
**And** The dashboard loads in under 2 seconds (NFR-P1, NFR-P5)
**And** The dashboard is fully responsive on desktop and mobile (FR66)

### Story 8.7: Major Donation Email Alerts

As the **Rabbi**,
I want to receive email notifications when major donations are received,
So that I can personally thank significant supporters in a timely manner.

**Acceptance Criteria:**

**Given** A donor completes a donation
**When** The donation amount is greater than $100
**Then** The Rabbi receives an email notification about the major donation (FR60)
**And** The email includes: donor name (if not anonymous), amount, date, and transaction ID
**And** Anonymous major donations do not trigger email notifications (respect donor privacy)
**And** The email subject is "Major Donation Received: $[amount]"
**And** The notification email is sent within 5 minutes of donation confirmation
**And** If email delivery fails, notifications are queued with retry logic (NFR-I2)
**And** The notification event is logged in the audit trail (NFR-S8)
**And** Only donations over $100 trigger this notification (not $100 exactly, but greater than)

### Story 8.8: PayPal Payment Failure Handling

As a **donor attempting to give**,
I want clear error messages and retry options if my PayPal payment fails,
So that I can successfully complete my donation despite technical issues.

**Acceptance Criteria:**

**Given** I attempt to make a donation via PayPal
**When** The PayPal payment fails for any reason (insufficient funds, connection error, canceled payment)
**Then** I see a clear, user-friendly error message explaining what happened (FR118, NFR-I1)
**And** The error message provides actionable next steps: "Retry Payment" or "Try Different Payment Method"
**And** I can immediately retry the donation with one click (FR118)
**And** The failed payment attempt is logged in the database with timestamp and error code (FR118)
**And** After 3 failed attempts from the same session, an admin alert is triggered (FR118)
**And** The admin alert email includes donor email (if provided), amount attempted, and error details
**And** PayPal connection errors are handled gracefully with circuit breaker pattern (NFR-I1)
**And** The user never sees technical error codes, only friendly explanations
**And** All error scenarios are keyboard accessible for retry (NFR-A1)

---

## Epic 9: Admin Dashboard & Operations

Enable Rabbi/Admin to monitor site health, view analytics, manage content, and access audit logs for all sensitive operations.

### Story 9.1: Admin Dashboard with Key Metrics

As an **Admin**,
I want to view key site metrics on the dashboard when I log in,
So that I can quickly assess the temple website's health and activity.

**Acceptance Criteria:**

**Given** I am logged in as Admin
**When** I navigate to the admin dashboard
**Then** I see 6 key metrics displayed prominently (FR61):
  1. New members this month (count)
  2. Total donations this month (dollar amount)
  3. Active live chat users (current count)
  4. Pending messages (count needing response)
  5. System uptime percentage (last 24 hours)
  6. Last backup timestamp (date/time)
**And** Each metric displays the current value with clear labels
**And** A “Today’s Priorities” panel highlights: pending messages, upcoming events in 7 days, and active alerts
**And** The priorities panel is the first visible element on login
**And** Metrics auto-refresh every 30 seconds without page reload
**And** Clicking a metric navigates to the detailed view for that category
**And** The dashboard loads in under 2 seconds (NFR-P6)
**And** The dashboard is fully responsive on desktop and mobile (FR66)
**And** All dashboard elements are keyboard accessible (NFR-A1)

### Story 9.2: Analytics and Reporting

As an **Admin**,
I want to view detailed analytics about site usage,
So that I can understand community engagement and make data-driven decisions.

**Acceptance Criteria:**

**Given** I am logged in as Admin
**When** I navigate to the Analytics section
**Then** I can view page views by page and date range (FR62)
**And** I can view recording views count per video (FR62)
**And** I can view live chat user counts over time (FR62)
**And** I can view donation trends by month/quarter/year (FR62)
**And** I can filter analytics by date range (last 7 days, 30 days, 90 days, custom)
**And** Analytics data is displayed in charts and graphs with accessible data tables (NFR-A3)
**And** I can export analytics data to CSV
**And** Analytics queries complete in under 1 second (NFR-P5)
**And** The analytics interface is keyboard accessible (NFR-A1)

### Story 9.3: Moderation Queue Management

As an **Admin**,
I want to access a centralized moderation queue,
So that I can review and manage pending content efficiently.

**Acceptance Criteria:**

**Given** I am logged in as Admin
**When** I navigate to the Moderation Queue
**Then** I see pending messages awaiting Rabbi response (FR63)
**And** I see chat messages awaiting approval during live services (FR63)
**And** I see spam-flagged messages for review
**And** Each item displays: timestamp, sender, content preview, and type
**And** I can approve, reject, or escalate items with one click
**And** I can bulk-select multiple items for batch actions
**And** The queue auto-refreshes every 15 seconds
**And** All moderation actions are logged in the audit trail (NFR-S8)
**And** The moderation interface is keyboard accessible (NFR-A1)

### Story 9.4: System Notifications and Alerts

As an **Admin**,
I want to set system-wide notifications for maintenance or issues,
So that I can communicate site status to users proactively.

**Acceptance Criteria:**

**Given** I am logged in as Admin
**When** I navigate to System Notifications
**Then** I can create a banner notification that appears on all pages (FR64)
**And** I can set the notification type: Info, Warning, Maintenance, Critical
**And** I can schedule notifications to appear/disappear at specific times
**And** I can preview how the notification will look to users
**And** Active notifications display prominently at the top of all pages
**And** Users can dismiss dismissible notifications
**And** Critical notifications cannot be dismissed until issue is resolved
**And** I receive email alerts for critical issues: site down, PayPal error, spam detected (FR67)
**And** All notification actions are logged in the audit trail (NFR-S8)

### Story 9.5: Static Content Management

As the **Rabbi or Admin**,
I want to view and edit static pages like About, Contact, and policies,
So that I can keep temple information current without developer assistance.

**Acceptance Criteria:**

**Given** I am logged in as Rabbi or Admin
**When** I navigate to Content Management
**Then** I can view a list of all static pages (About, Contact, Privacy Policy, etc.) (FR91)
**And** I can edit any page using a rich text editor with formatting options (FR92)
**And** I can add/edit text, images, links, lists, and headings (FR92)
**And** I can preview pages before publishing (FR95)
**And** I can set pages as "Published" (publicly visible) or "Draft" (not visible) (FR93, FR95)
**And** When I publish a page, it becomes immediately visible to the public (FR95)
**And** Draft pages show "DRAFT" badge and are only visible to admins
**And** The editor includes auto-save every 30 seconds
**And** All editing actions are logged in the audit trail (NFR-S8)
**And** The editor is keyboard accessible (NFR-A1)

### Story 9.6: Page Version History and Restore

As an **Admin**,
I want to view and restore previous versions of static pages,
So that I can recover from accidental changes or review historical content.

**Acceptance Criteria:**

**Given** I am editing a static page as Admin
**When** I view the page's version history
**Then** I see up to 10 most recent versions of the page (FR94)
**And** Each version shows: timestamp, editor name, and change summary
**And** I can preview any previous version in read-only mode
**And** I can restore any previous version with one click (FR94)
**And** When restoring, I see a confirmation: "Restore [page] to version from [date]?"
**And** Restoring a version creates a new version entry (preserves history)
**And** The restore action is logged in the audit trail (NFR-S8)
**And** Version history is accessible via keyboard navigation (NFR-A1)
**And** Old versions are automatically archived after reaching the 10-version limit

### Story 9.7: Automated Daily Backups

As an **Admin**,
I want the system to perform automated daily backups,
So that temple data is protected against loss or corruption.

**Acceptance Criteria:**

**Given** The backup service is running
**When** The daily backup schedule triggers (configured for 2 AM local time)
**Then** The system backs up all database data to cloud storage (S3) (FR96)
**And** The backup includes: all user data, messages, donations, announcements, calendar events, and settings (FR97)
**And** The backup file is encrypted before upload (AES-256) (FR101)
**And** The backup timestamp is recorded in the database
**And** The admin dashboard displays the last successful backup timestamp (FR61, FR99)
**And** If a backup fails, an email alert is sent to the admin (FR67)
**And** Backups are retained for 30 days, then automatically deleted
**And** Backup operations are logged in the system logs (NFR-M3)

### Story 9.8: Backup Restore and Testing

As an **Admin**,
I want to test backup restoration without affecting the live site,
So that I can verify backups are working correctly.

**Acceptance Criteria:**

**Given** I am logged in as Admin with backup files available
**When** I navigate to Backup Management
**Then** I see a list of available backup files with dates and sizes (FR99)
**And** I can initiate a test restore to a sandbox environment (FR98)
**And** The test restore creates a separate database instance (not affecting live site) (FR98)
**And** I can verify the restored data is complete and accurate
**And** I receive a report summarizing the test restore results
**And** In a real emergency, I can perform a production restore with explicit confirmation
**And** All restore operations are logged in the audit trail (NFR-S8)
**And** The restore interface clearly distinguishes between test and production modes

### Story 9.9: Security and Encryption

As an **Admin**,
I want all data encrypted in transit and at rest,
So that sensitive temple and member information remains secure.

**Acceptance Criteria:**

**Given** The website is operational
**When** Any data is transmitted or stored
**Then** All data in transit is encrypted via HTTPS/TLS 1.2+ (FR100, NFR-S1)
**And** The database is encrypted at rest using AES-256 (FR101, NFR-S2)
**And** Sensitive audit logs (donations, admin actions, messages) are stored securely with encryption (FR102, NFR-S6)
**And** Password reset tokens expire after 24 hours (FR103)
**And** All session cookies are HTTP-only, Secure, and SameSite=Strict
**And** PayPal handles PCI compliance; no card data is stored locally (FR105)

### Story 9.10: Comprehensive Audit Logging

As an **Admin**,
I want comprehensive audit logs of all sensitive actions,
So that there's accountability and traceability for all system changes.

**Acceptance Criteria:**

**Given** Any sensitive action occurs on the website
**When** The action is performed
**Then** The action is logged in the audit trail (FR65, FR116):
  - All announcements posted/edited/deleted (user, timestamp, before/after text)
  - All calendar changes (create/edit/delete with details)
  - All donation records (amount, donor, timestamp)
  - All admin logins and logouts
  - All password changes and resets
  - All user role changes and permission grants
  - All message deletions and moderation actions
**And** Audit logs are append-only (cannot be modified or deleted) (NFR-S8)
**And** Admin can search audit logs by: date range, user, action type, or keyword (FR65)
**And** Admin can export audit logs to CSV for compliance
**And** Audit logs are retained for 1 year minimum
**And** Sensitive audit data is encrypted at rest (FR102, NFR-S6)
**And** Access to audit logs is itself logged (meta-logging)
**And** The audit interface is keyboard accessible (NFR-A1)

### Story 9.11: System Uptime Monitoring

As an **Admin**,
I want to monitor system uptime and receive alerts for outages,
So that I can quickly respond to technical issues.

**Acceptance Criteria:**

**Given** The monitoring service is running
**When** I view the admin dashboard
**Then** I see system uptime percentage for the last 24 hours (FR61)
**And** I can view uptime history for the last 7 days, 30 days, and 90 days
**And** The target uptime is 95% (NFR-R1)
**And** If the site goes down, the system attempts auto-restart (NFR-R4)
**And** If restart fails, an email alert is sent to admin immediately (FR67)
**And** A downtime communication page displays the Facebook Live link as fallback (NFR-R5)
**And** When downtime occurs, a public status banner appears on the homepage with Facebook Live link (NFR-R5)
**And** The status banner is visible without login and persists until admin clears it
**And** All downtime incidents are logged with duration and cause
**And** I can view a detailed incident report for each outage

### Story 9.12: Email Alert Management

As an **Admin**,
I want to receive email alerts for critical system issues,
So that I can respond quickly to problems requiring immediate attention.

**Acceptance Criteria:**

**Given** Critical issues occur on the website
**When** An alert condition is triggered
**Then** I receive email alerts for: site down, PayPal errors, spam detected, backup failures (FR67)
**And** Alert emails include: severity level, timestamp, description, and recommended action
**And** Alerts are sent to all users with Admin role
**And** Alert emails have clear subject lines: "CRITICAL: [issue type]"
**And** Alerts are categorized into severity levels: Info, Warning, Critical
**And** Critical alerts bypass throttling; Info/Warning alerts are throttled to max 1 per hour per issue
**And** I can configure alert thresholds and notification preferences
**And** Repeated identical alerts are throttled to prevent email flooding (max 1 per hour per issue)
**And** When an issue is resolved, a "Resolved" email is sent
**And** All alerts are logged in the system logs (NFR-M3)
**And** Test alerts can be triggered to verify email delivery
