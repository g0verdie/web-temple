/**
 * preflight.js — fail-closed boot preflight
 * (docs/plans/2026-07-01-004-feat-boot-preflight-plan.md).
 *
 * A production-only Minimum-Equipment-List gate. Before the HTTP listener
 * starts, the process asserts each enumerated config check:
 *   - Security tier (fatal): a misconfiguration that must never reach
 *     production. Any failure refuses the boot (process exits non-zero).
 *   - Content tier (warn): a typo that should not take the site down. Each
 *     failure logs a prominent startup warning and boot proceeds.
 *
 * Every check is evaluated and all failures are aggregated (not first-fail), so
 * one boot surfaces every problem. Inert unless NODE_ENV === 'production': dev
 * and test boots are never blocked, respecting the load-bearing NODE_ENV
 * branches elsewhere in the app.
 */

const logger = require('../utils/logger');
const { resolvePgSsl } = require('./pgSsl');

// Known non-secret placeholder values (case-insensitive) that must never ship
// as a real JWT_SECRET. Includes the committed .env value (`your_jwt_secret_key`)
// and the test-suite fallback.
const JWT_PLACEHOLDERS = new Set([
    'your_jwt_secret_key',
    'your_jwt_secret_key_here',
    'changeme',
    'change_me',
    'secret',
    'test-jwt-secret',
]);

// Placeholder values that must never ship as a real ENCRYPTION_KEY.
const ENCRYPTION_PLACEHOLDERS = new Set([
    'your_encryption_key',
    'your_encryption_key_here',
    'changeme',
    'change_me',
]);

// Mirrors src/utils/encryptionHelper.js validateKey() so the preflight does not
// green-light a key the encryption path would later reject.
const MIN_ENCRYPTION_KEY_LENGTH = 32;

// Hosts that mean "this machine" — an APP_URL pointing at any of them yields
// broken email links and calendar feeds in production.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]', '']);

const normalize = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Evaluate every preflight check against an environment map. Pure and
 * side-effect-free (no logging, no process.exit) so it is directly testable.
 *
 * @param {object} env - environment map (defaults to process.env)
 * @returns {{ fatal: string[], warnings: string[] }} aggregated failures, each
 *   message naming the failed check and the reason.
 */
function evaluatePreflight(env = process.env) {
    const fatal = [];
    const warnings = [];

    // R8 — JWT_SECRET must be non-empty and not a known placeholder.
    const jwt = normalize(env.JWT_SECRET);
    if (!jwt) {
        fatal.push('JWT_SECRET is not set — tokens cannot be signed or verified.');
    } else if (JWT_PLACEHOLDERS.has(jwt.toLowerCase())) {
        fatal.push('JWT_SECRET is set to a known placeholder value — set a unique random secret.');
    }

    // R9 — ENCRYPTION_KEY must be non-empty, not a placeholder, and long enough
    // to satisfy encryptionHelper (≥32 chars).
    const encKey = normalize(env.ENCRYPTION_KEY);
    if (!encKey) {
        fatal.push('ENCRYPTION_KEY is not set — sensitive fields cannot be encrypted.');
    } else if (ENCRYPTION_PLACEHOLDERS.has(encKey.toLowerCase())) {
        fatal.push('ENCRYPTION_KEY is set to a known placeholder value — set a unique random key.');
    } else if (encKey.length < MIN_ENCRYPTION_KEY_LENGTH) {
        fatal.push(
            `ENCRYPTION_KEY must be at least ${MIN_ENCRYPTION_KEY_LENGTH} characters (256 bits) — the current value is too short.`
        );
    }

    // R10 — APP_URL must be set and must not point at localhost/loopback.
    const appUrl = normalize(env.APP_URL);
    if (!appUrl) {
        fatal.push('APP_URL is not set — emails, iCal feeds, and calendar links would point at localhost.');
    } else {
        let host;
        try {
            host = new URL(appUrl).hostname.toLowerCase();
        } catch (e) {
            host = null;
        }
        if (host === null) {
            fatal.push(`APP_URL is not a valid URL: "${appUrl}".`);
        } else if (LOOPBACK_HOSTS.has(host)) {
            fatal.push(`APP_URL points at localhost/loopback ("${appUrl}") — set the public site URL.`);
        }
    }

    // R11 — the effective Postgres TLS config must verify the server
    // certificate. rejectUnauthorized:false disables verification even when a CA
    // is present (Node tls ignores the CA), so it is fatal regardless of ca;
    // resolvePgSsl already forces verification on whenever a CA is supplied.
    const ssl = resolvePgSsl(env);
    if (ssl && typeof ssl === 'object' && ssl.rejectUnauthorized === false) {
        fatal.push(
            'Postgres TLS verification is disabled (rejectUnauthorized:false) — the server certificate is not verified. Set DATABASE_SSL_REJECT_UNAUTHORIZED=true or supply DATABASE_CA_CERT.'
        );
    }

    // R12 — FACEBOOK_PAGE_ID, if set, must be numeric.
    const pageId = normalize(env.FACEBOOK_PAGE_ID);
    if (pageId && !/^\d+$/.test(pageId)) {
        warnings.push(
            'FACEBOOK_PAGE_ID is not numeric — past-video cards will render blank. Use the numeric Page ID, not a vanity name or share-slug.'
        );
    }

    // R13 — TEMPLE_EIN must be present.
    if (!normalize(env.TEMPLE_EIN)) {
        warnings.push('TEMPLE_EIN is not set — donation receipts will render a placeholder EIN.');
    }

    return { fatal, warnings };
}

/**
 * Production boot gate. Inert unless NODE_ENV === 'production'. Logs all content
 * warnings, and on any security-tier failure logs each reason and exits
 * non-zero so the HTTP listener never starts (fail-closed).
 */
function runPreflight() {
    if (process.env.NODE_ENV !== 'production') {
        return;
    }

    const { fatal, warnings } = evaluatePreflight(process.env);

    warnings.forEach((message) => {
        logger.warn(`Boot preflight warning: ${message}`);
    });

    if (fatal.length > 0) {
        fatal.forEach((message) => {
            logger.error(`Boot preflight FATAL: ${message}`);
        });
        logger.error(
            `Boot preflight refused startup: ${fatal.length} security check(s) failed. Fix the above and redeploy.`
        );
        process.exit(1);
        return;
    }

    logger.info('Boot preflight passed: all security checks satisfied.');
}

module.exports = { evaluatePreflight, runPreflight };
