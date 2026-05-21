---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
inputDocuments: 
  - source: "Product Brief"
    path: "product-brief-web-temple-2026-01-31.md"
    type: "product-brief"
workflowType: 'prd'
documentCounts:
  productBriefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 0
classification:
  projectType: "Hybrid Static Website + Real-Time Web Application"
  domain: "Nonprofit/Faith Community with Payment Processing"
  complexity: "Medium"
  projectContext: "Greenfield"
  keyConcerns:
    - "Data integrity and security"
    - "Real-time streaming infrastructure (Facebook simultaneous)"
    - "PCI compliance for payment processing"
    - "Live chat capabilities"
---

# Product Requirements Document - web-temple

**Author:** Ilya
**Date:** 2026-02-01
**Project:** Temple B'nai Israel Website Modernization

---

## Executive Summary

**Vision:** Modernize Temple B'nai Israel's digital presence by replacing a 10-year-old abandoned website with a modern, rabbi-empowered platform that restores community engagement and donation revenue.

**Problem:** Rabbi lacks website control, broken PayPal blocks donations, services scattered across Facebook, casual members churn from lack of engagement.

**Solution:** Unified web platform combining static content (homepage, calendar, archive) with real-time features (Facebook Live, live chat, donations). MVP launches in 13-14 weeks (470 hours) with Facebook-only streaming. YouTube added in Phase 2.

**Innovation:** Unified live chat system welcomes non-social-media members, closing inclusion gap. Website becomes primary community hub instead of Facebook dependency.

**Success Metrics (6 Months):**
- 40-50 new engaged members (watched 2+ services)
- $120-150/month donations
- 10-20 concurrent live chat users (Month 1) → 30-50 (Month 6)
- 80% message response rate within 24 hours
- 95% uptime (self-hosted target)

**Development Estimate:** 470 hours (~$94,000 at $200/hr), 13-14 weeks (35 hrs/week solo development)

---

## Document Structure

This PRD covers:
1. **Success Criteria** (p.XX) — User and business success targets
2. **Product Scope** (p.XX) — MVP feature set, Phase 2/3 roadmap
3. **Development Estimate** (p.XX) — Effort breakdown and timeline
4. **User Journeys** (p.XX) — 8 persona narratives revealing requirements
5. **Domain Requirements** (p.XX) — PCI compliance, streaming, nonprofit context
6. **Innovation & Differentiation** (p.XX) — Unified live chat system
7. **Web-App Architecture** (p.XX) — MPA to SPA migration, API-first design
8. **Project Scoping** (p.XX) — MVP strategy, early adopter validation
9. **Functional Requirements** (p.XX) — 118 capabilities across 18 areas
10. **Non-Functional Requirements** (p.XX) — Performance, security, reliability, scalability, maintainability, integrations

---

## Success Criteria

### User Success Indicators

Users achieve their core outcomes when:

1. **Rabbi Sarah** posts announcements 1-2x weekly, spending <30 min/week on platform communications; replies to 80% of messages within 24 hours
2. **David (Active Member)** watches 2-3 recorded services monthly and completes recurring donations
3. **Ruth (Casual Member)** discovers and watches a service recording in <2 minutes; feels welcomed and returns monthly
4. **Garcia Family (Visitor)** watches a service, receives warm reply to message within 24 hours, attends in-person
5. **Jake (Seeker)** views recorded service without account, gets thoughtful response to his question, attends
6. **Ilya (Admin)** manages site operations in <30 min/day with clear moderation and donation visibility
7. **Live Chat Viewers** can chat with all live-stream participants (Facebook + YouTube + website visitors) in unified interface

### Business Success Metrics (6-Month Targets)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **New engaged members** | 40-50 (watched 2+ recordings) | Analytics + member tracking |
| **Monthly donations** | $120-150/month average | PayPal dashboard |
| **Recurring donors** | 5-10 monthly donors | Donation system |
| **Recording views** | 300-400 views/month | Video analytics |
| **Live service viewers** | 40-60 Friday viewers | Facebook Live + YouTube counts |
| **Live chat concurrent users** | 10-20 (Month 1) → 30-50 (Month 6) | Chat system metrics |
| **Visitor messages** | 30-40/month | In-app message system |
| **Message response time** | 80% replied within 24 hours | Message timestamps |
| **Casual member retention** | 20-25% visiting monthly | Website analytics |
| **Site uptime** | 99.5% (excluding 5G outages) | Hosting/monitoring |

### Technical Success Requirements

- ✅ Simultaneous broadcast: Facebook Live + YouTube (both live at service time)
- ✅ Live chat stable for 10-20 concurrent users (Month 1), scale to 30-50 (Month 6)
- ✅ PCI compliance for PayPal payment processing
- ✅ All pages load in <3 seconds on typical broadband
- ✅ Automated cloud backups with recovery capability
- ✅ HTTPS/SSL encryption for all data
- ✅ Audit logs for donations and admin actions

### Launch Readiness Gates (Week 1-2)

Success launch requires:
- ✅ In-person announcement at Friday Shabbat service (day 1-2)
- ✅ Email blast to full mailing list (day 1-2)
- ✅ Rabbi posts 3+ announcements + 1+ recorded service (week 1)
- ✅ "Donations" tab prominently visible on homepage
- ✅ Live chat stable during first Friday service broadcast
- ✅ First 5 visitor messages responded to within 12 hours

**If launch gates achieved → on track. If not → adjust expectations but continue operations.**

---

## Product Scope

### MVP - Phase 1 (Launch, 3-Month Timeline)

**Homepage & Service Hub:**
- Modern homepage with mission, service times, upcoming events
- Unified service hub: Facebook Live embedded (no login), YouTube simultaneous broadcast, service archive (searchable by date)
- "About the Temple" and "Contact Us" pages

**Rabbi Content Management:**
- Mobile + desktop admin interface (non-technical)
- Post announcements (appears on homepage + email to members)
- Manage public calendar (service times, events)
- Manage members-only calendar (private meetings)
- View donation metrics dashboard
- Read and reply to visitor/member messages in unified inbox
- Onboarding tutorial for all features

**Community Engagement:**
- Visitor messaging: CAPTCHA-protected contact form
- **Live chat during services (50-100 potential users, 10-20 expected Month 1)**
- Member login: access private calendar, members-only announcements
- Email notifications: message replies, new recorded services

**Giving & Donations:**
- **Prominent "Donations" tab on homepage**
- PayPal integration (one-time + recurring donations)
- Anonymous giving option
- Automated tax receipt generation (PDF email)
- Donation metrics dashboard

**Technical Foundation:**
- Mobile-responsive design (phone, tablet, desktop)
- Self-hosted on temple Linux server (Ilya manages)
- Local database + cloud storage backups
- SSL/HTTPS encryption (Let's Encrypt)
- Open source codebase (GitHub)
- **YouTube simultaneous streaming (alongside Facebook)**

### Phase 2 - Growth Features (Q3 2026+)

- Merch shop (e-commerce)
- Jewish holiday calendar auto-integration (free API)
- Social Chair role (content distribution)
- Advanced analytics dashboard
- Push notifications for announcements
- Member profiles / community portal
- RSVP for events

### Out of Scope for MVP

- Native mobile app (web-responsive only)
- Video self-hosting (Facebook/YouTube APIs only)
- Multi-language support
- Member discussion forum
- Automated donation reminders

---

## Development Estimate

**Revised for YouTube Simultaneous Streaming (+20h):**

| Phase | Hours | Cost |
|-------|-------|------|
| Infrastructure/auth/server | 50h | $10,000 |
| Homepage + UI | 30h | $6,000 |
| Facebook Live + YouTube simultaneous + archive | 60h | $12,000 |
| Rabbi admin interface | 50h | $10,000 |
| Visitor messaging + CAPTCHA | 30h | $6,000 |
| PayPal integration | 40h | $8,000 |
| Members login + private content | 35h | $7,000 |
| Live chat implementation | 30h | $6,000 |
| Mobile responsive | 25h | $5,000 |
| Admin dashboard | 35h | $7,000 |
| Testing/QA/bugs | 40h | $8,000 |
| Deployment/launch | 20h | $4,000 |
| Contingency (15%) | 75h | $15,000 |
| **TOTAL** | **~500 hours** | **~$100,000** |

**Timeline:** 500 hours ÷ 35 hours/week = ~14.3 weeks (3.5 months, tight but feasible)

---

## User Journeys

### Journey 1: Rabbi Sarah — From Isolated to Empowered

**Opening Scene:**
Rabbi Sarah spends Friday morning managing emails, phone calls, and Facebook messages about service details and community questions. Frustrated by scattered communication channels and lacking control over the website narrative, she feels dependent on external developers rather than empowered to lead digitally.

**Rising Action:**
The new website launches. Sarah posts her first announcement about this week's Torah portion in under 3 minutes (vs. 20 minutes for email). It appears on the homepage instantly. A member comments: "I saw this on the website!" She realizes—*the website feels real, and I control it.* 

Later, a visitor messages asking about bringing children to services. Sarah replies directly in the app. The conversation flows naturally, and the visitor shows up Friday night feeling welcomed.

**Climax:**
By week two, Sarah hasn't sent an email in 7 days. All announcements now live on the website. Members reference things they read there. She views the donation dashboard and watches three recurring gifts process—each from a familiar name in her congregation. She feels connected to real impact.

**Resolution:**
Sarah's role shifts from email manager to content leader. She posts 1-2x weekly. Her message inbox gives her direct feedback on what people care about. She feels empowered, independent, and deeply connected to her congregation. The website is hers to shape.

**Key Requirements Revealed:**
- Simple, non-technical admin interface (mobile + desktop)
- Fast announcement posting and publishing
- Unified messaging inbox (visitors + members)
- Donation visibility (see who's giving)
- Calendar and event management
- Mobile-friendly posting experience
- Message notifications (alerts when people respond)

---

### Journey 2: David — From Facebook Hunter to Weekly Routine

**Opening Scene:**
David, 68 and retired, attends services 3-4x per month and wants to stay connected. The problem: recorded services are buried in Facebook's feed with no organization. Finding them is friction. He wants convenience without hunting.

**Rising Action:**
David discovers the new website and bookmarks it. Friday evening he attends services in person. The next morning, he receives an email: "New Recording Available: Saturday Torah Study." He clicks. There's the morning study he missed. He watches with coffee.

The following week, he gets another notification. He realizes: *I don't have to search for this anymore.* He notices the "Donations" tab and thinks about his monthly giving habit. He sets up $36/month recurring donation.

**Climax:**
By week three, David checks the website twice weekly—once for Friday service recordings, once for announcements. He receives a notification that Rabbi Sarah replied to his question about an upcoming holiday. They have a brief conversation. He feels genuinely heard and connected.

**Resolution:**
The website becomes part of David's weekly rhythm. He checks it habitually, donates monthly without friction, and attends more consistently because staying plugged in digitally keeps him engaged. He experiences the community as active and welcoming.

**Key Requirements Revealed:**
- Organized service recording archive with search/filtering
- Email notifications (new content alerts)
- Messaging system (ask questions, get personal replies)
- Recurring donation capability
- Public calendar and event listings
- Mobile access for convenient browsing

---

### Journey 3: Ruth — From Isolated to Included

**Opening Scene:**
Ruth, 72 and homebound some weeks due to mobility, attends 3-4 times yearly. The old website felt sterile—just listing service times. She felt disconnected from the congregation, watching from the periphery.

**Rising Action:**
Ruth hears about the new website and visits on a Tuesday. She immediately sees "Latest Service Recording: Friday 7pm Shabbat" with a play button. She clicks. There's Rabbi Sarah, the community voices, familiar faces. She watches the entire service and cries—*I'm still part of this, even at home.*

Three days later, she gets an email: "New Recording Available: Saturday Torah Study." She watches and reads recent announcements. The temple feels alive to her.

**Climax:**
Ruth messages: "Thank you for doing this. It means so much to feel connected." Rabbi Sarah replies personally within 24 hours: "Ruth, we're grateful you're part of our community. Your presence matters." Ruth donates $18 as a thank you.

**Resolution:**
By month two, Ruth visits 2-3x monthly, watches services, donates occasionally when moved, and attends one service in person after seeing it advertised on the website. She feels included, not left out. The distance between her home and temple shrinks.

**Key Requirements Revealed:**
- Easy-to-find service archive
- Accessible video playback (no login required)
- Email notifications
- Simple messaging (feel heard)
- Clear donation button
- Public announcements (feel community vitality)
- Tablet/mobile-friendly interface

---

### Journey 4: The Garcia Family — From Searching to Belonging

**Opening Scene:**
Sarah (38, Jewish) and Marco (40, interfaith) moved to the area seeking a welcoming Jewish community for their two children (8 & 10). Sarah's Google search for "Jewish temple near me" finds the old Temple B'nai Israel website, which looks abandoned. They're hesitant.

**Rising Action:**
The new website launches. Sarah searches again. The difference is immediate: modern design, clear "We welcome families of all backgrounds" messaging, a video of a recent service with children singing and laughing. She watches the video with Marco and the kids. She has a question: "Do kids participate? Is this interfaith-friendly?" She clicks "Message the Rabbi." 

The next morning, Rabbi Sarah replies personally: "Yes! We love having kids. Come this Friday at 7pm. I'll introduce myself."

**Climax:**
Friday night, the Garcias arrive. Rabbi Sarah greets them by name, remembering their message. During services, they see families with kids throughout. After, they're invited to oneg (refreshments) and feel genuinely welcomed—not like outsiders, but like expected community members.

**Resolution:**
They commit to attending twice monthly, then escalate. The kids ask when the next service is. Sarah donates online monthly. The website was the gateway—it showed them who the temple was before they risked showing up.

**Key Requirements Revealed:**
- Modern, welcoming visual design
- Service videos showing real community (pre-attendance confidence)
- Direct messaging system
- Quick Rabbi responsiveness (warm, personal replies)
- Clear calendar and next-service visibility
- Mobile-first design (initial search on phone)
- Email reminders and announcements
- Family-friendly messaging and content

---

### Journey 5: Jake — From Curious to Committed

**Opening Scene:**
Jake, 35 and exploring spirituality, has Jewish heritage he wants to reconnect with. A friend recommends Temple B'nai Israel. Skeptical but curious, Jake searches for the temple. The old website told him when services happen but nothing about community, values, or whether explorers are welcomed. No connection point.

**Rising Action:**
The new website launches. Jake finds it, sees "We welcome spiritual explorers and questioners," and feels seen. He watches a recorded service without logging in, seeing real people and hearing the Rabbi speak about doubt being welcome. 

Jake asks a vulnerable question via messaging: "I'm agnostic but exploring Judaism. Is this the right place for me?" Rabbi Sarah replies the next day: "Jake, spiritual exploration is exactly what we're about. You're welcome here, no pressure. Come Friday at 7pm."

**Climax:**
Friday night, Jake attends. Rabbi Sarah finds him afterward: "What did you think?" Jake: "I felt welcome. I have more questions than answers." She smiles: "Perfect. That's where many of us are." They talk for 15 minutes. Jake feels permission to keep exploring.

**Resolution:**
Jake attends twice monthly over the next three months. Still agnostic, still exploring, but he feels part of something real. The website was permission—proof that explorers like him are genuinely welcome before having to show up in person.

**Key Requirements Revealed:**
- Welcoming, values-centered homepage messaging
- Service videos accessible without login
- Public announcements showing community values
- Messaging system for vulnerable questions
- Personal Rabbi responsiveness
- Clear service time and calendar
- Mobile-friendly browsing

---

### Journey 6: Ilya — From Overwhelmed to In Control

**Opening Scene:**
Ilya manages the technical side. Before the website, messages scattered across email, Facebook DMs, phone calls. Donation data was manual. No visibility into engagement. He felt stretched managing multiple platforms for the Rabbi.

**Rising Action:**
The website launches. Ilya logs into the admin dashboard and sees everything unified: messages inbox, donation dashboard with live trends, audit logs of all actions. Within the first week, he handles five visitor messages (flags 1 spam, approves 3, escalates 1 urgent)—in 10 minutes, a task that would have taken an hour scattered across platforms.

**Climax:**
Month one review. Ilya checks the dashboard: 12 new recurring donors, 150 service views, 40 visitor messages, 99.7% uptime. He realizes: *The website is working. I can see the impact, and it's manageable.*

**Resolution:**
By month three, Ilya spends <30 min/day on operations. He checks dashboards, handles moderation efficiently, monitors for issues, and plans Phase 2. He feels informed and in control instead of reactive and overwhelmed.

**Key Requirements Revealed:**
- Admin dashboard (unified operations view)
- Message moderation interface
- Donation tracking and metrics
- Audit logs (accountability and history)
- Monitoring/alerts (downtime notifications)
- Analytics (views, engagement tracking)
- User/role management
- Simple navigation for non-technical oversight

---

### Journey 7: Social Chair (Phase 2) — From Bottleneck to Distributed Leadership

**Opening Scene (Month 4, Post-MVP):**
Rabbi Sarah is now the content bottleneck. The board decides to add a "Social Chair" role—a board member who can post announcements and manage the public calendar without accessing technical panels or donation data.

**Rising Action:**
Miriam, the new Social Chair, gets trained. She logs in to a simplified admin interface (just announcements + public calendar). She posts about an upcoming board meeting, adds a volunteer opportunity announcement. She feels like she's contributing to the community narrative.

**Climax:**
After two weeks, the website has 3-4 announcements weekly (vs. 1-2 before). Members comment: "I love seeing what's happening. The temple feels active." The Rabbi feels relief—she's no longer the sole voice.

**Resolution:**
By month six, having a Social Chair distributes the content load. The website is updated regularly without burning out the Rabbi. The community experiences more voices and perspectives.

**Key Requirements Revealed (Phase 2):**
- Role-based permissions (Social Chair vs. Rabbi vs. Admin)
- Simplified admin interface (limited to specific capabilities)
- Audit trail (see who posted what, when)
- Announcement scheduling (post later, not just now)
- Calendar co-management

---

### Journey 8: Thomas — The Bouncer (Churn Scenario)

**Opening Scene:**
Thomas, 58, has been a casual member for 3 years. He attends 2-3 times yearly. He hears about the new website.

**Week 1:**
Thomas visits the site. It looks modern. He sees the next Friday service and bookmarks it.

**Week 2:**
Thomas checks again, expecting announcements or updates. The last one is from 6 days ago. He thinks, *The Rabbi is ramping up. Fair enough.* He waits.

**Week 3:**
Thomas learns about a special High Holy Day event from a friend—not from the website. Annoyed, he checks the site. Still only the 9-day-old announcement. He thinks: *This site still isn't working. It's like the old one.*

**Week 4 - Point of No Return:**
Thomas stops checking the website. He goes back to word-of-mouth and occasional emails. He doesn't donate. He misses announcements. He's churned.

**Resolution - Month 2:**
Thomas no longer trusts the website. He'll likely never check it again unless heavily pushed. The temple missed a donation and engagement opportunity because momentum died Week 1-2.

**Critical Success Factor Revealed:**
This journey shows why launch readiness gates are non-negotiable:
- **Week 1-2 momentum is everything.** If Rabbi doesn't post within 48 hours, casual members assume it's another dead project.
- **Email + in-person announcement required.** Passive discovery isn't enough for adoption.
- **Content pipeline must be pre-loaded.** Auto-populate upcoming services and past recordings on day one so the site never looks empty.

---

## Journey Requirements Summary

The eight journeys collectively reveal these critical capability areas:

**Homepage & Onboarding:**
- Modern, welcoming design
- Clear mission and values
- Service times immediately visible
- Tailored welcome messages (members vs. visitors vs. explorers)

**Content & Archive:**
- Service recording archive with search
- Latest announcements prominently featured
- Public and members-only calendars
- Video playback without login required

**Engagement & Community:**
- Unified inbox for all messages (visitors + members)
- CAPTCHA-protected visitor contact form
- Email notifications (messages, new content)
- Live chat during services (50-100 user capacity)
- Members-only announcements and calendar access

**Donations & Giving:**
- Prominent "Donations" tab (homepage navigation)
- One-time and recurring giving options
- Anonymous donation capability
- Automated tax receipt generation

**Leadership & Operations:**
- Admin dashboard (metrics, messages, donations)
- Simple content posting interface (for Rabbi + Social Chair)
- Role-based permission system
- Audit logs (accountability and history)

**Technical Foundation:**
- Mobile-responsive across all devices
- Fast load times (<3 seconds)
- SSL/HTTPS encryption
- 99.5% uptime reliability
- YouTube + Facebook simultaneous streaming
- Live chat infrastructure (concurrent users)

**Launch Success Factors (to prevent churn):**
- Pre-coordinated content pipeline with Rabbi
- Email announcement blast on day 1-2
- In-person announcement at Shabbat service (day 1-2)
- Daily posts for first 2 weeks minimum
- Pre-populated service archive on launch day

---

## Domain-Specific Requirements

### Payment Processing & PCI Compliance

**Requirement:** Handle donations securely with PCI-DSS compliance
- **Implementation:** PayPal Payments Standard (PayPal handles PCI burden; we don't store card data locally)
- **Audit Trail:** Log all donation transactions (who, when, amount, recurring vs. one-time)
- **Security:** All payment data encrypted in transit (HTTPS/TLS); no card storage on server
- **Tax Compliance:** Track donation dates for tax year reporting (Jan 1 - Dec 31 cycles); automated receipt generation with date

**Phase 1 Scope:**
- PayPal integration handles payment security
- Donation audit logs stored in database
- Tax receipts auto-generated with donation date for donor records

### Data Integrity & Security

**Requirement:** Protect member and donor privacy; maintain data integrity
- **Member Data:** Email addresses, giving history stored in encrypted database
- **Backup Strategy:** Daily automated cloud storage backups (with recovery capability)
- **Audit Logs:** Track all admin actions (who posted what, when; who viewed metrics)
- **Access Control:** Role-based permissions (Rabbi, Treasurer, Social Chair, Admin have different access levels)

**Phase 1 Scope:**
- Standard database encryption (AES-256 or similar)
- Cloud storage daily backups (not real-time)
- Audit trail for admin actions and donations
- No separate member email encryption (Phase 2 enhancement)

### Real-Time Streaming & Resilience

**Requirement:** Broadcast simultaneously to Facebook Live and YouTube; handle API failures gracefully
- **Streaming Architecture:** RTMP ingest to both Facebook and YouTube simultaneously (or sequential if simultaneous RTMP not supported)
- **API Failure Handling:** 
  - Auto-retry on temporary API failures (exponential backoff, 3 retries)
  - If either platform fails permanently during stream, display visible error message to viewers: "We're experiencing technical difficulties. Please try refreshing or visiting our Facebook page."
  - Gracefully terminate stream if both APIs are unreachable
- **Fallback:** If YouTube streaming unavailable, fall back to Facebook-only with notification; never stream to neither
- **Live Chat:** Runs on website independently (not dependent on Facebook/YouTube APIs for messaging)

**Phase 1 Scope:**
- Simultaneous broadcast to Facebook + YouTube with auto-retry
- Visible error messaging if either platform fails
- Live chat independent from streaming (always available)

### Nonprofit & Community Context

**Requirement:** Support nonprofit operations and community trust
- **Donor Anonymity:** Allow donors to give without identifying (anonymous option at checkout)
- **Inclusive Design:** Welcome messaging for interfaith families, LGBTQ+ members, spiritual explorers
- **Community Values:** No aggressive fundraising; giving is optional and appreciated
- **Volunteer-Friendly:** Admin interface designed for non-technical volunteers (Rabbi, Social Chair)

**Phase 1 Scope:**
- Anonymous donation option in PayPal integration
- Welcoming homepage copy (interfaith + inclusive language)
- Simple admin interfaces for non-technical staff
- Community-first tone (not commercial)

### Technical Requirements Summary

**Security:**
- HTTPS/TLS for all data in transit
- Database encryption at rest (AES-256)
- PCI-DSS compliance via PayPal
- Audit logs for all sensitive actions
- Regular backups with recovery testing

**Reliability:**
- 99.5% uptime target
- Auto-retry logic for streaming APIs
- Graceful degradation (stream error vs. site error)
- Cloud backup recovery capability

**Data Handling:**
- Donation date tracking for tax compliance
- Member data privacy (email, giving history)
- Donation audit trail
- Tax receipt generation with dates

**Real-Time Features:**
- Live streaming (Facebook + YouTube, auto-retry)
- Live chat (50-100 concurrent capacity)
- Email notifications (real-time where possible)

---

## Innovation & Competitive Differentiation

### Core Innovation: Unified Live Chat System

**Problem Identified:**
Members without Facebook or YouTube accounts are excluded from real-time community participation during live services. Current approaches fragment the audience:
- Facebook Live chat: only accessible to Facebook users
- YouTube chat: only accessible to YouTube users
- Website-only users: cannot participate in real-time community moments

**Innovative Solution:**
Implement a unified live chat system where:
- Website visitors can post comments (no social media account required)
- Comments from website, Facebook, and YouTube are aggregated and visible across all platforms
- Moderation is centralized (Rabbi/Admin approves/manages all comments in one interface)
- Real-time community emerges as unified experience, not fragmented audiences

**Competitive Advantage:**
1. **Inclusivity:** Lower barrier to participation (no account requirement for website chat)
2. **Audience Reach:** Rabbi reaches people on their preferred platform (Facebook, YouTube, website) while maintaining unified community
3. **Community First:** Members experience themselves as *one community* participating together, not separate audiences per platform

### Market Context

**Current nonprofit/faith community landscape:**
- Most temples/nonprofits stream to **one platform** (usually Facebook, rarely YouTube)
- Those streaming to multiple platforms: **comments are fragmented** (users confused about where to comment)
- Few faith communities prioritize **inclusive participation** for non-social-media users
- Most treat website as **secondary** (social media is primary)

**Your Differentiation:**
- **Multi-platform streaming** with unified moderation (rare for small nonprofits)
- **Website-first experience** for members without social media
- **Intentional inclusivity** (recognizing real members who avoid or don't have social accounts)
- **Tech-forward + member-centric** positioning (rare for faith communities)

### Validation Approach

**How we'll know if innovation works:**

1. **Live Chat Adoption:**
   - Month 1 Target: 5-10 website comments per service (vs. 0 currently)
   - Month 6 Target: 15-25 website comments per service
   - Metric: Comments from non-Facebook users (prove inclusion is working)

2. **Inclusive Participation:**
   - Track members who participate via website chat but don't have Facebook accounts
   - Measure: % of comments from website-only users
   - Goal: 20-30% of comments come from website (non-social-media participants)

3. **Community Cohesion:**
   - Feedback: Do members feel like one community or separate groups?
   - Measure: Post-service feedback about "feeling included" in real-time moments
   - Goal: Members without Facebook feel equally included

4. **Audience Expansion:**
   - New members discovering temple via YouTube (not Facebook)
   - Measure: Analytics showing YouTube referrals
   - Goal: 10-15% of new visitors come from YouTube discovery

### Risk Mitigation

**Risk 1: Low adoption of website chat (people prefer Facebook/YouTube)**
- Mitigation: Prominent chat placement on website, tutorial in onboarding
- Fallback: Even if low adoption, it's available for underserved members

**Risk 2: Moderation burden (aggregating comments from 3 sources)**
- Mitigation: Simple moderation interface in admin dashboard
- Fallback: Can disable website comments if moderation becomes unmanageable

**Risk 3: Technical complexity (aggregating live comments across platforms)**
- Mitigation: Start simple (website chat only), add Facebook/YouTube aggregation in Phase 2
- Fallback: Website chat independent from social platforms (always works even if APIs fail)

**Risk 4: Members confused about where to comment**
- Mitigation: Clear messaging ("Your comments appear everywhere" on homepage)
- Fallback: Provide simple instructions in Shabbat bulletin

### Implementation Strategy

**Phase 1 (MVP):**
- Website-based live chat system (independent of Facebook/YouTube)
- Comments visible on website during live service
- Manual moderation by Rabbi/Admin in unified dashboard
- Clear messaging: "Comment here and be part of the live community"

**Phase 2 (Growth):**
- Integrate Facebook Live comments into website display
- Integrate YouTube comments into website display
- Show all comments in chronological order across platforms
- Expand moderation tools (auto-filter spam, pinned comments, etc.)

---

## Web-App Architecture Deep Dive (Step 7)

### Architecture Strategy: API-First MPA with Phase 2 SPA Migration

**Phase 1 (MVP) - Multi-Page App (MPA) Foundation:**
- Server-rendered pages for homepage, about, calendar, recordings archive
- Modern JavaScript framework (Node.js + Express backend)
- Real-time modules (live chat, notifications) built as isolated interactive components
- Explicit REST/GraphQL API endpoints serving JSON from `/api/` routes
- Smart caching strategy: render on-demand, cache for 1 hour, invalidate on Rabbi posts

**Critical Decision:** API-first architecture from day one. All data accessed via JSON endpoints. This decouples frontend rendering from data logic, enabling Phase 2 migration without backend rewrite.

**Phase 2 (Growth) - Progressive SPA Migration:**
- Migrate from MPA to React/Vue SPA architecture
- Client-side routing replaces server-side page loads
- Existing API endpoints work unchanged (no backend modification needed)
- Page-by-page migration (homepage first, then interior pages)
- Estimated additional 80-100 hours for full migration

**Deployment Advantage:** Smart caching on self-hosted server is simpler than SSG. Server renders pages on-demand, caches with 1-hour TTL. Cache invalidates when Rabbi posts new announcement. Same performance outcome as SSG, easier to manage on temple Linux server, no separate build step required.

### Real-Time Architecture: Refined Hybrid Approach

**Live Chat (WebSocket - Low Latency Required):**
- Bidirectional WebSocket connection for real-time messaging
- Message delivery target: <500ms from send to display
- Fallback: graceful downgrade to polling if WebSocket fails
- Connection pooling for 50-100 concurrent users
- Auto-reconnect with exponential backoff

**Notifications (Polling - Resilience Optimized):**
- Poll every 5-10 seconds during active use (not background)
- Check for: message replies, new service recordings, announcements
- Server load: ~6-12 requests per user per minute (trivial)
- More resilient for users on slow connections or older devices
- In-app toast notifications supplementary; email is primary channel

**Rationale:** WebSocket excels where user actively expects real-time (chat). Polling is more resilient for background notifications. Separate concerns = simpler debugging and maintenance.

### Accessibility: WCAG 2.1 Level AA (Launch) + AAA (Phase 2)

**Phase 1 (MVP) - WCAG AA Compliance:**
- Color contrast: 4.5:1 minimum
- Font sizes: 16px minimum for body text
- Large text support: 200% zoom without horizontal scrolling
- Keyboard navigation: all features accessible via Tab, Enter, arrow keys
- Touch targets: 44px minimum for mobile accessibility
- Captions: all service recordings with burned-in or WebVTT captions
- Semantic HTML: proper heading hierarchy, ARIA labels, form labels
- Screen reader optimization: skip navigation, alt text for images
- Focus indicators: visible 3px outline on all interactive elements

**Why AA at Launch:** AA covers core accessibility needs. Implementation is realistic within 500-hour timeline. Real member needs (captions, keyboard nav, large text) are met.

**Phase 2 (Growth) - WCAG AAA Enhancement:**
- Enhance contrast: 7:1 ratio (vs. 4.5:1 for AA)
- Expanded captions: for all audio content (not just video)
- Enhanced focus indicators: more prominent 4px outlines
- Real user testing: collaborate with visually/aurally impaired members
- Cognitive accessibility: expanded plain language, simplified forms

**Testing Strategy:** WAVE accessibility checker (weekly), axe DevTools (automated CI/CD), manual keyboard navigation testing, real user feedback from congregation members.

### Browser & Device Support

**Supported Browsers:**
- Chrome/Chromium (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions, macOS and iOS)
- Edge (latest 2 versions)
- Mobile: Chrome Mobile, Safari iOS

**Deliberately Excluded:**
- Internet Explorer 11 (2013 technology, not worth compatibility cost)

**Device Testing Priorities:**
- iPhone 12+ (validate iOS, Safari mobile, touch interactions)
- Android phones (Android 10+, Chrome Mobile)
- iPad/Android tablets (responsive layout, portrait/landscape)
- Older devices validation: iPhone 8, older Android (test contrast, text readability)

**Rationale:** Modern browsers represent 99% of user base for congregation. Real device testing on current hardware validates actual member experience. Focus on responsiveness across screen sizes (375px mobile through 1920px desktop) rather than browser coverage.

### Performance Targets

- **Homepage:** <2 seconds first contentful paint
- **Archive/interior pages:** <3 seconds initial load
- **SPA transitions (Phase 2):** <1 second page change
- **Live chat load:** <500ms WebSocket connection
- **Video archive:** Progressive loading (lazy-load video thumbnails)

**Caching Strategy:** Homepage + calendar cached 1 hour. Archive cached 24 hours. Chat/notifications bypass cache (real-time). Invalidate cache on Rabbi posts, admin updates.

### Implementation Priorities (Phase 1)

1. **Semantic HTML structure** (enables accessibility + SEO + caching)
2. **Smart caching layer** (Redis or in-memory)
3. **API-first design** (all data from `/api/` endpoints)
4. **Mobile-first responsive CSS**
5. **WebSocket chat implementation**
6. **WCAG AA testing** (WAVE, keyboard nav, screen reader)
7. **Real device testing** (iPhone, Android, tablets)

### Tech Stack Recommendations

**Backend:**
- Node.js + Express (WebSocket-friendly, lightweight)
- PostgreSQL (data persistence, transactions)
- Redis (caching, message queue for live chat)
- Socket.io (WebSocket + fallback polling)

**Frontend (Phase 1 - MPA):**
- Vanilla JavaScript + lightweight libraries (Stimulus, HTMX)
- No heavy framework overhead
- Progressive enhancement (works without JavaScript)

**Frontend (Phase 2 - SPA Migration):**
- React or Vue (choose based on team preference)
- Client-side routing (react-router, vue-router)
- State management (Redux/Pinia for real-time features)

**Hosting:**
- Self-hosted on temple Linux server
- Managed by Ilya (technical support responsibility)
- Docker recommended for easy deployment/updates

**Monitoring & Quality:**
- Lighthouse CI/CD integration (performance, accessibility, SEO)
- Cross-browser testing (BrowserStack)
- Real device testing (iPhone, Android)
- Uptime monitoring (Pingdom or similar)

### Architecture Decision Summary

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **MVP Architecture** | API-first MPA with smart caching | Fast launch, enables SPA migration |
| **Real-Time Strategy** | WebSocket (chat) + Polling (notifications) | Low latency where needed, resilience otherwise |
| **Accessibility** | WCAG AA launch, AAA Phase 2 | Realistic timeline, core needs met at launch |
| **Caching** | Smart on-demand caching (not SSG) | Simpler self-hosted deployment |
| **Browsers** | Modern only, real device testing | 99% coverage, validate on actual member devices |
| **Performance** | <2s homepage, <3s pages | Meets user expectations on 5G connection |
| **Phase 2 Path** | SPA migration via existing APIs | No backend rewrite needed, smooth transition |

---

## Project Scoping & Phased Development (Step 8)

### MVP Philosophy: Problem-Solving

**Core Focus:** Solve Rabbi's operational isolation and restore community engagement infrastructure. Success = Rabbi empowered to manage website independently, donations working, members finding services.

**Early Adopter Strategy:** Rabbi + Temple Board internal validation (Week 1-2), public launch Week 3 (after confidence established).

**MVP Scope Philosophy:** Features valued by operational impact, not polish. Simple working features beat beautiful broken ones. Validate core assumptions before adding advanced capabilities.

---

### Phase 1 (MVP) - 13-14 Weeks, ~470 Hours

**MUST-HAVE Features for MVP:**

**Homepage & Service Hub:**
- Modern homepage with temple mission, service times, welcome messaging
- Facebook Live embedded (no login required) during Shabbat services
- Service recording archive (searchable by date, latest first)
- "About the Temple" and "Contact Us" pages
- Clear next-service countdown

**Rabbi Empowerment (Core Pain Point):**
- Mobile + desktop admin interface (intentionally simple, non-technical)
- Post announcements (appears on homepage + email to members immediately)
- Manage public calendar (service times, events, holidays)
- Manage members-only calendar (private meetings, board discussions)
- View donation metrics dashboard (total, recurring donors, trends)
- Read and reply to visitor/member messages in unified inbox
- Built-in onboarding tutorial (teach Rabbi each feature)

**Community Engagement:**
- Visitor messaging: CAPTCHA-protected contact form
- **Live chat during services** (website-based, 10-20 concurrent users, no social media account required)
- Member login: access private calendar, members-only announcements
- Email notifications: message replies, new recorded services, announcements

**Donations (Revenue Pain Point):**
- **Prominent "Donations" tab on homepage navigation**
- PayPal integration (one-time + recurring donations)
- Anonymous giving option (donate without identifying)
- Automated tax receipt generation (PDF emailed immediately)
- Donation dashboard for Rabbi/Ilya (see donors, track trends)

**Technical Foundation:**
- Mobile-responsive design (mobile-first: 375px → tablet 768px → desktop 1200px)
- WCAG AA accessibility (captions, keyboard navigation, screen reader support, 4.5:1 contrast)
- Self-hosted on temple Linux server (Ilya manages)
- SSL/HTTPS encryption (Let's Encrypt)
- Local PostgreSQL database + daily cloud backups
- Open-source codebase (GitHub for transparency)

**DELIBERATELY OMITTED FROM MVP:**
- ❌ YouTube simultaneous streaming (add Phase 2, 20 hours)
- ❌ Live comment aggregation from Facebook/YouTube (Phase 2)
- ❌ Merch shop (Phase 2)
- ❌ Social Chair role (Phase 2, after Rabbi stabilizes)
- ❌ Member profiles / community portal (Phase 2)
- ❌ Push notifications (Phase 2, email is primary)
- ❌ Advanced analytics dashboard (Phase 2)

**Why Facebook-Only Launch?** Simplifies streaming to proven platform. YouTube addition in Phase 2 builds on stable foundation. Validates demand before expanding platform coverage.

**Why Live Chat Included?** It's the innovation differentiator. Without it, website is just Facebook Live link—no advantage over existing presence. With it, non-social-media members feel included.

---

### Development Breakdown: MVP Estimate

| Component | Hours | Notes |
|-----------|-------|-------|
| Infrastructure (API, auth, server setup) | 50h | API-first design for Phase 2 migration |
| Homepage + UI design | 30h | Modern, responsive, welcoming design |
| Facebook Live + archive | 40h | Streaming, 4+ week recording history, search |
| Rabbi admin interface | 50h | Announcements, calendar, message inbox, dashboard |
| Visitor messaging + CAPTCHA | 25h | Contact form, email notifications, moderation |
| PayPal integration | 40h | One-time + recurring, tax receipts, audit logs |
| Member login + private content | 35h | Authentication, members-only pages |
| Live chat (website-only) | 25h | WebSocket, 20 concurrent users, moderation |
| Mobile responsive design | 25h | Across all pages, tablet + phone testing |
| Admin dashboard | 35h | Donation metrics, message moderation, user analytics |
| Testing/QA/bugs | 35h | Cross-browser, accessibility, real device testing |
| Deployment + launch | 20h | Server setup, DNS, SSL certificates |
| Contingency (15%) | 60h | Buffer for unknowns |
| **TOTAL** | **~470 hours** | **~$94,000 at $200/hr** |

**Timeline:** 470 hours ÷ 35 hours/week = **13.4 weeks** (realistic 13-14 week delivery)

---

### Phase 1 Success Criteria

MVP is successful when:

**Technical Readiness:**
- ✅ Rabbi posts 3+ announcements independently in Week 1
- ✅ Live chat stable with 15+ concurrent users during Friday service
- ✅ PayPal accepts test donations (one-time + recurring)
- ✅ Email notifications deliver within 2 minutes
- ✅ Site loads in <2 seconds on 5G connection
- ✅ WCAG AA accessibility validated (keyboard nav, screen reader, captions)
- ✅ 99.5% uptime during first 2 weeks

**Adoption Readiness:**
- ✅ Board approves public launch (Rabbi comfortable + features working)
- ✅ Email list ready for announcement (200+ addresses)
- ✅ In-person announcement scheduled (Friday Shabbat service, Week 2)
- ✅ Pre-loaded content: 4+ recent service recordings, calendar populated

**Engagement Readiness:**
- ✅ First visitor message replied within 12 hours
- ✅ First 5 donors thanked personally by Rabbi
- ✅ Live chat moderation plan documented (Rabbi approval)

---

### Phase 2 (Months 4-6): Growth Features

**YouTube Simultaneous Streaming** (20 hours)
- Add YouTube Live alongside Facebook
- Auto-retry logic for both platforms
- Streaming resilience: graceful error messaging if either fails

**Live Chat Enhancement** (15 hours)
- Comment visibility from Facebook Live (if feasible)
- Comment visibility from YouTube (if feasible)
- Expanded moderation tools (pinned messages, user roles)

**Member Engagement** (30 hours)
- Social Chair role (board member can post announcements independently)
- Advanced analytics dashboard (views, engagement trends)
- Email campaign templates (for Rabbi to send updates)

**Additional Revenue** (40 hours)
- Merch shop (basic e-commerce: t-shirts, books, etc.)
- Donation giving tiers (recognize recurring givers)

**Total Phase 2:** ~105 hours (3 weeks additional development)

---

### Phase 3 (Post-Month 6): Expansion

**Member Platform** (60 hours)
- Member profiles with privacy controls
- RSVP for events
- Member-to-member messaging
- Community portal (resources, event history)

**Automation & Integration** (40 hours)
- Jewish holiday calendar auto-sync
- Automated donation reminders (opt-in)
- SMS notifications
- Calendar export (Google Calendar, iCal)

**SPA Migration** (80 hours)
- Full migration from MPA to React/Vue
- Client-side routing (faster page transitions)
- Offline support (cache service recordings)
- Progressive Web App (installable on home screen)

**Total Phase 3:** ~180 hours (5+ weeks of additional development)

---

### MVP Coverage of User Journeys

| Journey | MVP Supported | Key Feature |
|---------|---------------|------------|
| Rabbi Sarah (Isolated → Empowered) | ✅ Full | Admin interface, announcement posting, donation visibility |
| David (Facebook Hunter → Weekly Routine) | ✅ Full | Recording archive, email notifications, recurring donations |
| Ruth (Isolated → Included) | ✅ Full | Service recordings accessible, email updates, donation button |
| Garcia Family (Searching → Belonging) | ✅ Full | Welcoming homepage, service video, messaging Rabbi |
| Jake (Curious → Committed) | ✅ Full | Service watchable without account, messaging system |
| Ilya (Overwhelmed → In Control) | ✅ Full | Unified dashboard, moderation, <30 min/day operations |
| Social Chair (Bottleneck → Distributed) | ⚠️ Phase 2 | Not in MVP; added after Rabbi stabilizes |
| Thomas (Churn Prevention) | ✅ Full | Launch momentum, content velocity, notification emails |

**All primary user journeys supported by MVP. Social Chair capability moves to Phase 2.**

---

### Success Metrics: MVP Achievable Targets

| Metric | Target | MVP Enables? |
|--------|--------|-------------|
| **New engaged members** | 40-50 | ✅ Yes (homepage discovery + email marketing) |
| **Monthly donations** | $120-150 | ✅ Yes (prominent button + easy PayPal) |
| **Recurring donors** | 5-10 | ✅ Yes (one-click recurring setup) |
| **Recording views** | 300-400/month | ✅ Yes (searchable archive + notifications) |
| **Live service viewers** | 40-60/Friday | ✅ Yes (Facebook Live embedded) |
| **Live chat concurrent users** | 10-20 (M1) | ✅ Yes (website-based chat) |
| **Message response time** | 80% within 24h | ✅ Yes (unified inbox) |
| **Site uptime** | 99.5% | ✅ Yes (reliable self-hosted setup) |

**All success metrics achievable with MVP scope.**

---

### Critical Success Factors (Beyond Features)

**1. Launch Momentum (Weeks 1-2):**
- In-person announcement at Friday Shabbat service
- Email blast to full mailing list (200+ members)
- Rabbi posts 3+ announcements before public launch
- Pre-loaded content: 4+ recent service recordings, populated calendar

**2. Rabbi Adoption:**
- Internal validation Week 1-2 (Rabbi uses admin interface daily)
- Rabbi feels empowered, not dependent on Ilya
- Onboarding tutorial makes self-sufficient
- Board members approve before public launch

**3. Live Chat Stability:**
- Tested with 20+ concurrent users before launch
- Moderation plan clear (auto-filters, spam handling)
- Rabbi trained on moderation interface

**4. Operational Sustainability:**
- Ilya can manage <30 min/day operations indefinitely
- Dashboard provides full visibility (no surprises)
- Automated backups validated (recovery tested)

**If these factors fail, engagement targets miss. If these succeed, targets likely achieved.**

---

## Functional Requirements (Step 9)

### Overview

**Purpose:** Functional Requirements define the complete capability contract for the product. Every feature, design decision, and implementation task must map to an FR. UX designers, architects, and developers will only build what's listed here.

**Total: 118 Functional Requirements** across 15 capability areas

---

### Capability Area 1: Homepage & Service Discovery

- **FR1:** Public visitors can view the homepage with temple mission statement, service times, and upcoming events
- **FR2:** Public visitors can see the next upcoming service with a countdown timer
- **FR3:** Members can view a public calendar of all temple services and events
- **FR4:** Members can access a searchable archive of past service recordings organized by date
- **FR5:** Members can filter recording archive by date range, Torah portion, or service type
- **FR6:** Public visitors can view an "About the Temple" page with community values and welcome message
- **FR7:** Public visitors can access a "Contact Us" page with messaging form

### Capability Area 2: Facebook Live Streaming (MVP)

- **FR8:** Authorized users can schedule and broadcast Facebook Live during services
- **FR9:** Public visitors can view embedded Facebook Live stream directly on the website without login
- **FR10:** The website displays stream status (live, upcoming, offline) with clear messaging
- **FR11:** If Facebook Live stream becomes unavailable, visitors see graceful error message directing them to alternative
- **FR12:** Rabbi can manually publish recorded services to the archive after livestream ends
- **FR13:** Each recording displays service date, Rabbi, Torah portion (if applicable), and duration

### Capability Area 3: Live Chat During Services

- **FR14:** Website visitors can post messages in live chat during active Facebook service broadcast (no account required)
- **FR15:** Live chat displays messages in real-time with poster name and timestamp
- **FR16:** Chat messages are moderated (approved by Rabbi/Ilya before appearing)
- **FR17:** Moderators can delete inappropriate messages from chat history
- **FR18:** Chat supports up to 20 concurrent users with <500ms message delivery
- **FR19:** Chat persists during service (logs available after for member review)
- **FR20:** If WebSocket connection fails, chat degrades to polling every 3 seconds. User sees "Slow connection mode" indicator but can still send and receive messages

### Capability Area 4: Member Authentication & Access Control

- **FR21:** Visitors can register as members via email + password on the website
- **FR22:** Members can log in with email + password to access members-only content
- **FR23:** Members can reset forgotten passwords via email link
- **FR24:** Authorized users (Rabbi, Admin, Treasurer, Social Chair when added) can log in to admin interface
- **FR25:** Admin role can see all metrics, messages, and content across the site
- **FR26:** Rabbi role can post announcements, manage calendars, reply to messages, view donations
- **FR27:** Social Chair role (Phase 2) can post announcements and manage public calendar only (does not have permission to moderate chat or view donations)
- **FR27b:** Treasurer role can access the donation dashboard, view donation logs, and view MTD/YTD totals, but has no access to announcements, calendars, or messages
- **FR28:** Member sessions time out after 30 days of inactivity (security)

### Capability Area 5: Announcement Management (Rabbi Core Feature)

- **FR29:** Rabbi can write and post announcements visible on homepage immediately
- **FR30:** Announcements appear in chronological order (newest first) on homepage
- **FR31:** Rabbi can edit published announcements after posting
- **FR32:** Rabbi can delete announcements (removed from homepage, not from archive)
- **FR33:** Announcement posts trigger automatic email to all members with "New Announcement" subject
- **FR34:** Members can opt in/out of announcement emails
- **FR35:** Announcements can include text, images, and links
- **FR111:** Rabbi can mark an announcement as "featured" to pin it to the top of the homepage for up to 30 days

### Capability Area 6: Calendar Management (Public & Members-Only)

- **FR36:** Rabbi can create and edit public calendar events (service times, holidays, events)
- **FR37:** Rabbi can create members-only calendar events (board meetings, private classes)
- **FR38:** Public calendar is visible to all visitors (no login required)
- **FR39:** Members-only calendar is only visible to logged-in members
- **FR40:** Calendar events show date, time, title, and description
- **FR41:** Calendar events can include a Zoom link or meeting location (optional)
- **FR42:** Members receive email notification when new events added to calendar
- **FR43:** Calendar displays next 3 months of events + past 1 month archive
- **FR87:** Members receive email reminders for calendar events 24 hours before event start time, including event title, time, location/Zoom link, and ical attachment

### Capability Area 7: Visitor & Member Messaging

- **FR44:** Public visitors can submit a message via "Contact Us" form with CAPTCHA protection
- **FR45:** Visitor messages are queued in Rabbi's inbox with visitor name and email
- **FR46:** Rabbi can read and reply to visitor messages directly from admin dashboard
- **FR47:** Visitor receives email reply when Rabbi responds to their message
- **FR48:** Members can send messages to Rabbi/community through a member-only message form
- **FR49:** All messages are logged with timestamps for accountability
- **FR50:** Admin can view all messages (visitor + member) in unified inbox
- **FR109:** Live chat requires poster name (member can log in or anonymous visitor can enter name). Name displays with each message

### Capability Area 8: Donations & Giving (Revenue Pain Point)

- **FR51:** Public visitors can see prominent "Donations" tab on main navigation
- **FR52:** Donations page explains giving options and suggests donation levels ($18, $36, $100+)
- **FR53:** Visitors can make one-time donations via PayPal (no account required)
- **FR54:** Visitors can set up recurring monthly donations via PayPal
- **FR55:** Donors can choose to give anonymously (no name/email tracking)
- **FR56:** Donors receive automated tax receipt via email after donation (PDF with donation date)
- **FR57:** Rabbi/Admin can view donation dashboard with total donated, donor count, recurring donors
- **FR58:** Donation dashboard shows month-to-date and year-to-date totals
- **FR59:** All donations are logged with date, amount, donor email (if not anonymous), recurring status
- **FR60:** Rabbi receives email notification when major donation (>$100) is received
- **FR115:** Tax receipts include donation date, amount, donor name (if not anonymous), confirmation of tax-deductible status per IRS guidelines, and temple EIN
- **FR118:** If PayPal payment fails, user sees clear error message and can retry immediately. Failed payment attempt is logged for review. Repeat failures (3+) trigger admin alert

### Capability Area 9: Admin Dashboard & Operations (Ilya Core Feature)

- **FR61:** Admin dashboard displays 6 key metrics on load: new members (this month), total donations (this month), active live chat users (current), pending messages, system uptime (%, last 24h), and last backup timestamp
- **FR62:** Admin can view analytics: page views, recording views, live chat users, donation trends
- **FR63:** Admin can access moderation queue (pending messages, chat messages to approve)
- **FR64:** Admin can set system-wide notifications (maintenance alerts, system status)
- **FR65:** Admin can view audit logs of all sensitive actions (donations, admin edits, message deletions)
- **FR66:** Admin dashboard is accessible from desktop and mobile browsers
- **FR67:** Admin receives email alerts for critical issues (PayPal error, spam detected). Note: Outage monitoring and downtime email alerts must be offloaded to external third-party services (e.g., Uptime Robot) rather than the local web server itself.
- **FR116:** Audit logs record: all announcements posted/edited/deleted (user, timestamp, before/after text), all calendar changes, all donation records, all admin logins, password changes, and user role changes

### Capability Area 10: Accessibility (WCAG AA)

- **FR68:** All pages support keyboard navigation (Tab, Enter, arrow keys) without mouse
- **FR69:** All images have descriptive alt text for screen readers
- **FR70:** All service recordings have captions (burned-in or WebVTT subtitle files)
- **FR71:** All interactive elements have visible focus indicators (3px outline visible on Tab)
- **FR72:** Text can be resized up to 200% zoom without horizontal scrolling
- **FR73:** Color contrast ratio meets 4.5:1 minimum (WCAG AA standard)
- **FR74:** Form labels are explicitly associated with inputs for screen readers
- **FR75:** Website has skip-to-main-content link for keyboard users
- **FR76:** Videos include audio descriptions for visually impaired users (Phase 2 enhancement; deferred, not in Phase 1 MVP)

### Capability Area 11: Mobile Responsiveness

- **FR77:** All pages render correctly on mobile phones (375px width and up)
- **FR78:** All pages render correctly on tablets (768px width and up)
- **FR79:** All pages render correctly on desktop (1200px width and up)
- **FR80:** Touch targets (buttons, links) are minimum 44px for mobile accessibility
- **FR81:** Navigation collapses to hamburger menu on mobile (<768px)
- **FR82:** Videos and images scale responsively without distortion
- **FR83:** Forms are touch-friendly (large input fields, mobile-optimized)

### Capability Area 12: Email Notifications (Non-Real-Time Communication)

- **FR84:** Members receive email when new service recording is published
- **FR85:** Members receive email when Rabbi replies to their message
- **FR86:** Members receive email when new announcements are posted
- **FR88:** All emails include unsubscribe link (allow members to opt out per email type)
- **FR89:** Donation thank-you emails are sent within 1 hour of donation
- **FR90:** Tax receipts are included in donation confirmation emails

### Capability Area 13: Content Management (Site Pages)

- **FR91:** Rabbi/Admin can view and edit static pages (About, Contact, policies)
- **FR92:** Static pages support rich text formatting (bold, italic, links, images)
- **FR93:** Static pages can be published and unpublished without deletion
- **FR94:** Admin can view previous versions of any static page (up to 10 most recent versions). Can restore any previous version with one click. Timestamp shows when each version was created
- **FR95:** Pages are publicly visible once published, draft until published

### Capability Area 14: Data Integrity & Backup

- **FR96:** The system performs automated daily backups to cloud storage
- **FR97:** Database backups include all user data, messages, donations, settings
- **FR98:** Backup restore can be tested without affecting live site
- **FR99:** Rabbi/Admin can view last backup timestamp and status
- **FR117:** Website displays latest 52 weeks of recordings; older recordings available on request

### Capability Area 15: Security & Compliance

- **FR100:** All data is encrypted in transit via HTTPS/TLS
- **FR101:** Database is encrypted at rest (AES-256)
- **FR102:** Sensitive audit logs (donations, admin actions, messages) are stored securely
- **FR103:** Password reset tokens expire after 24 hours
- **FR104:** Admin sessions automatically log out after 30 minutes of inactivity
- **FR105:** PayPal payment processing delegates PCI compliance to PayPal (no card data stored locally)
- **FR106:** Contact forms include CAPTCHA to prevent spam submissions
- **FR113:** System flags likely spam messages using simple heuristics (all caps, external links, repeated identical messages). Admin can auto-delete marked spam or review first

### Capability Area 16: Onboarding & Settings (Refined from Critique)

- **FR107:** Rabbi receives in-app guided onboarding tour when first logging in, covering announcement posting, calendar management, and message inbox
- **FR108:** Members can access account settings page to manage notification preferences (announcements, calendars, messages) and update profile information

### Capability Area 17: Service Recording Management (Refined from Critique)

- **FR110:** After service ends, Rabbi can publish recording from admin dashboard. Once published, recording is immediately visible in archive to all members within 5 minutes
- **FR114:** Recording archive search supports date range, keyword search (title/description), and service type filters. Results show thumbnail, date, and description

### Capability Area 18: Live Chat User Experience (Refined from Critique)

- **FR112:** If live chat disconnects, user sees "connection lost" indicator and can reconnect with one click. Unsent message is preserved in text field

---

## Functional Requirements Summary

**Total: 118 Functional Requirements** across 15+ capability areas

### Coverage Validation

**Against MVP Scope:**
- ✅ Homepage & Discovery (FR1-7): Complete
- ✅ Facebook Live (FR8-13): Complete
- ✅ Live Chat (FR14-20, FR112): Complete with UX improvements
- ✅ Member Auth (FR21-28): Complete
- ✅ Announcements (FR29-35, FR111): Complete with featured capability
- ✅ Calendars (FR36-43, FR87): Complete with reminder detail
- ✅ Messaging (FR44-50, FR109): Complete with chat identification
- ✅ Donations (FR51-60, FR115, FR118): Complete with tax compliance and error handling
- ✅ Admin Dashboard (FR61-67, FR116): Complete with specific metrics and audit detail
- ✅ Accessibility (FR68-76): Complete WCAG AA
- ✅ Mobile Responsive (FR77-83): Complete
- ✅ Email Notifications (FR84-86, FR88-90): Complete
- ✅ Content Management (FR91-95): Complete with version control
- ✅ Data & Backup (FR96-99, FR117): Complete with recording archival
- ✅ Security & Compliance (FR100-106, FR113): Complete with spam filtering
- ✅ Onboarding (FR107-108): New—critical for Rabbi adoption
- ✅ Recording Management (FR110, FR114): Refined workflow details
- ✅ Live Chat UX (FR112): Refined disconnection handling

**Against Success Metrics:**
- ✅ New members discovery: FR1-7 (homepage), FR84 (notifications), FR114 (search)
- ✅ Donations: FR51-60 (donation flow), FR115 (receipts), FR118 (error handling)
- ✅ Recording views: FR4-5 (archive), FR114 (search), FR84 (notifications)
- ✅ Live chat: FR14-20, FR112 (user experience)
- ✅ Rabbi empowerment: FR29-43 (posting, calendar, dashboard), FR107 (onboarding)

**Against User Journeys:**
- ✅ Rabbi Sarah: FR29-43, FR107 (empowerment + onboarding)
- ✅ David: FR4-5, FR84, FR53-54 (archive, notifications, recurring donations)
- ✅ Ruth: FR4, FR84, FR55 (home access, notifications, anonymous giving)
- ✅ Garcia Family: FR1, FR9, FR44-47 (homepage, messaging, responsiveness)
- ✅ Jake: FR9, FR44-47 (service without login, messaging)
- ✅ Ilya: FR61-67, FR116 (dashboard, audit logs, moderation)
- ✅ Thomas churn prevention: FR33 (announcements trigger emails), FR86 (email notifications)

---

## FR Critique Outcomes

**Gaps Closed:**
1. ✅ Onboarding tutorial → FR107
2. ✅ Account settings/preferences → FR108
3. ✅ Chat poster identification → FR109
4. ✅ Recording publication workflow → FR110
5. ✅ Announcement pinning → FR111
6. ✅ Chat disconnect handling → FR112
7. ✅ Spam filtering → FR113
8. ✅ Recording archive search → FR114
9. ✅ Tax receipt details → FR115
10. ✅ Audit log specificity → FR116
11. ✅ Recording archival policy → FR117
12. ✅ Payment failure handling → FR118

**Clarifications Made:**
1. ✅ FR20: Chat polling frequency (3 sec) and indicator
2. ✅ FR61: 6 specific dashboard metrics
3. ✅ FR87: Members-only, email reminder, ical attachment
4. ✅ FR94: 10 versions stored, timestamps visible

**This FR list is now complete and ready for design and implementation.**

---

## Non-Functional Requirements (Step 10)

### Performance Requirements

**NFR-P1: Homepage Load Time**
- Homepage must load and display primary content (mission statement, service times, countdown) in <2 seconds
- Measured on 5G connection (typical 10 MB/s download)
- Tested using Lighthouse performance audit

**NFR-P2: Live Chat Message Delivery**
- User-typed messages must appear in recipient's chat window in <2 seconds
- Includes real-time WebSocket delivery + server processing
- Measured from send button click to message visibility on recipient's screen

**NFR-P3: Recording Archive Filtering**
- Filtering and search results (by date, keyword, service type) must return in <2 seconds
- Accepts backend processing time
- Pagination: load next 10 recordings in <1 second

**NFR-P4: Recording Publication Delay**
- Service recordings published by Rabbi should appear in archive within <5 minutes of clicking "Publish"
- Accounts for transcoding, cloud upload, and database update
- Target: ideally <2 minutes, acceptable up to 5 minutes

**NFR-P5: Admin API Response Time**
- Admin operations (post announcement, update calendar, reply to message) must complete in <1 second
- Measured from API request to client confirmation
- Includes database write + notification trigger

**NFR-P6: Page Load (All Pages)**
- All pages load to first contentful paint in <3 seconds (acceptable performance)
- Admin dashboard loads initial data in <2 seconds

---

### Security Requirements

**NFR-S1: Data Encryption in Transit**
- All data transmitted between client and server uses HTTPS/TLS 1.2 or higher
- Let's Encrypt certificates, auto-renewed
- Applies to all endpoints (public, authenticated, admin)

**NFR-S2: Data Encryption at Rest**
- Database encrypted at rest using AES-256 encryption
- Backup files encrypted with AES-256
- Encryption keys managed securely (not hardcoded in source)

**NFR-S3: Password Policy**
- Enhanced password requirements:
  - Minimum 12 characters
  - Must contain: uppercase, lowercase, numbers, special characters
  - No dictionary words or common patterns
  - No password reuse (last 5 passwords checked)

**NFR-S4: Session Management**
- Admin/authenticated sessions timeout after 30 minutes of inactivity
- No IP whitelisting (allows admin access from anywhere on 5G)
- Session tokens stored securely (HTTPOnly, Secure cookie flags)
- Multi-factor authentication reserved for Phase 2 (not MVP)

**NFR-S5: Personally Identifiable Information (PII) Minimization**
- Minimize PII stored locally. Prefer delegating to third parties:
  - Payment data: delegated to PayPal (no credit cards stored locally)
  - Email addresses: required for member login + notifications only
  - Donation amount: stored (essential for business), PII optional
- Do NOT store: phone numbers, physical addresses, social security numbers (unless explicitly needed)

**NFR-S6: Donation Data Security**
- All donation records encrypted at rest (including donor email, amount, date, recurring status)
- Access control: Only Rabbi, Treasurer, President, and Ilya (Admin) can view donation records
- Role-based access enforced at database query level
- Audit logging: every access to donation records is logged with user, timestamp, records viewed

**NFR-S7: Contact Forms & Spam Protection**
- CAPTCHA protection on all public contact forms (prevent automated spam)
- Server-side validation: all form submissions validated before accepting

**NFR-S8: Admin Access Audit Trail**
- All admin actions logged: username, action (post/edit/delete), timestamp, before/after state
- Logs accessible to Admin role only
- Logs cannot be deleted (append-only)

---

### Reliability & Uptime Requirements

**NFR-R1: Uptime Target**
- System targets 95% uptime (approximately 36 hours/month acceptable downtime)
- Realistic for self-hosted on 5G connection subject to internet outages
- Measured: availability of primary website + payment processing as monitored by an external third-party service (e.g., Uptime Robot)
- Excludes planned maintenance windows

**NFR-R2: Facebook Live Streaming Must Stay Up**
- Even if website is unavailable, Facebook Live broadcast must continue
- Streaming service is independent from website infrastructure
- If website goes down, Facebook Live viewers unaffected
- Website down ≠ broadcast failed

**NFR-R3: Critical Service Isolation**
- Graceful degradation: if one system fails, others remain operational
  - Website down → Facebook Live + Donations still work
  - Live chat down → Messaging + Website still work
  - Donations down → Website + Facebook Live still work
- Minimize cascading failures

**NFR-R4: Auto-Restart & Recovery**
- System automatically restarts after crash/power loss
- Graceful shutdown on errors (don't leave database in corrupted state)
- No manual intervention required for typical failures
- Ilya on-call during service broadcasts (Friday evenings) only

**NFR-R5: Downtime Communication**
- If website is down, informational page displays (if DNS/cache allows)
- Directs users to Facebook alternative
- No member data is at risk during downtime (read-only operations)

---

### Scalability Requirements

**NFR-Sc1: Concurrent Live Chat Users**
- System must support 20 concurrent live chat users without performance degradation
- Target: 30-50 concurrent users (Month 6)
- Maximum: 1000 concurrent users before implementing queue
- If users exceed 1000 concurrent, implement automated queue (FIFO, first-come-first-served)

**NFR-Sc2: Excessive Traffic Handling**
- If live chat exceeds 1000 concurrent users, display popup to excess users:
  - "We're at capacity! Please join us on Facebook Live or YouTube"
  - Direct link to Facebook Live
  - Direct link to YouTube (Phase 2)
- Queue overflow users with estimated wait time

**NFR-Sc3: Live Stream Viewers**
- Website displays Facebook Live viewer count (40-60 typical Friday)
- Support spike up to 200+ viewers during High Holy Days
- Facebook/YouTube handle viewer load (not self-hosted)
- Website handles display + metadata only

**NFR-Sc4: Video Storage Strategy**
- **Do NOT store video files locally** (too much storage/bandwidth)
- Use Facebook/YouTube as primary video hosts
- Store locally: video metadata only (title, date, duration, description, thumbnail URL)
- Archive older recordings: maintain YouTube/Facebook links, not local copies
- Reduces storage costs and bandwidth requirements

**NFR-Sc5: Database Growth**
- Estimated Members: 500-1000 total over 12 months
- Estimated Messages: 50-100 messages/week
- Estimated Donations: 100-200 donations/month
- Local PostgreSQL sufficient for MVP (self-hosted)
- Monitor database size and performance
- When database growth becomes bottleneck (query slowdowns), escalate to cloud migration conversation (not MVP)

---

### Maintainability Requirements (Solo Developer Focus)

**NFR-M1: Code Quality Standards**
- Clear, well-commented code (not just "self-documenting")
- Function/method comments explain WHY, not just WHAT
- Complex algorithms documented with pseudo-code or reasoning
- Consistent naming conventions throughout codebase

**NFR-M2: Automated Testing**
- Unit tests for critical business logic (authentication, payments, moderation)
- Integration tests for external service calls (PayPal, email, Facebook API)
- Test coverage target: >60% of critical paths
- CI/CD pipeline runs tests on every commit

**NFR-M3: Local Logging & Monitoring**
- Error logs: aggregated locally (not third-party cloud service)
- Performance monitoring: response times, database query times logged locally
- Access logs: admin login, sensitive actions logged locally
- Log retention: 30 days online, 1 year archived in backups
- All logs searchable and queryable locally

**NFR-M4: Open-Source Software Preference**
- Prefer well-maintained open-source libraries over proprietary
- Document rationale for each dependency (why it was chosen)
- Avoid single-author dependencies (prefer community-maintained)
- Minimize total dependencies to reduce complexity and maintenance burden

**NFR-M5: Operational Documentation**
- **Deployment Runbook**: step-by-step instructions for deploying code to temple server
- **Troubleshooting Guide**: common issues + solutions (site not loading, email not sending, donation failing)
- **Backup/Restore Procedure**: how to backup database, how to restore from backup
- **Escalation Contacts**: who to contact if things break (Rabbi, Board President, IT committee)
- All documentation hosted alongside source code (README, /docs folder)
- Written assuming successor will be non-technical (clear, no jargon)

**NFR-M6: Succession Planning**
- Code and documentation assume Ilya will eventually pass ownership
- Documentation includes "First-Time Setup" guide (not just maintenance)
- Architecture designed to be understandable by developer with 3-6 months prior experience
- Critical systems should not have single points of knowledge

---

### Integration Reliability Requirements

**NFR-I1: PayPal Payment Failures**
- If PayPal API is unavailable or payment fails:
  - User sees error banner: "We're having trouble processing donations. Please try again in a few moments or contact us."
  - Error message is user-friendly (not technical error codes)
  - User can retry donation immediately
  - Ilya receives alert email whenever PayPal API is unreachable or responding with errors
- Failed donation is logged for manual follow-up

**NFR-I2: Email Service Failures**
- If email service is unavailable:
  - Messages/notifications queued locally in database
  - System attempts retry every 5 minutes (exponential backoff up to 1 hour)
  - After 5 failed attempts, Ilya receives alert
- Email queue persists across restarts (not lost if server crashes)

**NFR-I3: Local Message Queue**
- Implement local message queue for non-critical notifications:
  - Announcement emails
  - Message reply notifications
  - New recording alerts
- If upstream service (email provider, Facebook) fails:
  - Messages stay in queue (not lost)
  - Automatic retry with exponential backoff
  - Manual retry available in admin dashboard
  - Prevents cascading failures

**NFR-I4: Facebook/YouTube Streaming Resilience**
- Facebook Live API failures: graceful error message to viewers, fallback to previous week's recording
- YouTube streaming API failures (Phase 2): fallback to Facebook-only with user notification
- Both platforms unavailable: informational message with link to prayer schedule alternative

**NFR-I5: Self-Hosted Broadcast Investigation (Phase 3)**
- Phase 2 may investigate self-hosted broadcast option (RTMP server, HLS stream)
- Would reduce dependence on Facebook/YouTube APIs
- Would allow full control over broadcast quality, archival, etc.
- Not MVP priority (Facebook + YouTube sufficient), but keep as future option

**NFR-I6: External Service SLA**
- PayPal: Standard SLA (99.5% uptime) is acceptable
- Email provider: Standard SLA acceptable
- No premium SLA required (cost not justified for nonprofit)

---

### Accessibility Requirements (WCAG 2.1 Level AA at Launch)

**NFR-A1: Keyboard Navigation**
- All interactive elements accessible via keyboard (Tab, Enter, arrow keys)
- No mouse required to use any feature
- Tab order logical and intuitive

**NFR-A2: Color Contrast**
- Text contrast ratio minimum 4.5:1 (WCAG AA)
- Tested using WAVE or axe DevTools
- Pass automated accessibility checks

**NFR-A3: Screen Reader Compatibility**
- All text content readable by screen readers (NVDA, JAWS, VoiceOver)
- Alt text for all images
- Form labels explicitly associated with inputs
- ARIA labels for dynamic content (chat messages, notification toasts)

**NFR-A4: Captions for Video**
- All service recordings include captions (WebVTT or burned-in)
- Captions accurate and synchronized with audio
- Cover not just dialogue, but important sounds (music, bell rings, etc.)

**NFR-A5: Text Zoom Support**
- Pages support 200% text zoom without horizontal scrolling
- Content reflow intelligently

**NFR-A6: Focus Indicators**
- All interactive elements show visible focus indicator (3px outline)
- Focus indicator has sufficient contrast against background

**NFR-A7: Mobile Accessibility**
- Touch targets minimum 44px (mobile-friendly)
- No hover-only interactions (mobile can't hover)
- Responsive design works on all screen sizes

---

## Non-Functional Requirements Summary

**6 Major Categories, 35+ Specific Requirements**

| Category | Key NFRs | Priority |
|----------|----------|----------|
| **Performance** | <2s homepage, <2s chat, <5min recording publish, <1s admin API | High |
| **Security** | HTTPS+AES-256, enhanced passwords, 30min timeout, minimize PII, audit logging | High |
| **Reliability** | 95% uptime target, Facebook Live isolation, graceful degradation, auto-restart | High |
| **Scalability** | 1000 concurrent chat users max, queue overflow, video metadata only (no storage) | Medium |
| **Maintainability** | Code quality, local logging, OOS preference, comprehensive documentation | Medium |
| **Integration** | PayPal failure handling, local message queue, SLA monitoring, self-hosted broadcast (Phase 3) | High |
| **Accessibility** | WCAG AA launch, keyboard nav, captions, contrast, screen readers | High |

**These NFRs are realistic for self-hosted nonprofit project while maintaining quality and security.**

---

## PRD Validation & Approval

**Expert Panel Review:** ⭐⭐⭐⭐ (Submission-Ready)

This PRD has been validated by cross-functional expert review (Product, Architecture, Development, Design) on 2026-02-01.

**Validation Status:** ✅ **APPROVED FOR DEVELOPMENT**

**Key Validation Points:**
- ✅ Scope is clear and realistic (MVP boundaries defined, 470-hour estimate backed by expert review)
- ✅ Requirements are comprehensive (118 functional requirements + 35+ non-functional requirements)
- ✅ User-centered design philosophy (8 detailed persona journeys, accessibility WCAG AA)
- ✅ Technical architecture decisions are sound (API-first MPA → SPA migration, smart caching, realistic self-hosted constraints)
- ✅ Timeline is achievable (13-14 weeks solo development at 35 hours/week)

**Minor Recommendations for Implementation Phase (non-blocking):**
1. Add FR: Admin can pre-populate homepage with recorded services before public launch
2. Clarify content creation ownership and pre-launch content coordination
3. Add Phase 2 effort estimates to roadmap
4. Plan live chat load testing (100+ concurrent users) before MVP launch
5. Increase testing allocation from 35 to 50 hours (integration + accessibility tests)
6. Create admin dashboard wireframe and error message design patterns during design phase
7. Plan Phase 2 accessibility user testing with congregation members
8. Plan knowledge transfer documentation for potential successor (Phase 2)

**Next Steps:**
- **Immediately:** Share PRD with Rabbi, Board, and Ilya for final sign-off
- **Week 1:** Begin design phase (wireframes, user flows, error patterns)
- **Week 2:** Begin architecture setup (backend API, database schema, hosting)
- **Weeks 3-14:** Implementation according to phased breakdown

---

---

### Risk Mitigation: MVP Level

**Technical Risks:**
| Risk | Mitigation | Contingency |
|------|-----------|------------|
| Facebook streaming fails during service | Graceful error message + display last week's recording | Ilya on standby; manual Facebook embed link |
| Live chat becomes spam/moderation burden | Simple approve/reject interface; community guidelines | Disable temporarily, re-enable after training |
| Website goes offline during service | Daily backup validation; monitoring alerts | Use cloud-hosted fallback (temporary during repair) |
| Payment processing fails | Test transactions daily; PayPal status monitoring | Manual donation collection method (Week 1 only) |

**Market Risks:**
| Risk | Mitigation | Contingency |
|------|-----------|------------|
| Rabbi doesn't adopt, reverts to email | Board support + internal validation first | Members use website directly (Rabbi optional) |
| Low member engagement Week 1 | Launch momentum (email + in-person + pre-loaded content) | Extend timeline, investigate with user interviews |
| Casual members don't return | Email notification (not push) + community reminder | Leverage in-person announcement for re-engagement |

**Resource Risks:**
| Risk | Mitigation | Contingency |
|------|-----------|------------|
| Ilya unavailable during launch | Pre-documented runbook + board escalation | Pause new features; existing site runs on autopilot |
| Scope creep adds hours | Weekly standup; feature freeze after Week 4 | Cut Phase 2 features, deliver MVP on time |

---

### MVP → Phase 2 Transition

**Readiness Criteria for Phase 2:**
- ✅ MVP stable (no critical bugs, 99%+ uptime)
- ✅ Usage data collected (analytics show engagement patterns)
- ✅ Rabbi feedback gathered (feature requests, pain points)
- ✅ Success metrics assessed (track toward 6-month targets)
- ✅ Team confidence (Ilya comfortable with codebase health)

**If achieved by Month 3:** Begin Phase 2 (YouTube streaming, Social Chair role).
**If not achieved:** Extended stabilization period before Phase 2 features.

---

### Scoping Validation: Stakeholder Round Table

**Validated Decisions:**

1. **Facebook-Only Launch** — MVP validates demand. YouTube Phase 2 if proven successful.
2. **Live Chat Included** — Innovation differentiator. Without it, no advantage over existing Facebook presence.
3. **Internal Validation First** — Rabbi confidence + launch risk mitigation (not feature delay).
4. **Success Metrics** — 40-50 members achievable with launch momentum + content velocity.
5. **Revenue Secondary** — Donations are outcome of engagement, not driver. Focus engagement first.

**Key Insights:**
- Real risk isn't features—it's **execution and launch momentum**
- Rabbi adoption more critical than feature completeness
- Content velocity (posts, announcements) matters more than advanced features
- Board support essential for launch success

