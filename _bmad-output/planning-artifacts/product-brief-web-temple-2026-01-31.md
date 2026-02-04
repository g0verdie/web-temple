---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: 
  - source: "Current Website"
    url: "https://florencetemple.org/"
    type: "existing-website-analysis"
date: 2026-01-31
author: Ilya
project: web-temple
---

# Product Brief: web-temple

## Executive Summary

Temple B'nai Israel requires a modern, maintainable digital presence that consolidates scattered service experiences (Facebook Live, broken PayPal, lost recordings) into a unified, Rabbi-controlled platform. The core challenge: the existing website is unmaintained, inaccessible to the Rabbi for edits, and fragmented across external platforms. The new site restores donation revenue, enables independent content management, and centralizes member engagement—all owned and controlled by the temple.

---

## Core Vision

### Problem Statement

The current website, built nearly a decade ago with no access to its developer or source code, has become a liability rather than an asset:
- **Broken donations**: PayPal link defunct, blocking revenue
- **Scattered services**: Live streams and recordings live on Facebook; no single discovery point
- **Locked content**: Rabbi cannot post announcements, update events, or manage messaging
- **Dependency risk**: Temple is hostage to external hosting, no ability to iterate or improve

### Problem Impact

- **Revenue loss**: Donors unable to give online; potential members unable to contribute
- **Engagement drop**: Members must hop between Facebook and website; poor discoverability of recorded services
- **Operational friction**: Rabbi and staff spend time managing multiple platforms instead of focusing on ministry
- **Community perception**: Outdated digital presence undermines outreach to younger families and broader community

### Why Existing Solutions Fall Short

Quick patches (fixing the PayPal link, adding a Facebook link to the homepage) don't address the root issue: the site itself is opaque, unmaintainable, and fragmented. Adding Band-Aids doesn't give the Rabbi content ownership, doesn't consolidate the experience, and doesn't give the temple ownership of its digital future.

### Proposed Solution

A modern, open-source website purpose-built for temple operations:

**Core Features:**
- **Unified streaming hub**: Embed Facebook Live directly (no account required); auto-archive and display recorded services for easy discovery
- **Rabbi special user role**: Simple interface to post announcements, manage event calendar, monitor and reply to visitor/member messages (without access to technical settings or diagnostics); includes onboarding tutorial
- **Visitor messaging**: Visitors can leave messages for the Rabbi after passing CAPTCHA verification; Rabbi can enable optional message filtering; all messages require CAPTCHA even for registered users
- **Restored giving**: PayPal integration with PCI compliance for:
  - One-time donations
  - Recurring/subscription donations
  - Anonymous giving option
  - Automated tax receipt generation
  - Admin dashboard showing donation metrics (monthly totals, trends, etc.)
- **Mobile-first responsive design**: Full experience on desktop and mobile; email notifications for message replies and new recorded services
- **Merch shop**: Optional e-commerce to sell temple-branded items (future phase)
- **Open source**: Full access to code; temple owns the platform; future developers can extend it

**Operational Constraints:**
- Annual budget: $1,000 for hosting, domain, and maintenance (non-human costs)
- You handle technical support; infrastructure costs cover platform only
- PCI compliance required for payment processing

### Key Differentiators

1. **Rabbi independence**: Non-technical staff can manage content, events, and community without external developer involvement
2. **Consolidated UX**: Members and visitors stay on one site—no friction, no Facebook dependency, no registration barriers for casual access
3. **Ownership**: Temple controls code, data, and roadmap
4. **Donor-centric**: Recurring donations, anonymous giving, and automated tax compliance reduce friction and increase giving
5. **Modern foundation**: Built with current tech, scalable to regular member user roles and future features, mobile-first design
6. **Sustainable**: Low-cost infrastructure ($1K/year) with in-house technical support

---

## Target Users

### Primary Users

#### **Persona 1: Rabbi Sarah — Content Steward & Community Connector**

**Profile:**
- Role: Spiritual leader and primary content authority
- Tech level: Average to above-average user; comfortable on phone and desktop
- **Current communication pattern: Sends weekly email updates to members**
- Posting frequency: Weekly (emails); ad-hoc announcements (messages, schedule changes)
- Community engagement: Receives ~10 messages/week from members and visitors
- Mobile access: Needs mobile-friendly admin interface

**Current Pain Points:**
- **Cannot post updates directly to website; uses email as workaround** (disconnected from web presence)
- Cannot interact with audience through the site; all communication happens off-platform (email, Facebook, phone)
- Messages come through multiple channels (email, phone, Facebook); no unified inbox
- Weekly email sends are time-consuming; no way to auto-archive or display on website

**Success Metrics:**
- Replaces weekly email with website post (same frequency, < 3 minutes to compose & publish from phone or desktop)
- Replies to 80% of incoming messages within 24 hours (measured in-app)
- Views donation dashboard monthly to track community giving
- Uses onboarding tutorial without external help
- **Website becomes source of truth for member communications (vs. email + Facebook scattered messages)**

**User Journey:**
1. **Week 1 Onboarding:** Learns mobile & desktop admin interface through tutorial
2. **Week 2 Core Usage:** Posts first website announcement (replacing email); receives immediate member comment; replies from phone
3. **Success Moment:** Member says "I saw your update on the website" (no email needed); Rabbi feels empowered
4. **Long-term:** Website is primary communication channel; Rabbi posts 1-2x weekly; inbox stays managed; members feel connected

---

#### **Persona 2A: David — Active Member**

**Profile:**
- Demographic: 68 years old, retired, member for 25+ years
- Engagement: Attends Friday services 3-4x per month; Torah study occasionally; volunteers on committees
- Visit frequency: Visits website 2-3x per week (checking schedule, browsing announcements)
- Device: Desktop at home; occasional mobile for quick checks
- Motivation: Stays connected to spiritual community; wants to know what's happening; doesn't want to miss events

**Current Pain Points:**
- Recorded services buried on Facebook; doesn't check Facebook often
- Can't easily find members-only calendar for committee meeting times
- No easy way to give online; last donated in-person
- Email from Rabbi sometimes gets lost in inbox

**Success Metrics:**
- Watches 2-3 recorded services per month (tracked via view count)
- Knows upcoming committee meeting times (from members-only calendar)
- Donates online 1x per month using recurring donation
- Receives notification when Rabbi replies to his message; responds within 48 hours
- **Visits website 2-3x weekly and finds what he's looking for in <1 minute**

**User Journey:**
1. **Discovery:** Logs in, sees this week's services + latest announcements in prominent location
2. **Regular Usage:** Watches Friday service live; catches up on Saturday Torah study recording Sunday morning
3. **Engagement:** Checks members-only calendar for committee meeting; donates $36/month recurring
4. **Connection Moment:** Sends question to Rabbi about an announcement; gets personal reply within hours; feels heard
5. **Long-term:** Website becomes his routine—part of weekly rhythm; gives regularly; attends 4x/month

---

#### **Persona 2B: Ruth — Casual Member**

**Profile:**
- Demographic: 72 years old, member for 15+ years
- Engagement: Attends High Holy Days + occasional Friday service (3-4x per year); mostly home-bound
- Visit frequency: Visits website 1-2x per month (usually for specific reason—when she wants to attend)
- Device: Desktop only; not comfortable with mobile
- Motivation: Spiritual connection; stays loosely connected to community; watches services from home due to mobility

**Current Pain Points:**
- Can't find service recording from 3 weeks ago (was sick, wants to catch up)
- Doesn't know when next service is; has to check Facebook or email
- Has never donated online; intimidated by process
- Website looks outdated and abandoned (doesn't encourage visit)

**Success Metrics:**
- Can find and watch a recorded service from the past month in <2 minutes
- Knows next service time from homepage at a glance (no scrolling)
- Completes one online donation during first visit (guided, simple process)
- Visits website 2-3x per month (up from 1x currently)
- **Feels like the community is active and welcoming (vs. seeing outdated site)**

**User Journey:**
1. **Trigger:** Wants to watch a service she missed; searches "Temple B'nai Israel"; lands on homepage
2. **Discovery:** Immediately sees service times and archive of recent recordings; feels community is alive
3. **Engagement:** Watches recorded service; reads Rabbi's latest announcement; feels current with community
4. **Conversion:** Donates $18 one-time in gratitude
5. **Long-term:** Visits 2-3x per month when she wants to attend or catch up; feels less isolated

---

#### **Persona 3A: The Garcia Family — Family with Children Visitor**

**Profile:**
- Demographics: Sarah (38) and Marco (40), two kids ages 8 & 10; interfaith family (Sarah is Jewish, Marco is Catholic)
- Motivation: Looking for welcoming Jewish community to raise kids in; want family-friendly environment
- Discovery: Google search for "temples near me" + "Jewish communities for families"
- Visit frequency: If they like it, would attend monthly then escalate to weekly/holiday
- Device: Mobile-first (searched at home, will browse on phone before visiting in person)

**Current Pain Points:**
- Old website doesn't look family-friendly or welcoming
- Can't tell if kids are involved (no mention of youth programs, holiday celebrations, etc.)
- No easy way to ask questions before showing up
- Can't see what a typical service looks like (no video)

**Success Metrics:**
- Lands on site and immediately understands "this is a welcoming Jewish community" (visual + messaging)
- Watches a recorded Friday service to get a feel for the community
- Sends message: "We're new to the area; are kids welcomed at services?" Gets warm reply from Rabbi within 24 hours
- Attends next Friday service
- **Converts to members within 3 months; starts attending 2-3x per month with kids**

**User Journey:**
1. **Search:** Google → lands on modern homepage; sees "welcome families" messaging
2. **Exploration:** Watches recorded service video; sees family-friendly announcements; reads about community
3. **Consideration:** Sends message via website: "Are we welcome? Do you have a youth group?"
4. **Connection:** Rabbi replies warmly; provides details; invites them to come
5. **Conversion:** Attends Friday service; feels welcomed; kids enjoy; return next week
6. **Loyalty:** Becomes active member; kids join youth programs; donates regularly

---

#### **Persona 3B: Jake — Seeker/Spiritual Explorer Visitor**

**Profile:**
- Demographics: 35 years old, single, agnostic/questioning spirituality
- Motivation: Exploring Judaism as spiritual path; curious about community; no pressure to join
- Discovery: Friend recommendation ("you should check out this temple") + website visit
- Visit frequency: Browsers casually; if feels right, might attend monthly then escalate
- Device: Mobile (initial browse) + desktop (if seriously considering attending)

**Current Pain Points:**
- Website doesn't answer "what is this community really about?"
- Can't watch a service without committing to show up in person
- Intimidated by potential judgment or barriers to entry
- Unclear if interfaith/questioning people are welcomed

**Success Metrics:**
- Watches recorded service without friction (understands community vibe, content, energy)
- Reads public announcements and community values without registration
- Sees message from Rabbi welcoming explorers/questioners specifically
- Sends message with a genuine question; gets thoughtful, non-judgmental response
- **Attends one service "to see what it's like"; feels safe as a beginner/explorer**

**User Journey:**
1. **Friend Recommendation:** Friend says "Check out Temple B'nai Israel's website"
2. **Exploration:** Lands on site; sees modern, open feel; reads community values
3. **Low-Friction Viewing:** Watches recorded service without account; sees people, hears content, feels community
4. **Consideration:** Feels interested but uncertain; sends message: "I'm exploring Judaism—is this the right place for someone like me?"
5. **Connection:** Rabbi replies warmly; acknowledges spiritual exploration is welcomed; no pressure; invites him to attend
6. **Conversion:** Attends next service; feels welcomed; continues exploring over months

---

### **Secondary User: Ilya — Admin/Moderator**

**Profile:**
- Role: Technical support lead, content moderator, Rabbi support, donations oversight
- Responsibilities: 
  - Moderate incoming visitor messages (filter spam, flag urgent)
  - Support Rabbi with technical issues
  - Monitor and manage donation data
  - Plan future features (Social Chair role, merch shop, etc.)
- Frequency: Daily checks; ~30 min/day ongoing maintenance

**Pain Points:**
- Currently no way to centralize moderation (messages scattered across email, Facebook)
- Can't see donation trends without manual tracking
- Needs audit trail of who posted what (for content accountability)
- No metrics on member/visitor engagement

**Success Metrics:**
- Moderates 10 incoming messages per week with clear spam/legitimate distinction
- Views donation dashboard to track trends (monthly recurring, one-time, anonymous)
- Sees content audit log (Rabbi posted X, when, edits history)
- Approves/flags visitor messages before Rabbi sees them (optional feature)
- **Site operations run smoothly with <30 min/day overhead**

**User Journey:**
1. **Daily Check-in:** Logs into admin dashboard; sees new messages, donation summary, site health
2. **Moderation:** Reviews 3-5 visitor messages; flags 1 spam, approves 2-3 for Rabbi to see
3. **Metrics Review:** Notes 2 new recurring donors; sees 150 views on recent recording
4. **Support:** Rabbi has a technical question about posting; Ilya helps resolve in 5 min
5. **Planning:** Monthly: reviews engagement metrics to inform Social Chair role or next feature

---

### **Negative Scenario: The Bouncer — Member Who Churns**

**Profile:**
- Name: Thomas, 58, member for 3 years, casual attendee (2-3x per year)
- Current state: Used to get email updates; checked old website occasionally

**Churn Scenario:**

1. **Week 1 (Post-Launch):** Thomas hears about new website; visits once
2. **Week 2:** No new announcements posted yet (Rabbi still ramping up); Thomas sees last update is 5 days old; assumes site is still abandoned; doesn't return
3. **Week 3:** Thomas misses a special High Holy Day announcement because he didn't see it on website; hears about it from someone else; feels out of the loop
4. **Week 4:** Decides "this site isn't working"; goes back to Facebook or asking friends for info; stops visiting website
5. **Week 5+:** Churn complete—Thomas no longer checks site; missed donation opportunity

**Prevention Metrics:**
- Rabbi posts announcement within **24 hours of launch** (not 2 weeks)
- Clear messaging that **"this is a live, active community"** from day one
- Auto-post upcoming services (don't rely on Rabbi remembering)
- Highlight recent recorded services on homepage (show activity)
- Email campaign to members: "Check out new website with live updates from Rabbi"
- **Goal: 80% of casual members visit site in first month; 50% return within 2 weeks**

---

## Success Metrics

### User Success Indicators

Users achieve their core outcomes when:

1. **Rabbi Sarah** posts website announcements 1-2x weekly (replacing email), spending <30 min/week on platform communications
2. **David (Active Member)** watches 2-3 recorded services monthly and completes recurring $36/month donation
3. **Ruth (Casual Member)** discovers and watches a past recording in <2 minutes and makes one online donation in first 3 months
4. **Garcia Family (Visitor)** watches a service recording, receives warm reply to message within 24 hours, and attends in-person service
5. **Jake (Seeker)** views a recorded service without account, asks thoughtful question, and receives welcoming response
6. **Ilya (Admin)** manages site operations in <30 min/day with clear moderation workflow and donation visibility

### Business Objectives

Temple B'nai Israel succeeds when:

1. **Revenue Recovery:** Online donations restored and growing from $0/month to $100-500/month within 12 months
2. **Growth:** Acquire 100 new engaged members in year 1 (defined as those who have watched ≥2 service recordings on the website)
3. **Retention:** Maintain 25% of casual members as active monthly visitors (prevent churn; goal: 25 of 50 casual members)
4. **Accessibility:** Enable homebound and remote members to participate in services and community life

### Key Performance Indicators (6-Month Launch Targets)

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Growth: New Engaged Members** | 50 new members with 2+ recording views | Google Analytics + member tracking |
| **Growth: Visitor-to-Member Conversion** | 10% of website visitors attend a service | Attendance tracking + website attribution |
| **Revenue: Monthly Donations** | $150/month average (ramp from $0) | PayPal integration dashboard |
| **Revenue: Recurring Donors** | 5-10 recurring monthly donors | Donation system tracking |
| **Engagement: Recording Views** | 400-600 views/month of recorded services | YouTube/embedded video analytics |
| **Engagement: Live Viewers** | 50-75 live viewers per Friday service | Facebook Live viewer count |
| **Engagement: Message Volume** | 40-50 visitor/member messages/month | In-app message system |
| **Engagement: Member Visit Frequency** | 25% of casual members visiting monthly | Website analytics (session tracking) |
| **Operational: Rabbi Content Time** | <30 min/week on platform communications | Time tracking (Rabbi self-report OK) |
| **Operational: Message Response Time** | 80% of messages replied to within 24 hours | Message timestamps in system |
| **Churn Prevention: Casual Member Retention** | 25 of 50 casual members active monthly | Monthly active user tracking |
| **Site Health: Downtime** | 99.5% uptime | Hosting provider metrics |

### Launch Readiness Gates (Week 1-2 Post-Launch)

To prevent churn, measure:

- ✅ Rabbi posts announcement within 24 hours of launch (not 2 weeks)
- ✅ Upcoming services auto-published and visible on homepage
- ✅ At least 3 recent service recordings available on day one
- ✅ Email campaign sent to all members: "Check out new website"
- ✅ First visitor message responded to within 12 hours

**Success at 6 months:** 50+ new members with 2+ views, $150/month donations, 25+ casual members checking in monthly → Product is working.

**Success at 12 months:** 100 new engaged members, $300-400/month donations, site is Rabbi's primary communication channel, community feels active.

---

## MVP Scope

### Core Features (Phase 1 - 3 Month Timeline)

**Homepage & Service Hub:**
- Modern, welcoming homepage with temple mission, service times, upcoming events
- Unified streaming hub: embedded Facebook Live (no login required) + archive of recorded services
- Service discovery: searchable/filterable by date; easy access to past recordings
- "About the Temple" + "Contact Us" pages

**Rabbi Content Management:**
- Special user admin interface (non-technical) on desktop and mobile
- Post announcements (appears on homepage + email to members)
- Manage public calendar (service times, holidays, events)
- Manage members-only calendar (private meetings, closed events)
- View donation metrics dashboard (monthly totals, recurring donors, trends)
- Read and reply to visitor/member messages in unified inbox
- Onboarding tutorial for all features

**Community Engagement:**
- Visitor messaging: CAPTCHA-protected contact form; Rabbi receives and replies in-app
- Member login: access to private calendar, members-only announcements, service recordings
- Email notifications: when Rabbi replies to message, when new recording posted

**Giving & Donations:**
- PayPal integration (one-time donations)
- PayPal recurring/subscription donations
- Anonymous giving option
- Automated tax receipt generation (PDF email)
- Admin dashboard showing donation data (you + Rabbi can view)

**Technical Foundation:**
- Mobile-responsive design (desktop, tablet, phone)
- Self-hosted on temple Linux server (Ilya manages maintenance, patches, security)
- Local PostgreSQL database
- Cloud storage backup strategy (cloud storage for secure backups)
- SSL/HTTPS encryption (Let's Encrypt, free)
- Open source codebase (GitHub or similar; temple owns all code)

### Out of Scope for MVP (Phase 2+)

- Merch shop / e-commerce
- Jewish holiday calendar auto-integration
- Social Chair role (future admin enhancement)
- Member profiles / community portal
- Advanced analytics (beyond basic view/donation tracking)
- Push notifications
- Native mobile app
- Video self-hosting (relying on Facebook API only)
- Multi-language support
- Accessibility testing beyond WCAG 2.1 AA standards

### MVP Success Criteria

**Technical:**
- Site deploys successfully on temple hardware with automated backups
- 99% core feature uptime (excluding 5G internet outages)
- All pages load in <3 seconds on typical broadband
- HTTPS/SSL working correctly
- PayPal integration processing donations securely

**User Adoption:**
- Rabbi posts first announcement within 24 hours of launch
- At least 3 recorded services available on launch day
- 50%+ of members visit site in first week
- First 10 visitor messages received and replied to within 48 hours

**Business Impact:**
- $150+ in donations received in first month (cumulative trend)
- At least 5 members using recurring donation
- 50+ new recording views in first 2 weeks
- 25+ live viewers on Friday service within first month

**Decision Point to Scale Beyond MVP:**
- If 30+ recorded service views/week and $100+/month donations by month 3 → continue and expand features
- If <15 views/week or <$50/month → reassess, but continue operations (organic growth acceptable)
- Either way: maintain MVP as stable baseline for Phase 2 enhancements

### Future Vision (Phase 2 & Beyond)

**Post-MVP Roadmap:**
- **Q2-Q3 2026:** Merch shop (temple-branded items, simple Shopify integration)
- **Q3 2026:** Jewish holiday calendar (auto-sync with URJ/Hebrew Calendar API)
- **Q4 2026:** Social Chair role (distribute content creation from Rabbi to board member)
- **2027:** Member profiles, community forum, event RSVP system
- **2027+:** Advanced analytics, mobile app, multi-language support, interfaith content library

**Scaling Considerations:**
- Infrastructure: If traffic grows significantly, migrate to low-cost cloud ($100-200/year) while keeping local as backup
- Team: Social Chair role reduces Rabbi overhead; potential for volunteer tech coordinator
- Ecosystem: API for member portal, calendar sync to Google/Outlook, Slack integration for announcements

**Strategic Vision:**
- By end of 2027: Temple website is *the* authoritative source for all temple info + community engagement
- Members feel connected whether attending in-person or remotely
- Donors trust the giving platform and increase contributions
- Young families find Temple B'nai Israel as welcoming, modern, active community
- Visitors experience temple as vibrant and engaged (not abandoned)

---

## Implementation Plan

### Development Estimate

**Solo Development (Ilya, $200/hr):**

| Phase | Hours | Estimate |
|-------|-------|----------|
| Infrastructure/auth/server setup | 50h | $10,000 |
| Homepage + UI framework | 30h | $6,000 |
| Facebook Live embed + service archive | 40h | $8,000 |
| Rabbi admin interface (posting, calendar, donations) | 50h | $10,000 |
| Visitor messaging + CAPTCHA | 30h | $6,000 |
| PayPal integration | 40h | $8,000 |
| Members login + private content | 35h | $7,000 |
| Mobile responsive refinement | 25h | $5,000 |
| Admin dashboard (moderation, donations, audit) | 35h | $7,000 |
| Testing/QA/bug fixes | 40h | $8,000 |
| Deployment + launch prep | 20h | $4,000 |
| Contingency (15% buffer) | 65h | $13,000 |
| **TOTAL** | **~480 hours** | **~$94,000** |

**Timeline:** 480 hours ÷ 35 hours/week = **~14 weeks = 3.5 months** (tight but feasible)

### Infrastructure & Costs

**Year 1:**
- Development: $94,000 (one-time)
- Cloud storage backup: $20-50/year
- Domain name: $12/year
- **Total Year 1: ~$94,100**

**Year 2+:**
- Cloud storage: $20-50/year
- Domain: $12/year
- **Ongoing: ~$40/year** (minimal)

### Success Metrics (6-Month Review)

By end of Month 6:
- ✅ 50+ new engaged members (2+ recording views each)
- ✅ $150+/month average donations (recurring + one-time)
- ✅ 400-600 recording views/month
- ✅ 25 casual members visiting monthly
- ✅ Rabbi spending <30 min/week on platform
- ✅ <2 minute response time for urgent messages

If metrics met: proceed to Phase 2. If not: continue MVP, improve based on user feedback, reassess in another 3 months.
