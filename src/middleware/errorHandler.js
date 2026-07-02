/**
 * src/middleware/errorHandler.js
 * The single terminal Express error sink (I14). Extends the former inline
 * handler in server.js: it preserves the EBADCSRFTOKEN->403 JSON contract,
 * derives status + client-safe message from the central mapping (src/errors),
 * logs full internal detail through winston regardless of what the client sees,
 * and content-negotiates JSON vs the HTML error view.
 */

const logger = require('../utils/logger');
const { mapError } = require('../errors');

// Prefer a JSON body for API clients: the /api prefix, an XHR, or an explicit
// application/json Accept. Otherwise fall back to the HTML error view.
const wantsJson = (req) => {
    const path = req.path || req.originalUrl || '';
    if (path.startsWith('/api')) {
        return true;
    }
    if (req.xhr) {
        return true;
    }
    const accept = req.headers && req.headers.accept;
    return typeof accept === 'string' && accept.includes('application/json');
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    // Handle CSRF token errors (unchanged contract)
    if (err && err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({
            success: false,
            message: 'Invalid CSRF token. Please refresh the page and try again.'
        });
    }

    const { statusCode, clientMessage, expose } = mapError(err);
    const internalMessage = (err && err.message) || String(err);

    // Log full detail for every error regardless of what the client sees.
    logger.error(
        `${statusCode} - ${internalMessage} - ${req.originalUrl} - ${req.method} - ${req.ip}`,
        { stack: err && err.stack, requestId: req.id }
    );

    // Exposed typed errors always show their safe client message. For
    // non-exposed errors the client gets a generic message in production; the
    // existing dev convenience surfaces the real message off-production only.
    const message = expose
        ? clientMessage
        : (process.env.NODE_ENV === 'production' ? clientMessage : internalMessage);

    if (wantsJson(req)) {
        return res.status(statusCode).json({ success: false, message });
    }

    return res.status(statusCode).render('error', {
        title: `${statusCode} - Server Error`,
        message,
        noindex: true
    });
};

module.exports = errorHandler;
