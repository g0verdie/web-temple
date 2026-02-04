---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - source: "Product Requirements Document"
    path: "prd.md"
    type: "prd"
  - source: "Product Brief"
    path: "product-brief-web-temple-2026-01-31.md"
    type: "product-brief"
workflowType: 'architecture'
project_name: 'Temple B''nai Israel Website Modernization'
user_name: 'Ilya'
date: '2026-02-01'
---

# Architecture Decision Document - web-temple

**Author:** Ilya  
**Date:** 2026-02-01  
**Project:** Temple B'nai Israel Website Modernization  
**Based on:** PRD (118 FRs, 35+ NFRs) + Product Brief

---

## Executive Summary

This document captures architectural decisions that translate the PRD's 118 functional requirements and 35+ non-functional requirements into a coherent system design. The architecture supports:

- **MVP Scope:** MPA (multi-page app) with API-first design, smart caching, WebSocket live chat
- **Phase 2 Migration:** Progressive SPA migration using existing API endpoints (no backend rewrite)
- **Self-Hosted Constraints:** Self-hosted on temple Linux server, minimal external dependencies
- **Real-Time Features:** WebSocket for live chat, polling for notifications, Facebook API for streaming
- **Quality Standards:** WCAG AA accessibility, 95% uptime, 95% code quality

This architecture is focused on **developer sustainability** (solo developer) and **long-term maintainability** (assume successor takes over).

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements: 118 FRs across 18 capability areas**
- Homepage & Discovery (7 FRs): Public content, service discovery, searchable archive
- Facebook Live Streaming (6 FRs): Embedded streams, recording publication, status displays
- Live Chat During Services (7 FRs): Real-time messaging, moderation, WebSocket + polling
- Member Authentication (8 FRs): Login, role-based access (Rabbi, Admin, Social Chair, Members)
- Announcement Management (8 FRs): Posting, email distribution, featured pins
- Calendar Management (9 FRs): Public + members-only events, notifications
- Visitor & Member Messaging (6 FRs): Contact forms, CAPTCHA, unified inbox
- Donations & Giving (9 FRs): PayPal, recurring gifts, tax receipts, dashboard
- Admin Dashboard (9 FRs): Metrics, moderation queue, audit logs, analytics
- Accessibility (9 FRs): WCAG AA, keyboard nav, captions, screen readers
- Mobile Responsive (7 FRs): 375px-1200px breakpoints, touch-friendly
- Email Notifications (6 FRs): Transactional emails, opt-in/out
- Content Management (5 FRs): Static page editing, version control
- Data & Backup (4 FRs): Daily backups, recovery, archival
- Security & Compliance (7 FRs): HTTPS, AES-256, audit logs, PCI delegation
- Onboarding & Settings (2 FRs): Rabbi tutorials, member preferences
- Recording Management (2 FRs): Publish workflow, searchable metadata
- Live Chat UX (1 FR): Disconnect handling, message preservation

**Key Architectural Signals:**
- Real-time messaging critical (WebSocket with polling fallback)
- Integration-heavy (PayPal, Facebook, Email)
- Multi-role permission system (5 distinct roles)
- Video metadata-only strategy (no local storage)
- Moderation workflows central
- Email as primary async communication

### Non-Functional Requirements Analysis

**Performance:**
- Homepage <2s, pages <3s (user experience critical)
- Live chat <2s message delivery (WebSocket + 3s polling fallback)
- Recording filtering <2s (backend processing acceptable)
- Recording publication <5 min (async acceptable)
- Admin API <1s response time

**Security:**
- HTTPS + TLS 1.2+ (all data in transit)
- AES-256 encryption (database + backups)
- Enhanced passwords (12 chars, mixed case, special chars)
- Session timeout 30 minutes (no IP whitelisting, MFA Phase 2)
- PII minimization (PayPal delegates card data)
- Donation records: encrypted, role-based access (Rabbi, Treasurer, President, Ilya)
- CAPTCHA on public forms

**Reliability:**
- **95% uptime target** (realistic for self-hosted, 5G internet)
- Facebook Live must stay up (even if website down)
- Graceful degradation (isolated failures, cascade prevention)
- Auto-restart on crash (no manual intervention)

**Scalability:**
- Live chat: 20 concurrent (MVP) → 30-50 (Month 6) → 1000 max with queue
- Excess users: redirect popup to Facebook/YouTube
- Video metadata-only (no local storage)
- Database: 500-1000 members, 50-100 msgs/week, 100-200 donations/month
- DB bottleneck → cloud migration conversation (Phase 2/3)

**Maintainability:**
- Solo developer sustainability (Ilya)
- Code quality, clear comments (WHY, not just WHAT)
- Local logging & monitoring (no third-party cloud)
- Open-source preference (reduce complexity)
- Comprehensive documentation (assume successor)

**Integration Reliability:**
- PayPal failures: error banner, notify Ilya, queue for retry
- Email failures: local message queue, retry 5min-1hr with backoff
- Facebook API failures: graceful error, fallback to archive
- Standard SLA acceptable (no premium costs)

**Accessibility:**
- WCAG AA launch requirement (4.5:1 contrast, keyboard nav, captions, screen readers)
- AAA enhancements Phase 2 (7:1 contrast, user testing)

### Scale & Complexity Assessment

| Metric | Value |
|--------|-------|
| **Project Type** | Hybrid Static + Real-Time Web App (Medium) |
| **Technical Domain** | Full-stack: Frontend (MPA), Backend (API), Real-time (WebSocket), Integrations |
| **Primary Complexity** | Real-time messaging, integrations, multi-role access control |
| **Functional Requirements** | 118 across 18 capability areas |
| **Non-Functional Requirements** | 35+ across 7 categories |
| **Estimated Components** | 12-15 major architectural pieces |
| **User Roles** | 5 distinct (Visitor, Member, Rabbi, Treasurer/President, Admin) |
| **External Integrations** | 4 critical (PayPal, Facebook, Email, YouTube/Phase 2) |
| **Real-Time Requirements** | WebSocket (live chat), polling (notifications), API (streaming) |

### Technical Constraints & Dependencies

**Self-Hosted Constraints:**
- Single Linux server on temple's 5G connection
- Minimal infrastructure (no cloud services)
- Solo developer management
- Downtime acceptable during internet outages
- 95% uptime target (realistic for constrained environment)

**Frontend Constraints:**
- Modern browsers only (Chrome, Firefox, Safari, Edge latest)
- No IE 11 support
- Mobile-first responsive design
- WCAG AA accessibility mandatory

**Backend Constraints:**
- API-first design (enables Phase 2 SPA migration without rewrite)
- PostgreSQL local database
- Daily cloud backups for disaster recovery
- Local message queue (email resilience)
- Local logging only (no third-party services)

**Integration Constraints:**
- PayPal handles card data (PCI delegation)
- Facebook API for streaming (not self-hosted)
- Email service required (local queue for failures)
- YouTube integration deferred to Phase 2

**Development Constraints:**
- Solo developer at 35 hrs/week
- 470-hour MVP estimate (13-14 weeks)
- 15% contingency included
- Successor maintainability critical

### Cross-Cutting Concerns

1. **Real-Time Communication** — WebSocket + polling spans live chat, notifications, presence
2. **Authentication & Authorization** — Role-based access across all FRs (Rabbi, Admin, Member, Visitor)
3. **Data Integrity & Audit Logging** — Donations, messages, admin actions, security events
4. **Email as Async Communication** — Notifications, receipts, confirmations, alerts
5. **Graceful Error Handling** — PayPal failures, Facebook API failures, network issues
6. **Accessibility (WCAG AA)** — All pages, videos, interactions, forms
7. **Mobile Responsiveness** — Every page 375px-1200px
8. **Moderation & Spam Prevention** — Live chat, forms, message queues
9. **Performance & Caching** — Smart caching for self-hosted sustainability
10. **Security & Encryption** — HTTPS, database encryption, PII handling, audit logs

---

## Starter Patterns

### Pattern 1: **API-First Monolith → Microservices Evolution**

**Pattern:** Single cohesive API backend (MVP) with clear service boundaries enabling future extraction
- **Why:** Simplifies solo developer maintenance, avoids premature complexity
- **Self-Hosted Friendly:** Single deployable unit, minimal operational overhead
- **Phase 2 Ready:** Clear API contracts support SPA frontend swap without backend rewrite
- **Examples:** Rails API, Django REST, Node.js Express with service layer abstractions

**Fits Your Project:**
- ✅ 118 FRs bundled into coherent data model (accounts, content, donations, messages)
- ✅ Service layer boundaries (AuthService, DonationService, ChatService, NotificationService, ContentService)
- ✅ Ready for extraction to microservices if volume demands it

---

### Pattern 2: **WebSocket + Polling Hybrid for Real-Time**

**Pattern:** Primary WebSocket for live chat, polling fallback for resilience, local message queue for failure recovery
- **Why:** Handles network failures gracefully, works behind firewalls
- **Self-Hosted Friendly:** No external real-time provider (Firebase, Pusher, etc.)
- **Scalability:** Polling (3-sec) for 20-50 concurrent, WebSocket for active chat
- **Examples:** Socket.io, native WebSockets + REST polling

**Fits Your Project:**
- ✅ Live chat requires <2s delivery (WebSocket primary)
- ✅ Notification resilience (polling fallback if WebSocket fails)
- ✅ Moderation queues (polling acceptable, near-real-time)

---

### Pattern 3: **Role-Based Access Control (RBAC) with Delegation**

**Pattern:** Centralized permission matrix (5 roles × 18 capability areas) with delegation patterns
- **Why:** Simplifies auth logic, enables safe permission delegation (Rabbi → Social Chair)
- **Implementation:** Permission list per role + explicit delegation rules
- **Examples:** Standard RBAC (Django, Rails, Node.js packages like accesscontrol.js)

**Fits Your Project:**
- ✅ 5 distinct roles (Visitor, Member, Rabbi, Treasurer/President, Admin)
- ✅ Delegation signals in PRD (Rabbi posts, Social Chair moderates)
- ✅ Audit logging (all admin/rabbi actions captured)

---

### Pattern 4: **Graceful Integration Degradation**

**Pattern:** Isolated integration clients with timeout/retry logic, graceful fallback UI
- **Why:** Facebook API failures shouldn't crash your site
- **Self-Hosted Friendly:** Reduces dependency on external services for core functionality
- **Examples:** Circuit breaker pattern (Resilience4j, Polly), timeout policies

**Fits Your Project:**
- ✅ PayPal failures → error banner + queue retry
- ✅ Facebook API failures → fallback to archive
- ✅ Email failures → local message queue + exponential backoff
- ✅ All 4 critical integrations need isolation

---

### Pattern 5: **Email as Async Communication Backbone**

**Pattern:** Local message queue (Redis/Postgres queue) with retry logic, async workers
- **Why:** Decouples email from request/response cycle, handles failures gracefully
- **Self-Hosted Friendly:** Single server can handle queue + worker
- **Scalability:** Workers can be tuned independently from web server

**Fits Your Project:**
- ✅ 6 FRs for email notifications (announcements, receipts, confirmations)
- ✅ Failure resilience (queue retries on failure)
- ✅ Local-only requirement (no external queue services)

---

### Pattern 6: **Static + Dynamic Content Hybrid**

**Pattern:** MPA (server-rendered HTML) with smart caching (30-min TTL for announcements, longer for static)
- **Why:** Simpler than SSG, avoids over-caching dynamic content, supports Rabbi's content velocity
- **Self-Hosted Friendly:** Single cache layer (Redis or memory-based)
- **Phase 2 Ready:** SPA can use same API, no cache invalidation rewrite

**Fits Your Project:**
- ✅ Homepage + static pages: cache 24h (stable content)
- ✅ Announcements: cache 30min (Rabbi posts 2-5x/week)
- ✅ Live chat: no cache (real-time)
- ✅ Member content: no cache (role-gated)

---

### Pattern 7: **Moderation Queue Pattern**

**Pattern:** Async moderation (flag message → human review queue → publish/reject)
- **Why:** Prevents toxic content in live chat, supports community trust
- **Fits Your Project:** Live chat FRs include moderation, rabbi must review public messages

---

### Pattern 8: **Backup + Recovery Strategy**

**Pattern:** Daily cloud backup + local recovery tests + documented runbook
- **Why:** Self-hosted requires discipline (no cloud provider handles recovery)
- **Fits Your Project:** 95% uptime target, disaster recovery critical

---

## Patterns Implementation Documentation

### Pattern 1: **API-First Monolith → Microservices Evolution**

**Implementation in Your Architecture:**

```
Backend Service Layer Structure:
├── AuthService (login, password reset, JWT, in-house auth)
├── ContentService (pages, announcements, calendar)
├── ChatService (messages, moderation, presence)
├── DonationService (PayPal integration, recurring, receipts)
├── NotificationService (email queue, SMS Phase 2)
├── StreamingService (Facebook API, recording metadata)
└── AuditService (immutable logs)
```

Each service is a Node.js module with clear interfaces, database access through ORM, ready for future extraction as separate microservices.

---

### Pattern 2: **WebSocket + Polling Hybrid for Real-Time**

**Real-Time Flow:**

```
Client → WebSocket (Socket.io primary)
       ├─ Live Chat Messages (<2s delivery)
       ├─ Presence Heartbeat
       └─ Fallback: Automatic REST polling (3-sec) if WebSocket fails

Server-Side Persistence:
├─ Redis Queue (live messages, offline cache)
├─ PostgreSQL (persistent storage)
└─ Graceful Degradation (chat unavailable → error banner + offline queue)
```

Implementation ensures message delivery even behind firewalls, with automatic fallback.

---

### Pattern 3: **In-House Authentication + Role-Based Access Control (RBAC)**

**Authentication (In-House):**
- User login: Email/Username + Password
- Password storage: Bcrypt hashed (never plaintext), 12+ chars with mixed case + special chars
- Session management: JWT tokens (stateless), 30-minute expiry
- No external auth providers (Auth0, Firebase) — full control, full responsibility
- Rate limiting: Login endpoint limited to 5 attempts/min per IP
- Audit logging: Every auth event (login, logout, failed attempts)

**Authorization (Permission Matrix in Database):**

Database schema:
```sql
-- Roles (5 total)
CREATE TABLE roles (
  id INT PRIMARY KEY,
  name VARCHAR(50) UNIQUE,  -- visitor, member, rabbi, treasurer, admin
  description TEXT
);

-- Permissions (resource + action pairs, ~120 total)
CREATE TABLE permissions (
  id INT PRIMARY KEY,
  resource VARCHAR(50),     -- announcements, chat, donations, etc.
  action VARCHAR(50),       -- create, read, update, delete, moderate, approve
  description TEXT
);

-- Role-Permission Mapping
CREATE TABLE role_permissions (
  role_id INT REFERENCES roles(id),
  permission_id INT REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

-- Delegation (Rabbi → Social Chair, time-bound)
CREATE TABLE role_delegations (
  id INT PRIMARY KEY,
  delegator_id INT REFERENCES users(id),
  delegatee_id INT REFERENCES users(id),
  permission_id INT REFERENCES permissions(id),
  valid_from TIMESTAMP,
  valid_to TIMESTAMP,
  reason TEXT,
  created_at TIMESTAMP
);

-- Audit Logs (immutable)
CREATE TABLE audit_logs (
  id INT PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action VARCHAR(100),      -- auth:login, announce:create, moderate:approve
  resource_id INT,
  ip_address VARCHAR(50),
  timestamp TIMESTAMP,
  details JSONB
);
```

Permission Matrix (runtime loaded from DB):

| Role | View | Action |
|------|------|--------|
| **Visitor** | Homepage, Announcements, Calendar, Archive | Contact Form, Donate, Join Chat (read-only) |
| **Member** | + Member Content, Profile | + Post Chat Messages, Update Profile |
| **Rabbi** | + Member Directory, Donations (names+amounts), Audit Logs | + Create Announcement, Create Event, Moderate Chat, Approve Donations, Delegate Moderation |
| **Treasurer/President** | Donation Dashboard | Export Donations, Approve Recurring Gifts |
| **Admin (Ilya)** | All data | All actions + System Config, Backup Monitor, User Management |

Implementation (Node.js/Express):
```javascript
// Load permissions from DB at startup
async function loadPermissionMatrix() {
  return db.query(`
    SELECT r.name as role, p.resource, p.action 
    FROM role_permissions rp
    JOIN roles r ON rp.role_id = r.id
    JOIN permissions p ON rp.permission_id = p.id
  `);
}

const permissionMatrix = await loadPermissionMatrix();

// Check authorization at runtime
async function authorize(resource, action) {
  return async (req, res, next) => {
    const user = req.user; // from JWT
    
    // Check direct permissions
    const hasPermission = permissionMatrix.some(p => 
      p.role === user.role && p.resource === resource && p.action === action
    );
    
    // Check delegations (if applicable)
    if (!hasPermission) {
      const delegation = await db.query(`
        SELECT * FROM role_delegations
        WHERE delegatee_id = $1 AND valid_from <= NOW() AND valid_to >= NOW()
      `, [user.id]);
      // Verify permission_id matches resource+action
    }
    
    if (!hasPermission) {
      await auditLog.create({
        user_id: user.id,
        action: 'auth:denied',
        resource_type: resource,
        resource_action: action,
        ip_address: req.ip
      });
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    next();
  };
}

// Login Endpoint (In-House)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Validate user
  const user = await db.users.findByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  // Validate password
  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    await auditLog.create({
      user_id: user.id,
      action: 'auth:failed_password',
      ip_address: req.ip
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Issue JWT (30-min expiry)
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );
  
  // Audit successful login
  await auditLog.create({
    user_id: user.id,
    action: 'auth:login_success',
    ip_address: req.ip
  });
  
  res.json({ token, expiresIn: 1800 });
});
```

**Delegation Example:**
- Rabbi can delegate "chat:moderate" permission to Social Chair
- Stored in `role_delegations` with valid time window (Saturday 8 PM - 10 PM)
- Audit log: "Rabbi Sarah delegated chat:moderate to Social Chair Jane Doe, 2026-02-08 20:00 - 22:00"

---

### Pattern 4: **Graceful Integration Degradation**

**Integration Isolation:**

```
PayPal Service:
├─ Timeout: 5 seconds (fail fast)
├─ Retry: Exponential backoff (1min → 5min → 15min → 1hr)
├─ Failure UI: "Donation temporarily unavailable, try again in 5 minutes"
└─ Fallback: Contact form for manual donations

Facebook API:
├─ Timeout: 10 seconds
├─ Failure UI: "Stream unavailable, showing archive"
└─ Fallback: Last published recording

Email Service:
├─ Timeout: 2 seconds
├─ Persistence: Local queue (PostgreSQL), retry worker
├─ Retry: Every 5 minutes, max 24 hours
└─ User Impact: "Email queued, will arrive within 24 hours"
```

Circuit breaker pattern prevents cascading failures.

---

### Pattern 5: **Email as Async Communication Backbone**

**Email Queue Architecture:**

```
Request → Queue Entry → Background Worker → SMTP Send

Flow:
1. Donation created → Queue entry (id, type, recipient, data, status)
2. Return success immediately (don't block on email)
3. Worker picks up every 30 seconds:
   ├─ Render email template
   ├─ Send via SMTP
   ├─ Mark success or schedule retry
   └─ Exponential backoff on failure
```

Email types: Transactional (immediate), Notifications (batched 5-min), System Alerts (priority).

---

### Pattern 6: **Static + Dynamic Content Hybrid (Smart Caching)**

**Cache Strategy:**

```
Static Content (24h TTL):
├─ Homepage design, template
├─ About, Service times, FAQ
└─ Cache-Control: public, max-age=86400

Dynamic Content (30min TTL):
├─ Announcements (Rabbi posts 2-5x/week)
├─ Calendar events, Recording metadata
└─ Cache-Control: public, max-age=1800

Real-Time Content (No Cache):
├─ Live chat messages
├─ Donation confirmation
├─ Member-only content
└─ Cache-Control: no-cache, private
```

Redis handles cache layer, automatic 30-min expiry for announcements, manual invalidation on Rabbi post.

---

### Pattern 7: **Moderation Queue Pattern**

**Live Chat Moderation:**

```
Message posted → Validation → Storage Decision:
├─ AUTO_APPROVED: Regulars, Rabbi, Admin (instant publish)
├─ QUARANTINE: Flagged content (hold for Rabbi review)
└─ BANNED: Spam, banned words (reject + log)

Moderation Queue (for flagged):
├─ Message + context
├─ Flag reason (spam, inappropriate, etc.)
├─ Timestamp, reporter
└─ Rabbi review: Approve (publish) or Reject (delete)
```

---

### Pattern 8: **Backup + Recovery Strategy**

**Daily Backup Workflow:**

```
02:00 AM UTC (daily cron):
1. PostgreSQL dump (compressed)
2. AES-256 encrypt with local key
3. Upload to S3 (encrypted)
4. Retention: 30 days
5. Verify checksum, log result

Monthly Recovery Test:
├─ Download encrypted backup
├─ Decrypt with local key
├─ Restore to test database
├─ Verify data integrity
└─ Document findings
```

---

## Architectural Decisions

### Decision 1: Backend Framework & Language ✅

**Chosen:** **Node.js/Express**

**Rationale:**
- Fast iteration cycle (JavaScript reduces cognitive load with eventual SPA)
- Excellent WebSocket libraries (Socket.io for live chat)
- Single language for both MVP backend and Phase 2 SPA frontend
- Async/await patterns match event-driven real-time requirements
- Rich npm ecosystem (authentication, validation, email, integrations)

**Implementation:**
- Express.js for HTTP routing + middleware
- Socket.io for WebSocket (with polling fallback)
- Bcrypt for password hashing
- JWT for stateless authentication
- Sequelize or TypeORM for ORM (PostgreSQL)

---

### Decision 2: Database Architecture ✅

**Chosen:** **PostgreSQL + Redis (in-memory cache)**

**Rationale:**
- PostgreSQL handles all persistent state (local deployment)
- Redis provides sub-second response times for frequently accessed data
- Cache invalidation strategy: 24h (static pages), 30min (announcements), 0 (live chat/members-only)
- Daily PostgreSQL backups to cloud storage (encrypted)

**Data Model:**
- Users (Visitor, Member, Rabbi, Treasurer, Admin roles)
- Announcements + Pins (cacheable)
- Calendar Events (cacheable)
- Messages (chat, contact form)
- Donations + Recurring Gifts
- Email Queue (persistent, retry-driven)
- Audit Logs (immutable)

**Backup Strategy:**
- Daily automated PostgreSQL backup to cloud (S3 or similar)
- Backup encryption key stored locally (not in cloud)
- Monthly recovery test (verify backups restore cleanly)

---

### Decision 3: Real-Time Architecture ✅

**Chosen:** **Socket.io (WebSocket + REST Polling Fallback)**

**Rationale:**
- Socket.io handles WebSocket connection fallback automatically (no custom code)
- Polling (3-sec intervals) ensures message delivery even behind firewalls
- Local Redis-backed message queue for offline persistence
- <2s message delivery for live chat (95th percentile)

**Real-Time Features:**
- **Live Chat:** WebSocket primary, REST polling fallback, Redis queue persistence
- **Notifications:** Polling (3-sec), no WebSocket required
- **Presence Indicators:** WebSocket heartbeat, grace period 10-15 sec
- **Moderation Queue:** Polling acceptable (near-real-time, not instant)

**Scaling:**
- MVP target: 20-50 concurrent chat users
- Month 6: 30-50 concurrent users
- Scale limit: ~1000 with message queue + queue-aware UI (redirect to Facebook/YouTube)

---

### Decision 4: Frontend Architecture ✅

**Chosen:** **MPA (Multi-Page App) with API-First Design, Phase 2 SPA Migration Path**

**Rationale:**
- Server-rendered HTML (Node.js templates) simplifies WCAG compliance + SEO
- API-first backend enables Phase 2 SPA swap without backend rewrite
- Less build complexity than SPA (no webpack/bundler overhead)
- Faster time-to-delivery for solo developer

**Frontend Stack (MVP):**
- Server-rendered HTML/CSS/JavaScript
- Minimal client-side JavaScript (form handling, Socket.io connection)
- Socket.io for live chat (dynamic)
- REST polling for notifications (dynamic)
- Server-side caching via headers (Cache-Control)

**Phase 2 Migration (Planned):**
- React/Vue SPA consuming same API endpoints (zero backend changes)
- Preserve API contracts for backward compatibility

**WCAG AA Compliance:**
- Server-rendered HTML naturally supports keyboard navigation + screen readers
- Alt text on images, captions on videos, semantic HTML
- Contrast ratios 4.5:1 (launch), 7:1 (Phase 2)

---

### Decision 5: Security & Compliance ✅

**Chosen:** **In-House Authentication + Database-Stored Permission Matrices + PayPal Delegation + AES-256 Local Encryption + TLS + Audit Logging**

**Rationale:**
- **In-House Auth:** Full control over login flow, permission checks, audit trails (no external dependencies)
- **Permission Matrix in Database:** Flexible role/permission management, supports delegation (Rabbi → Social Chair)
- **PayPal Delegation:** PayPal handles PCI compliance (reduces your burden to Level 3)
- **AES-256 Encryption:** Encrypts sensitive data at rest (passwords, donation records, PII)
- **TLS:** Ensures data in transit is encrypted (HTTPS only)
- **Audit Logging:** Immutable records of all auth, admin, and rabbi actions

**Authentication Implementation (In-House):**
- Login endpoint: Email/Password validation, Bcrypt hashing (never plaintext)
- JWT tokens: Stateless, 30-min expiry, refresh token rotation (Phase 2)
- Password requirements: 12+ chars, mixed case, special chars, no reuse of last 3
- Rate limiting: 5 login attempts per minute per IP
- Audit logging: Every login, logout, failed attempt, permission denial

**Authorization Implementation (Database-Stored):**
- Permission matrix loaded from PostgreSQL at startup, cached in memory
- Permissions: 5 roles × ~120 resource-action pairs (~600 total entries)
- Runtime check: `user.role` → `role_permissions` → `permissions` table
- Delegation support: Rabbi can delegate specific permissions to Social Chair with time window

**Data Encryption:**
- **Passwords:** Bcrypt with 12 rounds (strong, intentionally slow)
- **Sensitive Data:** AES-256 for donation records, member PII, treasury notes
- **Backup Encryption:** Cloud backups encrypted, decryption key stored locally (not in cloud)
- **API Security:** HTTPS/TLS 1.2+ only, rate limiting on public endpoints

**CAPTCHA & Spam Prevention:**
- All public forms: Contact form, donation form, member signup
- reCAPTCHA v3 (invisible, modern browsers)

**Audit Logging:**
- Immutable logs: All auth events, admin actions, rabbi posts, approval decisions
- Schema: user_id, action, resource_id, ip_address, timestamp, details (JSON)
- Queryable: Ilya can review "who changed what when"

**PCI Compliance:**
- PayPal Hosted Checkout handles card data (out of scope for you)
- Your app: PCI Level 3 (minimal compliance)
- Annual self-assessment required (low cost, template-driven)

---

## System Structure

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENTS                               │
├──────────────────────────────┬──────────────────────────────┤
│   Web Browser (MPA)          │   Admin Tools (Phase 2)      │
│   • HTML/CSS/JavaScript      │   • React Dashboard         │
│   • Socket.io WebSocket      │   • Admin API Client        │
└──────────────────────────────┴──────────────────────────────┘
                               │
                      HTTPS / TLS 1.2+
                               │
┌─────────────────────────────────────────────────────────────┐
│           EXPRESS.JS API SERVER (Node.js)                   │
├─────────────────────────────────────────────────────────────┤
│  Middleware Layer:                                          │
│  • JWT Authentication                                       │
│  • RBAC Authorization (from DB)                            │
│  • Rate Limiting                                            │
│  • Error Handling                                           │
│  • Audit Logging                                            │
├─────────────────────────────────────────────────────────────┤
│  API Routes (REST + WebSocket):                            │
│  • /api/auth (login, logout, refresh)                      │
│  • /api/announcements (CRUD)                               │
│  • /api/calendar (CRUD)                                    │
│  • /api/chat (REST polling fallback)                       │
│  • /api/donations (PayPal checkout)                        │
│  • /api/messages (contact forms, inbox)                    │
│  • /api/users (member profiles)                            │
│  • /api/admin (analytics, moderation)                      │
│  • /socket.io (WebSocket for live chat)                    │
├─────────────────────────────────────────────────────────────┤
│  Service Layer:                                             │
│  • AuthService (in-house login)                            │
│  • ContentService (pages, announcements)                   │
│  • ChatService (live messages, moderation)                 │
│  • DonationService (PayPal integration)                    │
│  • NotificationService (email queue)                       │
│  • StreamingService (Facebook API)                         │
│  • AuditService (immutable logs)                           │
├─────────────────────────────────────────────────────────────┤
│  Integration Clients (Circuit Breakers):                    │
│  • PayPal Checkout API                                      │
│  • Facebook Graph API (streaming, publishing)              │
│  • SMTP Email Client (with queue)                          │
│  • YouTube API (Phase 2)                                   │
└─────────────────────────────────────────────────────────────┘
    │                    │                    │
    │                    │                    │
    ▼                    ▼                    ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ PostgreSQL  │    │  Redis Cache │    │  Email Queue    │
│  Database   │    │  (in-memory) │    │  (Redis/Postgres)
├─────────────┤    ├──────────────┤    └─────────────────┘
│ • Users     │    │ Announcements│
│ • Roles     │    │ Calendar     │    Background Worker:
│ • Perms     │    │ Messages     │    • Email sender
│ • Messages  │    │ Sessions     │    • Recording processor
│ • Donations │    │ Queue state  │
│ • Audit Logs│    │              │    External Services:
│ • Content   │    └──────────────┘    • PayPal
│ • Queue     │                        • Facebook
│ • Streams   │                        • SMTP Provider
└─────────────┘                        • S3 (backups)

Daily:
   PostgreSQL Backup → Encrypt → S3 Upload
```

---

### Data Flow: Live Chat Example

```
User sends chat message:
┌────────────────────┐
│ Browser Client     │
│ (Socket.io)        │
└─────────┬──────────┘
          │ WebSocket: { message: "Hello", userId: 42 }
          ▼
┌────────────────────┐
│ ChatService.post() │
│ • Validate role    │
│ • Rate limit check │
│ • Profanity scan   │
│ • Determine status │
└─────────┬──────────┘
          │
          ├─ AUTO_APPROVED → Broadcast immediately
          │
          └─ QUARANTINE → Queue for moderation
                          (Rabbi review)
          │
          ▼
┌────────────────────┐
│ PostgreSQL Write   │
│ • messages table   │
│ • audit_logs       │
└─────────┬──────────┘
          │
          ├─ Redis Cache: Recent messages
          │
          └─ Broadcast to connected clients via Socket.io
          │
          ▼
┌────────────────────┐
│ Browser Clients    │
│ (live update)      │
└────────────────────┘
```

---

### Data Flow: Donation Example

```
User clicks "Donate":
┌──────────────────────┐
│ Checkout Form        │
│ (MPA page)           │
└─────────┬────────────┘
          │
          ▼
┌──────────────────────┐
│ /api/donations/init  │
│ • Calculate total    │
│ • Create checkout    │
│ • Load PayPal button │
└─────────┬────────────┘
          │
          ▼
┌──────────────────────┐
│ User enters PayPal   │
│ credentials (PayPal) │
└─────────┬────────────┘
          │
          ▼
┌──────────────────────┐
│ /api/donations/verify│
│ PayPal confirms ✓    │
└─────────┬────────────┘
          │
          ├─ SUCCESS:
          │  1. Save donation to PostgreSQL
          │  2. Queue email receipt (async)
          │  3. Update donation dashboard
          │  4. Audit log entry
          │
          └─ FAILURE:
             1. Error banner to user
             2. Queue retry in message queue
             3. Alert Ilya (Treasurer notification)
             4. Audit log entry (failed donation)

Async (Background Worker):
┌──────────────────────┐
│ Email Queue Worker   │
│ (runs every 30 sec)  │
└─────────┬────────────┘
          │
          ├─ Load pending emails from queue
          │
          ├─ Render receipt template
          │
          ├─ Send via SMTP
          │
          └─ Mark success or schedule retry
```

---

### MVP API Endpoints (REST)

**Authentication:**
```
POST /api/auth/login
  → { email, password }
  ← { token, expiresIn: 1800 }

POST /api/auth/logout
  → requires JWT
  ← { success: true }

POST /api/auth/register
  → { email, password, name }
  ← { userId, token }
```

**Announcements:**
```
GET /api/announcements
  → returns all announcements (cached 30min)

GET /api/announcements/:id
  → returns single announcement

POST /api/announcements
  → requires role: rabbi
  → { title, content, pinned }
  ← { id, createdAt }

PUT /api/announcements/:id
  → requires role: rabbi
  → { title, content }

DELETE /api/announcements/:id
  → requires role: rabbi + admin
```

**Live Chat:**
```
WebSocket: /socket.io
  event: 'chat:message'
  → { text }
  ← broadcast to all connected clients

REST Fallback (polling):
GET /api/chat/messages?since=<timestamp>
  → returns messages since timestamp
  ← [{ userId, text, createdAt }, ...]

GET /api/chat/messages/:id
  → returns single message with moderation status
```

**Donations:**
```
POST /api/donations/init
  → { amount, recurring, email }
  ← { checkoutUrl }

POST /api/donations/verify
  → { paymentId }
  ← { success: true, receiptId }

GET /api/donations (admin only)
  → returns donation dashboard (totals, trends)
```

**Admin Dashboard:**
```
GET /api/admin/moderation-queue
  → requires role: rabbi
  ← [{ messageId, text, flagReason, flaggedAt }, ...]

POST /api/admin/moderation-queue/:messageId/approve
  → requires role: rabbi
  ← { success: true }

POST /api/admin/moderation-queue/:messageId/reject
  → requires role: rabbi
  ← { success: true }

GET /api/admin/audit-logs
  → requires role: admin
  ← [{ action, userId, resource, timestamp }, ...]
```

---

### Technology Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | HTML/CSS/JS (MPA) | Server-rendered, WCAG AA, API-first |
| **Server** | Node.js/Express | Fast iteration, WebSocket libraries, async/await |
| **Real-Time** | Socket.io + REST polling | WebSocket primary, polling fallback, circuit breaker |
| **Database** | PostgreSQL | Proven, complex queries, transactions, ACID compliance |
| **Cache** | Redis | Sub-second performance, message queue, session store |
| **Auth** | JWT + Bcrypt | Stateless, in-house, no external deps |
| **Email** | Nodemailer + local queue | Resilient, retry logic, local persistence |
| **Payments** | PayPal Checkout | PCI delegation, standard integration |
| **Streaming** | Facebook Graph API | RTMP/API-based, recording metadata |
| **Hosting** | Self-hosted Linux | Temple's 5G connection, daily backups to S3 |
| **Monitoring** | Local logging + cron | No third-party services, Ilya reviews daily |

---

## Architecture Validation

### Validation Framework

**Goal:** Verify that the proposed architecture (Node.js/Express, PostgreSQL, Redis, Socket.io, in-house auth, PayPal, Facebook API) can deliver all 118 FRs and 35+ NFRs from the PRD.

---

#### Functional Requirements Validation by Capability Area

| Capability Area | FRs | Architecture Support | Status |
|----------------|-----|---------------------|--------|
| **1. Homepage & Discovery** | 7 FRs | MPA with Redis caching (24h), PostgreSQL content storage | ✅ Supported |
| **2. Facebook Live Streaming** | 6 FRs | Facebook Graph API, StreamingService, recording metadata in PostgreSQL | ✅ Supported |
| **3. Live Chat During Services** | 7 FRs | Socket.io (WebSocket + polling), ChatService, Redis queue, moderation queue | ✅ Supported |
| **4. Member Authentication** | 8 FRs | In-house JWT auth, Bcrypt, role-permission DB tables, 30-min sessions | ✅ Supported |
| **5. Announcement Management** | 8 FRs | ContentService, PostgreSQL storage, Redis cache (30min), email queue | ✅ Supported |
| **6. Calendar Management** | 9 FRs | ContentService, PostgreSQL events table, Redis cache, email notifications | ✅ Supported |
| **7. Visitor & Member Messaging** | 6 FRs | Contact forms, CAPTCHA, PostgreSQL inbox, NotificationService | ✅ Supported |
| **8. Donations & Giving** | 9 FRs | PayPal Checkout API, DonationService, PostgreSQL donations table, email receipts | ✅ Supported |
| **9. Admin Dashboard** | 9 FRs | Admin API routes, AuditService, moderation queue, analytics queries | ✅ Supported |
| **10. Accessibility** | 9 FRs | Server-rendered HTML (WCAG AA), semantic HTML, keyboard nav, captions | ✅ Supported |
| **11. Mobile Responsive** | 7 FRs | CSS responsive design (375px-1200px), touch-friendly UI | ✅ Supported |
| **12. Email Notifications** | 6 FRs | NotificationService, email queue (PostgreSQL/Redis), async workers, retry logic | ✅ Supported |
| **13. Content Management** | 5 FRs | ContentService, version control (PostgreSQL), static page editing | ✅ Supported |
| **14. Data & Backup** | 4 FRs | Daily PostgreSQL backups, S3 encrypted upload, recovery tests, cron jobs | ✅ Supported |
| **15. Security & Compliance** | 7 FRs | HTTPS/TLS, AES-256 encryption, JWT auth, audit logs, PayPal PCI delegation | ✅ Supported |
| **16. Onboarding & Settings** | 2 FRs | Tutorial content (ContentService), user preferences (PostgreSQL) | ✅ Supported |
| **17. Recording Management** | 2 FRs | Metadata-only storage (PostgreSQL), publishing workflow, search | ✅ Supported |
| **18. Live Chat UX** | 1 FR | Socket.io auto-reconnect, message preservation (Redis), disconnect handling | ✅ Supported |

**Result:** ✅ **All 118 FRs validated** — Architecture supports complete capability contract.

---

#### Non-Functional Requirements Validation

| NFR Category | Requirements | Architecture Support | Status |
|-------------|--------------|---------------------|--------|
| **Performance** | Homepage <2s, Pages <3s, Chat <2s, Recording filter <2s | Redis caching, indexed queries, Socket.io WebSocket, optimized API endpoints | ✅ Supported |
| **Security** | HTTPS/TLS 1.2+, AES-256, 12-char passwords, 30-min sessions, CAPTCHA, audit logs | TLS termination, Bcrypt hashing, JWT expiry, reCAPTCHA, immutable audit logs table | ✅ Supported |
| **Reliability** | 95% uptime, Facebook Live stays up even if site down, graceful degradation, auto-restart | Circuit breakers for integrations, isolated Facebook API client, PM2/systemd auto-restart | ✅ Supported |
| **Scalability** | 20 chat users (MVP) → 50 (Month 6) → 1000 max with queue, 500-1000 members | Socket.io horizontal scaling (Phase 2), Redis Pub/Sub, PostgreSQL tuning, queue-aware UI | ✅ Supported |
| **Maintainability** | Solo developer sustainability, code quality, clear comments, local logging, open-source preference | Service layer abstraction, documented patterns, no external services, standard Node.js ecosystem | ✅ Supported |
| **Integration Reliability** | PayPal/Email/Facebook failures graceful, retry logic, local queue, standard SLAs | Circuit breaker pattern, exponential backoff, message queues (PostgreSQL/Redis), error banners | ✅ Supported |
| **Accessibility** | WCAG AA launch (4.5:1 contrast, keyboard nav, captions, screen readers) | Server-rendered HTML, semantic markup, aria-labels, keyboard handlers, alt text on images | ✅ Supported |

**Result:** ✅ **All 35+ NFRs validated** — Architecture meets performance, security, reliability, scalability, maintainability, integration, and accessibility targets.

---

#### Critical Path Analysis

**Highest Risk Components:**

1. **Live Chat (WebSocket + Polling)** — Real-time requirement <2s
   - **Mitigation:** Socket.io battle-tested, Redis queue for offline, polling fallback built-in
   - **Validation:** Load testing with 50 concurrent users before launch

2. **PayPal Integration Failures** — Donation revenue critical
   - **Mitigation:** Circuit breaker, retry queue, graceful error banners, fallback contact form
   - **Validation:** PayPal sandbox testing, simulated failures

3. **Solo Developer Maintainability** — Ilya must sustain long-term
   - **Mitigation:** Service layer abstraction, comprehensive documentation, standard patterns
   - **Validation:** Code reviews during development, assume-successor documentation standard

4. **Self-Hosted 95% Uptime** — 5G internet can fail
   - **Mitigation:** Graceful degradation, Facebook Live isolated (continues even if site down)
   - **Validation:** Internet outage simulations, failover testing

5. **WCAG AA Compliance** — Launch requirement
   - **Mitigation:** Server-rendered HTML (naturally accessible), automated testing (axe-core)
   - **Validation:** Manual screen reader testing, keyboard-only navigation testing

---

#### Architecture Risks & Trade-offs

| Risk | Impact | Mitigation | Accepted Trade-off |
|------|--------|-----------|-------------------|
| **Self-hosted single server** | Single point of failure | Daily backups, documented recovery, accept 95% uptime (not 99%) | ✅ Yes — Cost vs. availability |
| **In-house auth (no Auth0/Firebase)** | Security responsibility, custom implementation | Bcrypt, JWT, rate limiting, audit logging, standard patterns | ✅ Yes — Control vs. convenience |
| **MPA (not SPA)** | Page reloads slower | Smart caching (Redis), API-first for Phase 2 SPA migration | ✅ Yes — Simplicity vs. UX snappiness |
| **Facebook-only streaming (MVP)** | No YouTube simultaneously | Defer to Phase 2, prioritize launch over feature completeness | ✅ Yes — Speed to market |
| **Solo developer** | Single point of failure | Comprehensive docs, assume-successor mindset, service abstractions | ✅ Yes — Budget constraint |
| **PostgreSQL (not NoSQL)** | Scaling ceiling ~100k members | Sufficient for temple (500-1000 members), migration conversation if exceeded | ✅ Yes — Proven vs. over-engineering |

---

#### Validation Conclusion

**✅ Architecture Validated**

The proposed architecture (Node.js/Express, PostgreSQL, Redis, Socket.io, in-house auth with DB-stored permissions, PayPal delegation, Facebook API integration) successfully supports:

- ✅ All 118 Functional Requirements across 18 capability areas
- ✅ All 35+ Non-Functional Requirements (performance, security, reliability, scalability, maintainability, integration, accessibility)
- ✅ Self-hosted constraints (single server, 95% uptime, solo developer)
- ✅ Real-time features (live chat <2s delivery, WebSocket + polling)
- ✅ Integration resilience (PayPal, Facebook, Email with circuit breakers)
- ✅ Phase 2 migration path (MPA → SPA without backend rewrite)

**Readiness:** Architecture ready for Epic/Story breakdown and implementation phase.

---

## Architecture Completion

### Architecture Document Summary

**Architecture Decisions Finalized:**

✅ **Backend:** Node.js/Express (fast iteration, WebSocket support, single language with future SPA)  
✅ **Database:** PostgreSQL + Redis caching (persistent + performance)  
✅ **Real-Time:** Socket.io (WebSocket + REST polling fallback)  
✅ **Frontend:** MPA (server-rendered HTML, API-first, Phase 2 SPA migration)  
✅ **Authentication:** In-house JWT + Bcrypt (full control, DB-stored permission matrices)  
✅ **Authorization:** RBAC with delegation support (5 roles, ~120 permissions in DB)  
✅ **Payments:** PayPal Checkout (PCI delegation, Level 3 compliance)  
✅ **Security:** HTTPS/TLS 1.2+, AES-256 encryption, audit logging  
✅ **Integrations:** Circuit breaker pattern for PayPal, Facebook, Email  
✅ **Deployment:** Self-hosted Linux, daily S3 backups (encrypted)

---

### Implementation Priorities (Suggested Order)

**Phase 0: Foundation (Weeks 1-2)**
1. Set up Node.js/Express project structure
2. Initialize PostgreSQL database schema (users, roles, permissions, audit_logs)
3. Configure Redis (caching + message queue)
4. Implement JWT authentication + Bcrypt password hashing
5. Build RBAC authorization middleware (DB-driven permission checks)
6. Set up logging infrastructure (Winston or Pino)

**Phase 1: Core Features (Weeks 3-6)**
1. Homepage (MPA, Redis caching 24h)
2. Authentication flows (login, logout, register)
3. Announcements CRUD (ContentService, 30-min cache)
4. Calendar events (ContentService)
5. Contact forms (CAPTCHA, email queue)
6. Basic admin dashboard

**Phase 2: Real-Time + Integrations (Weeks 7-10)**
1. Live chat (Socket.io WebSocket + REST polling fallback)
2. Moderation queue (Rabbi approval workflow)
3. PayPal donation integration (circuit breaker, retry logic)
4. Email queue worker (async, exponential backoff)
5. Facebook Live streaming (Graph API, recording metadata)
6. Notification system

**Phase 3: Polish + Launch Prep (Weeks 11-13)**
1. WCAG AA compliance testing (axe-core, manual screen reader tests)
2. Mobile responsive testing (375px-1200px)
3. Performance optimization (<2s homepage, <2s chat)
4. Security audit (penetration testing, audit log review)
5. Backup/recovery testing (monthly drill)
6. Documentation finalization (assume-successor standard)
7. Rabbi training, internal validation (Week 1-2 with Rabbi + Board)
8. Public launch (Week 3)

---

### Architecture Approval

**Status:** ✅ **Architecture Complete & Ready for Implementation**

**Validated:**
- ✅ All 118 Functional Requirements supported
- ✅ All 35+ Non-Functional Requirements met
- ✅ Self-hosted constraints addressed
- ✅ Phase 2 migration path defined (MPA → SPA)
- ✅ Risk mitigation strategies documented
- ✅ Technology stack chosen (Node.js, PostgreSQL, Redis, Socket.io)
- ✅ In-house authentication with DB-stored permissions confirmed

**Approved by:** Ilya (Technical Lead, Solo Developer)  
**Approval Date:** 2026-02-01  
**Next Phase:** Epic & Story Breakdown → Implementation

---

### Key Architecture Documents Reference

| Document | Location | Purpose |
|----------|----------|---------|
| **Product Brief** | `product-brief-web-temple-2026-01-31.md` | Vision, personas, success metrics, MVP scope |
| **PRD** | `prd.md` | 118 FRs, 35+ NFRs, user journeys, capability contract |
| **Architecture** | `architecture.md` (this document) | Technical decisions, patterns, system structure, validation |

**Implementation Artifacts Location:** `/Users/g0verdie/workspace/web-temple/_bmad-output/implementation-artifacts/` (to be created during Epic breakdown)

---

_Architecture workflow complete. Document finalized 2026-02-01._

