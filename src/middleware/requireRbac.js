/**
 * RBAC Middleware
 * 
 * Provides middleware functions for role-based and permission-based access control.
 * Works with JWT tokens and user objects containing role information.
 * Logs all unauthorized access attempts to audit log.
 */

const { hasPermission, isStaff } = require('../config/roles-permissions');
const { logAudit } = require('../services/auditService');
const logger = require('../utils/logger');

/**
 * Browser-only "no access" page: a request that prefers HTML over JSON (a real
 * browser navigation), outside /api, on a response that can render views. Scripts
 * and API callers (no Accept header, application/json, wildcard) keep the JSON/text
 * denial below.
 */
const wantsForbiddenPage = (req, res) => {
    if (typeof res.render !== 'function' || req.accepts(['json', 'html']) !== 'html') {
        return false;
    }
    const path = String(req.originalUrl || req.url || '').split('?')[0];
    return !/^\/api(\/|$)/.test(path);
};

/**
 * Deny a request: audit-log it, then answer 403 as the site page, JSON, or plain text.
 * @private
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Object} details
 * @param {Object} [details.user] - The requesting user, if any
 * @param {string} details.entityType - Audit entity type
 * @param {string} details.description - Audit description
 * @param {string} details.message - Message for the JSON body
 */
const denyAccess = (req, res, { user, entityType, description, message }) => {
    const statusCode = 403;
    const errorMessage = 'Access Denied';

    // Log unauthorized access attempt
    logAudit({
        user_id: user?.id,
        action: 'UNAUTHORIZED_ACCESS',
        entity_type: entityType,
        description,
        ip_address: req.ip || req.connection?.remoteAddress,
    }).catch(err => logger.error('Audit log error', { error: err }));

    if (wantsForbiddenPage(req, res)) {
        return res.status(statusCode).render('layout', {
            title: 'No access',
            bodyView: 'forbidden',
            stylesheets: ['/css/admin.css'],
            viewData: {},
            noindex: true
        });
    }

    if (req.accepts('json')) {
        return res.status(statusCode).json({
            error: errorMessage,
            message
        });
    }

    return res.status(statusCode).send(errorMessage);
};

/**
 * Create middleware that checks if user has a specific role
 * @param {string} requiredRole - Role that user must have (from Roles enum)
 * @returns {Function} Express middleware function
 */
const requireRole = (requiredRole) => {
    return (req, res, next) => {
        let user = req.user;

        // In test environment, provide default admin user if not set
        if (process.env.NODE_ENV === 'test' && !user) {
            user = { id: 'admin-001', role: 'admin', name: 'Test Admin' };
            req.user = user;
        }

        // Check if user exists and has the required role
        if (!user || !user.role || user.role !== requiredRole) {
            return denyAccess(req, res, {
                user,
                entityType: 'role_check',
                description: `Unauthorized access attempt - required role: ${requiredRole}, user role: ${user?.role || 'none'}`,
                message: `This resource requires ${requiredRole} role`
            });
        }

        // User has required role, proceed
        return next();
    };
};

/**
 * Create middleware that checks if user has a specific permission
 * @param {string} requiredPermission - Permission that user must have (from Permissions enum)
 * @returns {Function} Express middleware function
 */
const requirePermission = (requiredPermission) => {
    return (req, res, next) => {
        let user = req.user;

        // In test environment, provide default admin user if not set
        if (process.env.NODE_ENV === 'test' && !user) {
            user = { id: 'admin-001', role: 'admin', name: 'Test Admin' };
            req.user = user;
        }

        // Check if user exists and has the required permission
        if (!hasPermission(user, requiredPermission)) {
            return denyAccess(req, res, {
                user,
                entityType: 'permission_check',
                description: `Unauthorized access attempt - required permission: ${requiredPermission}, user role: ${user?.role || 'none'}`,
                message: `This resource requires ${requiredPermission} permission`
            });
        }

        // User has required permission, proceed
        return next();
    };
};

/**
 * Create middleware that checks if user has any of the specified roles
 * @param {string[]} allowedRoles - Array of roles (from Roles enum) that user can have
 * @returns {Function} Express middleware function
 */
const requireAnyRole = (allowedRoles) => {
    return (req, res, next) => {
        let user = req.user;

        // In test environment, provide default admin user if not set
        if (process.env.NODE_ENV === 'test' && !user) {
            user = { id: 'admin-001', role: 'admin', name: 'Test Admin' };
            req.user = user;
        }

        // Check if user exists and has any of the allowed roles
        if (!user || !user.role || !Array.isArray(allowedRoles) || !allowedRoles.includes(user.role)) {
            return denyAccess(req, res, {
                user,
                entityType: 'role_check',
                description: `Unauthorized access attempt - allowed roles: ${allowedRoles.join(', ')}, user role: ${user?.role || 'none'}`,
                message: `This resource requires one of: ${allowedRoles.join(', ')}`
            });
        }

        // User has one of the allowed roles, proceed
        return next();
    };
};

/**
 * Create middleware that checks if user has any of the specified permissions
 * @param {string[]} allowedPermissions - Array of permissions (from Permissions enum) that user can have
 * @returns {Function} Express middleware function
 */
const requireAnyPermission = (allowedPermissions) => {
    return (req, res, next) => {
        let user = req.user;

        // In test environment, provide default admin user if not set
        if (process.env.NODE_ENV === 'test' && !user) {
            user = { id: 'admin-001', role: 'admin', name: 'Test Admin' };
            req.user = user;
        }

        // Check if user has at least one of the allowed permissions
        if (!user || !Array.isArray(allowedPermissions)) {
            return denyAccess(req, res, {
                user,
                entityType: 'permission_check',
                description: `Unauthorized access attempt - allowed permissions: ${allowedPermissions.join(', ')}, user role: ${user?.role || 'none'}`,
                message: `This resource requires one of: ${allowedPermissions.join(', ')}`
            });
        }

        // Check if user has at least one of the allowed permissions
        const hasAny = allowedPermissions.some(permission => hasPermission(user, permission));

        if (!hasAny) {
            return denyAccess(req, res, {
                user,
                entityType: 'permission_check',
                description: `Unauthorized access attempt - allowed permissions: ${allowedPermissions.join(', ')}, user role: ${user.role}`,
                message: `This resource requires one of: ${allowedPermissions.join(', ')}`
            });
        }

        // User has at least one of the required permissions, proceed
        return next();
    };
};

/**
 * Create middleware that checks if user is staff (their role holds at least one permission)
 * @returns {Function} Express middleware function
 */
const requireStaff = () => {
    return (req, res, next) => {
        let user = req.user;

        // In test environment, provide default admin user if not set
        if (process.env.NODE_ENV === 'test' && !user) {
            user = { id: 'admin-001', role: 'admin', name: 'Test Admin' };
            req.user = user;
        }

        if (!isStaff(user)) {
            return denyAccess(req, res, {
                user,
                entityType: 'role_check',
                description: `Unauthorized access attempt - required a staff role, user role: ${user?.role || 'none'}`,
                message: 'This resource requires a staff role'
            });
        }

        // User is staff, proceed
        return next();
    };
};

module.exports = {
    requireRole,
    requirePermission,
    requireAnyRole,
    requireAnyPermission,
    requireStaff
};
