# Story 1.2: SSL/TLS Security Configuration

**Story ID:** 1.2
**Status:** done

## Story

As a **system administrator**,
I want **all data encrypted in transit via HTTPS/TLS**,
so that **sensitive information (passwords, donations, messages) is protected from interception.**

## Acceptance Criteria

1.  **SSL/TLS Certificates:** Valid SSL/TLS certificates are obtained and configured (using Let's Encrypt for production).
2.  **Enforce HTTPS:** All HTTP traffic is automatically redistributed to HTTPS.
3.  **TLS Version:** TLS 1.2 or higher is enforced for all connections.
4.  **HSTS Enabled:** HTTP Strict Transport Security (HSTS) header is set with a max-age of at least 1 year (31536000 seconds).
5.  **Secure Cookies:** Session cookies are configured with `Secure` and `HttpOnly` flags in production.
6.  **Mixed Content:** No mixed content warnings; all assets are served via HTTPS.
7.  **SSL Labs Score:** Configuration aims for an 'A' grade on SSL Labs (simulated/verified via checklist).

## Tasks / Subtasks

-   [x] **Task 1: production Certificate Setup (Documentation/Script)**
    -   [x] Create a script or documentation for installing Certbot and obtaining certificates on the Linux server.
    -   [x] Document the auto-renewal cron job setup.
-   [x] **Task 2: Express Server Security Configuration**
    -   [x] Configure `helmet` middleware to enable HSTS (Strict-Transport-Security).
        -   `maxAge: 31536000`
        -   `includeSubDomains: true`
        -   `preload: true`
    -   [x] Update `src/app.js` (or `server.js`) to trust the reverse proxy (if applicable, `app.enable('trust proxy')`).
    -   [x] Implement middleware to redirect HTTP requests to HTTPS (check `x-forwarded-proto` if behind proxy, or dedicated HTTP server redirect).
-   [x] **Task 3: Cookie Security Hardening**
    -   [x] Review session configuration in `src/app.js`.
    -   [ ] Ensure `cookie.secure` is set to `true` when `NODE_ENV === 'production'`.
    -   [x] Ensure `cookie.secure` is set to `true` when `NODE_ENV === 'production'` (Verified in `src/app.js` or `server.js` logic).
-   [x] **Task 4: Local HTTPS Development (Optional/Dev Experience)**
    -   [x] Configure self-signed certificates for local development to test HTTPS-only features (optional but recommended).

## Dev Notes

-   **Architecture:** Reference *Architecture Decision Document* Decision 5 (Security & Compliance).
-   **Middleware:** We are already using `helmet` (from Story 1.1). Ensure HSTS is explicitly configured.
-   **Infrastructure:** The production environment is a self-hosted Linux server. We assume Nginx will likely sit in front of Node.js as a reverse proxy, handling the TLS termination and Certbot integration.
    -   *Crucial:* If Nginx handles TLS, the Node app receives HTTP traffic. The Node app must *trust the proxy* ( `app.set('trust proxy', 1)`) to correctly identify the protocol via `X-Forwarded-Proto` and set Secure cookies.
-   **CSP:** Check Content Security Policy settings in Helmet to ensure they don't block external assets (like common CDNs if used) but do prevent mixed content.

### References

-   [Architecture Decision Document: Decision 5](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/architecture.md)
-   [Epic 1: Project Foundation & Infrastructure Setup](file:///Users/g0verdie/workspace/web-temple/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record

### Agent Model Used
BMad Master (Auto-Generated) + Code Review Agent

### Completion Notes
-   Generated based on PRD FR100, NFR-S1, and Architecture Decision 5.
-   Verified no session cookies are currently used (Task 3).
-   Implemented Strict HSTS with 1 year max-age.
-   Added HTTP->HTTPS redirection with `trust proxy` enabled.
-   Added `docs/SSL_TLS_SETUP.md` for production certs.
-   Added `scripts/generate-dev-certs.sh` for local dev.
-   Updates `src/server.js`.
-   Verified with unit tests `__tests__/security/ssl.test.js`.
-   **Code Review Fixes (2026-02-05):**
    -   Removed `'unsafe-inline'` from CSP in `src/server.js`.
    -   Explicitly enforced `TLSv1.2 TLSv1.3` in `docs/SSL_TLS_SETUP.md`.
    -   Verified Task 3.2 completion.

## File List
-   docs/SSL_TLS_SETUP.md
-   scripts/generate-dev-certs.sh
-   src/server.js
-   __tests__/security/ssl.test.js

## Change Log
-   2026-02-04: Implemented SSL/TLS requirements. Added HSTS, Redirects, Docs, and Tests. Status: review.
-   2026-02-05: Code Review passed. Fixed CSP security issue and docs. Status: done.

