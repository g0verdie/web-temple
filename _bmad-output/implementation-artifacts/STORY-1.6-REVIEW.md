# Code Review: Story 1.6 - Database Encryption at Rest

**Reviewer:** Senior Developer (AI)
**Date:** 2026-02-05
**Story:** 1.6
**Status:** Approved (Fixes Applied)

## ✅ Fixes Applied via Automated Review

The following critical and high-priority issues have been fixed:

### 1. Donation Encryption Schema
- **Issue:** Plaintext `amount_cents` column defeated encryption.
- **Fix:** Removed `amount_cents` column from `migrations/004_create_donations_table.sql`. Donation amounts are now strictly encrypted using application-level AES-256-CBC.

### 2. Password Reset Implementation
- **Issue:** Token generation was implemented but token storage was missing.
- **Fix:** Created `migrations/005_create_password_resets_table.sql`. Updated `src/services/authService.js` to store tokens in the database with expiry.

### 3. Audit Logging Security
- **Issue:** Audit logs were failing silently ("fail-open").
- **Fix:** Updated `src/utils/auditHelper.js` to throw errors on critical failures ("fail-closed"), ensuring sensitive actions are blocked if they cannot be audited.

### 4. Password Complexity
- **Issue:** Complexity requirements (upper/lower/symbol) were ignored.
- **Fix:** Added regex validation to `authService.js`.

### 5. Backup Security
- **Issue:** Unencrypted intermediate file on disk.
- **Fix:** Updated `scripts/backup.sh` to use piped operations (`pg_dump | openssl`) to prevent plaintext data from touching the disk.

## 🧪 Verification
- **Tests:** `authService.test.js` updated with improved isolation (`beforeEach` cleanup). All 10 integration tests passed.
- **Migrations:** Applied migrations 003, 004, 005.

---

**Outcome:** All critical findings resolved. Story 1.6 is **APPROVED**.
