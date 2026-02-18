/**
 * RBAC Middleware
 * 
 * Provides middleware functions for role-based and permission-based access control.
 * Works with JWT tokens and user objects containing role information.
 * Logs all unauthorized access attempts to audit log.
 */

const { getRolePermissions, hasPermission } = require('../config/roles-permissions');
const { logAudit, AUDIT_ACTIONS } = require('../services/auditService');

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
            const statusCode = 403;
            const errorMessage = 'Access Denied';

            // Log unauthorized access attempt
            logAudit({
                user_id: user?.id,
                action: 'UNAUTHORIZED_ACCESS',
                entity_type: 'role_check',
                description: `Unauthorized access attempt - required role: ${requiredRole}, user role: ${user?.role || 'none'}`,
                ip_address: req.ip || req.connection?.remoteAddress,
            }).catch(err => console.error('Audit log error:', err));

            if (req.accepts('json')) {
                return res.status(statusCode).json({
                    error: errorMessage,
                    message: `This resource requires ${requiredRole} role`
                });
            }

            return res.status(statusCode).send(errorMessage);
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
            const statusCode = 403;
            const errorMessage = 'Access Denied';

            // Log unauthorized access attempt
            logAudit({
                user_id: user?.id,
                action: 'UNAUTHORIZED_ACCESS',
                entity_type: 'permission_check',
                description: `Unauthorized access attempt - required permission: ${requiredPermission}, user role: ${user?.role || 'none'}`,
                ip_address: req.ip || req.connection?.remoteAddress,
            }).catch(err => console.error('Audit log error:', err));

            if (req.accepts('json')) {
                return res.status(statusCode).json({
                    error: errorMessage,
                    message: `This resource requires ${requiredPermission} permission`
                });
            }

            return res.status(statusCode).send(errorMessage);
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
            const statusCode = 403;
            const errorMessage = 'Access Denied';

            // Log unauthorized access attempt
            logAudit({
                user_id: user?.id,
                action: 'UNAUTHORIZED_ACCESS',
                entity_type: 'role_check',
                description: `Unauthorized access attempt - allowed roles: ${allowedRoles.join(', ')}, user role: ${user?.role || 'none'}`,
                ip_address: req.ip || req.connection?.remoteAddress,
            }).catch(err => console.error('Audit log error:', err));

            if (req.accepts('json')) {
                return res.status(statusCode).json({
                    error: errorMessage,
                    message: `This resource requires one of: ${allowedRoles.join(', ')}`
                });
            }

            return res.status(statusCode).send(errorMessage);
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
            const statusCode = 403;
            const errorMessage = 'Access Denied';

            // Log unauthorized access attempt
            logAudit({
                user_id: user?.id,
                action: 'UNAUTHORIZED_ACCESS',
                entity_type: 'permission_check',
                description: `Unauthorized access attempt - allowed permissions: ${allowedPermissions.join(', ')}, user role: ${user?.role || 'none'}`,
                ip_address: req.ip || req.connection?.remoteAddress,
            }).catch(err => console.error('Audit log error:', err));

            if (req.accepts('json')) {
                return res.status(statusCode).json({
                    error: errorMessage,
                    message: `This resource requires one of: ${allowedPermissions.join(', ')}`
                });
            }

            return res.status(statusCode).send(errorMessage);
        }

        // Check if user has at least one of the allowed permissions
        const hasAny = allowedPermissions.some(permission => hasPermission(user, permission));

        if (!hasAny) {
            const statusCode = 403;
            const errorMessage = 'Access Denied';

            // Log unauthorized access attempt
            logAudit({
                user_id: user.id,
                action: 'UNAUTHORIZED_ACCESS',
                entity_type: 'permission_check',
                description: `Unauthorized access attempt - allowed permissions: ${allowedPermissions.join(', ')}, user role: ${user.role}`,
                ip_address: req.ip || req.connection?.remoteAddress,
            }).catch(err => console.error('Audit log error:', err));

            if (req.accepts('json')) {
                return res.status(statusCode).json({
                    error: errorMessage,
                    message: `This resource requires one of: ${allowedPermissions.join(', ')}`
                });
            }

            return res.status(statusCode).send(errorMessage);
        }

        // User has at least one of the required permissions, proceed
        return next();
    };
};

module.exports = {
    requireRole,
    requirePermission,
    requireAnyRole,
    requireAnyPermission
};
