/**
 * Sentry error monitoring (issue #13).
 *
 * Off by default: initialization is a NO-OP unless SENTRY_DSN is set, and is
 * always skipped under NODE_ENV==='test' so the suite adds no event sends and
 * no open handles. When disabled, attachErrorHandler() is also a no-op, so the
 * existing Express error handler is the only one that runs.
 */

const Sentry = require('@sentry/node');
const logger = require('../utils/logger');

let enabled = false;

// Matches email-shaped / @-bearing substrings so donor PII that escaped into an
// error message or breadcrumb (e.g. from a decrypt path) is never sent to
// Sentry. Conservative: redacts the whole local@domain token, not just the @.
const EMAIL_LIKE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const REDACTED = '[redacted-email]';

/**
 * Redact email-shaped substrings from any string. Non-strings pass through.
 */
function scrubString(value) {
    if (typeof value !== 'string') return value;
    return value.replace(EMAIL_LIKE, REDACTED);
}

/**
 * Sentry beforeSend hook: strip email-shaped PII from the event message,
 * exception values, and breadcrumb messages before the event leaves the
 * process. Exported for direct unit testing.
 */
function scrubEvent(event) {
    if (!event || typeof event !== 'object') return event;

    if (typeof event.message === 'string') {
        event.message = scrubString(event.message);
    }

    if (event.exception && Array.isArray(event.exception.values)) {
        event.exception.values.forEach((value) => {
            if (value && typeof value.value === 'string') {
                value.value = scrubString(value.value);
            }
        });
    }

    if (Array.isArray(event.breadcrumbs)) {
        event.breadcrumbs.forEach((crumb) => {
            if (crumb && typeof crumb.message === 'string') {
                crumb.message = scrubString(crumb.message);
            }
        });
    }

    return event;
}

/**
 * Initialize Sentry. Safe to call unconditionally; it short-circuits when
 * disabled. Returns true if Sentry was actually initialized.
 */
function initSentry() {
    if (process.env.NODE_ENV === 'test' || !process.env.SENTRY_DSN) {
        enabled = false;
        return false;
    }

    const tracesSampleRate = process.env.SENTRY_TRACES_SAMPLE_RATE
        ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE)
        : 0;

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
        beforeSend: scrubEvent
    });

    enabled = true;
    logger.info('Sentry error monitoring initialized');
    return true;
}

/**
 * Attach Sentry's Express error handler. Must be registered BEFORE the
 * application's own error handler. No-op when Sentry is disabled.
 */
function attachErrorHandler(app) {
    if (!enabled) return;
    Sentry.setupExpressErrorHandler(app);
}

/**
 * Forward an error to Sentry. No-op when disabled (and thus under
 * NODE_ENV==='test'), so crash handlers can call it unconditionally without
 * importing @sentry/node directly or sending events from the test suite.
 */
function captureException(err) {
    if (!enabled) return;
    Sentry.captureException(err);
}

function isEnabled() {
    return enabled;
}

module.exports = { initSentry, attachErrorHandler, captureException, isEnabled, scrubEvent };
