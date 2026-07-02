/**
 * src/errors/index.js
 * Typed error hierarchy (I14) plus one central mapping used by BOTH the Express
 * terminal error handler (src/middleware/errorHandler.js) and the chat WebSocket
 * handler (src/services/chatSocketServer.js).
 *
 * The typed error is the single source of truth for the HTTP status and the
 * client-safe message; controllers and the WS handler no longer inspect message
 * text to decide a status. Type -> status is fixed: ValidationError->400
 * (preserving current codes), NotFoundError->404, AuthError->401/403,
 * ProviderError->502, InternalError->500. Untyped/unknown throws default to 500
 * with a generic message, which is what makes incremental adoption safe.
 */

const GENERIC_ERROR_MESSAGE = 'Something went wrong';

/**
 * Base application error. Operational subclasses (Validation/NotFound/Auth/
 * Provider) set expose:true so their message may reach the client; InternalError
 * keeps expose:false so its detail stays server-side.
 */
class AppError extends Error {
    constructor(message, { statusCode = 500, clientMessage, expose = false, details, cause } = {}) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.expose = expose;
        this.clientMessage = clientMessage || (expose ? message : GENERIC_ERROR_MESSAGE);
        if (details !== undefined) {
            this.details = details;
        }
        if (cause !== undefined) {
            this.cause = cause;
        }
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            statusCode: 400,
            expose: true,
            clientMessage: options.clientMessage || message
        });
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Not found', options = {}) {
        super(message, {
            ...options,
            statusCode: 404,
            expose: true,
            clientMessage: options.clientMessage || message
        });
    }
}

/**
 * AuthError supports both 401 (unauthenticated) and 403 (forbidden) via a
 * statusCode option; anything other than 403 falls back to 401.
 */
class AuthError extends AppError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            statusCode: options.statusCode === 403 ? 403 : 401,
            expose: true,
            clientMessage: options.clientMessage || message
        });
    }
}

class ProviderError extends AppError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            statusCode: 502,
            expose: true,
            clientMessage: options.clientMessage || message
        });
    }
}

class InternalError extends AppError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            statusCode: 500,
            expose: false,
            clientMessage: GENERIC_ERROR_MESSAGE
        });
    }
}

/**
 * Central mapping (R5). Given any thrown value, returns the status, the
 * client-safe message, and whether that message may be shown. An AppError maps
 * by its own fields but a non-exposed one never leaks its message; anything else
 * maps to 500 with a generic message.
 */
function mapError(err) {
    if (err instanceof AppError) {
        return {
            statusCode: err.statusCode,
            clientMessage: err.expose ? err.clientMessage : GENERIC_ERROR_MESSAGE,
            expose: err.expose
        };
    }
    return {
        statusCode: 500,
        clientMessage: GENERIC_ERROR_MESSAGE,
        expose: false
    };
}

module.exports = {
    AppError,
    ValidationError,
    NotFoundError,
    AuthError,
    ProviderError,
    InternalError,
    mapError,
    GENERIC_ERROR_MESSAGE
};
