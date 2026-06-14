/**
 * Roles and Permissions Configuration
 * 
 * Defines role-based access control (RBAC) system with:
 * - Role enums (ADMIN, RABBI, SOCIAL_CHAIR, MEMBER)
 * - Permission enums for granular access control
 * - Role-to-permission mappings
 * 
 * All permissions are defined in-memory for performance (no DB lookups).
 * Changes to role permissions should go through code review.
 */

// ============================================================================
// ROLES - Define all available user roles
// ============================================================================
const Roles = Object.freeze({
    ADMIN: 'admin',
    RABBI: 'rabbi',
    SOCIAL_CHAIR: 'social_chair',
    TREASURER: 'treasurer',
    MEMBER: 'member' // Default role for regular users
});

// ============================================================================
// PERMISSIONS - Define all granular permissions
// ============================================================================
const Permissions = Object.freeze({
    // Metrics & Analytics
    VIEW_METRICS: 'view_metrics',
    
    // Message management
    MANAGE_MESSAGES: 'manage_messages',
    
    // Announcements
    POST_ANNOUNCEMENTS: 'post_announcements',
    
    // Calendar management
    MANAGE_CALENDAR: 'manage_calendar',
    
    // Content & Pages
    MANAGE_CONTENT: 'manage_content',
    
    // Donations
    VIEW_DONATIONS: 'view_donations',

    // Livestream scheduling — a dedicated permission was introduced instead of
    // reusing MANAGE_CALENDAR so that streaming access can be granted or revoked
    // independently of calendar management (see Story 3.6 design decision).
    MANAGE_STREAMING: 'manage_streaming',

    // Live chat moderation permission for live streams
    MODERATE_CHAT: 'moderate_chat'
});

// ============================================================================
// ROLE-TO-PERMISSIONS MAPPING
// ============================================================================
const rolePermissionMap = {
    [Roles.ADMIN]: [
        // Admin has ALL permissions
        Permissions.VIEW_METRICS,
        Permissions.MANAGE_MESSAGES,
        Permissions.POST_ANNOUNCEMENTS,
        Permissions.MANAGE_CALENDAR,
        Permissions.MANAGE_CONTENT,
        Permissions.VIEW_DONATIONS,
        Permissions.MANAGE_STREAMING,  // See Permissions block for rationale
        Permissions.MODERATE_CHAT
    ],
    [Roles.RABBI]: [
        // FR26: Rabbi can post announcements, manage calendars, reply to messages, view donations
        Permissions.POST_ANNOUNCEMENTS,
        Permissions.MANAGE_CALENDAR,
        Permissions.MANAGE_MESSAGES,
        Permissions.VIEW_DONATIONS,
        Permissions.MANAGE_STREAMING,  // See Permissions block for rationale
        Permissions.MODERATE_CHAT
    ],
    [Roles.SOCIAL_CHAIR]: [
        // FR27: Social Chair (Phase 2) can post announcements and manage public calendar only
        Permissions.POST_ANNOUNCEMENTS,
        Permissions.MANAGE_CALENDAR,
        Permissions.MODERATE_CHAT
    ],
    [Roles.TREASURER]: [
        // Treasurer can view donations
        Permissions.VIEW_DONATIONS
    ],
    [Roles.MEMBER]: [
        // Regular members have no administrative permissions
    ]
};

// ============================================================================
// PUBLIC API - Export functions and enums
// ============================================================================

/**
 * Get all permissions for a given role
 * @param {string} role - The role to query (from Roles enum)
 * @returns {string[]} Array of permission strings, empty array if role not found
 */
const getRolePermissions = (role) => {
    if (!role || !Object.prototype.hasOwnProperty.call(rolePermissionMap, role)) {
        return [];
    }
    return [...rolePermissionMap[role]]; // Return copy to prevent external mutation
};

/**
 * Check if a user has a specific permission
 * @param {Object} user - User object with 'role' property
 * @param {string} permission - Permission to check (from Permissions enum)
 * @returns {boolean} True if user's role has the permission, false otherwise
 */
const hasPermission = (user, permission) => {
    if (!user || !user.role || !permission) {
        return false;
    }
    
    const userPermissions = getRolePermissions(user.role);
    return userPermissions.includes(permission);
};

/**
 * Check if a user has a specific role
 * @param {Object} user - User object with 'role' property
 * @param {string} role - Role to check (from Roles enum)
 * @returns {boolean} True if user has the role, false otherwise
 */
const hasRole = (user, role) => {
    return user && user.role === role;
};

/**
 * Check if user has any of the specified roles
 * @param {Object} user - User object with 'role' property
 * @param {string[]} roles - Array of roles to check
 * @returns {boolean} True if user has any of the specified roles
 */
const hasAnyRole = (user, roles) => {
    if (!user || !Array.isArray(roles)) {
        return false;
    }
    return roles.includes(user.role);
};

/**
 * Check if user is an admin (either ADMIN or RABBI)
 * @param {Object} user - User object with 'role' property
 * @returns {boolean} True if user is ADMIN or RABBI
 */
const isAdmin = (user) => {
    return hasAnyRole(user, [Roles.ADMIN, Roles.RABBI]);
};

module.exports = {
    Roles,
    Permissions,
    getRolePermissions,
    hasPermission,
    hasRole,
    hasAnyRole,
    isAdmin
};
