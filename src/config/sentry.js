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
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0
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

function isEnabled() {
    return enabled;
}

module.exports = { initSentry, attachErrorHandler, isEnabled };
