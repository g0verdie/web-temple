const { v4: uuidv4 } = require('uuid');

/**
 * Middleware to inject request ID into all requests for distributed tracing
 * Request ID is stored in res.locals.requestId for access throughout request lifecycle
 */
function requestIdMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || req.headers['x-correlation-id'] || uuidv4();
    res.locals.requestId = requestId;
    
    // Add to response headers for client
    res.setHeader('X-Request-ID', requestId);
    
    // Store in request for access in downstream middleware
    req.id = requestId;
    req.requestId = requestId;
    
    next();
}

module.exports = requestIdMiddleware;
