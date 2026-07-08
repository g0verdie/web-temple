const { Roles, Permissions, getRolePermissions, hasPermission } = require('../../src/config/roles-permissions');

describe('Roles & Permissions Configuration', () => {
    describe('Roles enum', () => {
        it('should define all required roles', () => {
            expect(Roles.ADMIN).toBe('admin');
            expect(Roles.RABBI).toBe('rabbi');
            expect(Roles.SOCIAL_CHAIR).toBe('social_chair');
            expect(Roles.MEMBER).toBe('member');
        });

        it('should have no undefined roles', () => {
            Object.values(Roles).forEach(role => {
                expect(role).toBeDefined();
                expect(typeof role).toBe('string');
            });
        });
    });

    describe('Permissions enum', () => {
        it('should define all required permissions', () => {
            expect(Permissions.VIEW_METRICS).toBe('view_metrics');
            expect(Permissions.MANAGE_MESSAGES).toBe('manage_messages');
            expect(Permissions.POST_ANNOUNCEMENTS).toBe('post_announcements');
            expect(Permissions.MANAGE_CALENDAR).toBe('manage_calendar');
            expect(Permissions.MANAGE_CONTENT).toBe('manage_content');
            expect(Permissions.VIEW_DONATIONS).toBe('view_donations');
        });

        it('should have no undefined permissions', () => {
            Object.values(Permissions).forEach(perm => {
                expect(perm).toBeDefined();
                expect(typeof perm).toBe('string');
            });
        });
    });

    describe('getRolePermissions', () => {
        it('should return all permissions for ADMIN role', () => {
            const adminPerms = getRolePermissions(Roles.ADMIN);
            expect(Array.isArray(adminPerms)).toBe(true);
            expect(adminPerms.length).toBeGreaterThan(0);
            
            // Admin should have all permissions
            expect(adminPerms).toContain(Permissions.VIEW_METRICS);
            expect(adminPerms).toContain(Permissions.MANAGE_MESSAGES);
            expect(adminPerms).toContain(Permissions.POST_ANNOUNCEMENTS);
            expect(adminPerms).toContain(Permissions.MANAGE_CALENDAR);
            expect(adminPerms).toContain(Permissions.MANAGE_CONTENT);
            expect(adminPerms).toContain(Permissions.VIEW_DONATIONS);
        });

        it('should return correct permissions for RABBI role', () => {
            const rabbiPerms = getRolePermissions(Roles.RABBI);
            expect(Array.isArray(rabbiPerms)).toBe(true);
            
            // Rabbi can: post announcements, manage calendar, manage messages,
            // view donations, manage content (KTD4: CMS editing for Rabbi/Admin)
            expect(rabbiPerms).toContain(Permissions.POST_ANNOUNCEMENTS);
            expect(rabbiPerms).toContain(Permissions.MANAGE_CALENDAR);
            expect(rabbiPerms).toContain(Permissions.MANAGE_MESSAGES);
            expect(rabbiPerms).toContain(Permissions.VIEW_DONATIONS);
            expect(rabbiPerms).toContain(Permissions.MANAGE_CONTENT);

            // Rabbi cannot: view metrics
            expect(rabbiPerms).not.toContain(Permissions.VIEW_METRICS);
        });

        it('should return correct permissions for SOCIAL_CHAIR role', () => {
            const chairPerms = getRolePermissions(Roles.SOCIAL_CHAIR);
            expect(Array.isArray(chairPerms)).toBe(true);
            
            // Social Chair can: post announcements, manage calendar (public only, but we don't distinguish here)
            expect(chairPerms).toContain(Permissions.POST_ANNOUNCEMENTS);
            expect(chairPerms).toContain(Permissions.MANAGE_CALENDAR);
            
            // Social Chair cannot: view metrics, manage messages, manage content, view donations
            expect(chairPerms).not.toContain(Permissions.VIEW_METRICS);
            expect(chairPerms).not.toContain(Permissions.MANAGE_MESSAGES);
            expect(chairPerms).not.toContain(Permissions.MANAGE_CONTENT);
            expect(chairPerms).not.toContain(Permissions.VIEW_DONATIONS);
        });

        it('should return minimal permissions for MEMBER role', () => {
            const memberPerms = getRolePermissions(Roles.MEMBER);
            expect(Array.isArray(memberPerms)).toBe(true);
            
            // Members have no administrative permissions
            expect(memberPerms.length).toBe(0);
        });

        it('should return empty array for unknown role', () => {
            const unknownPerms = getRolePermissions('unknown_role');
            expect(Array.isArray(unknownPerms)).toBe(true);
            expect(unknownPerms.length).toBe(0);
        });
    });

    describe('hasPermission', () => {
        it('should return true if user role has permission', () => {
            const user = { role: Roles.ADMIN };
            expect(hasPermission(user, Permissions.VIEW_METRICS)).toBe(true);
            expect(hasPermission(user, Permissions.MANAGE_MESSAGES)).toBe(true);
        });

        it('should return false if user role lacks permission', () => {
            const user = { role: Roles.MEMBER };
            expect(hasPermission(user, Permissions.VIEW_METRICS)).toBe(false);
            expect(hasPermission(user, Permissions.MANAGE_MESSAGES)).toBe(false);
        });

        it('should return false if user is undefined', () => {
            expect(hasPermission(undefined, Permissions.VIEW_METRICS)).toBe(false);
        });

        it('should return false if user role is undefined', () => {
            const user = { role: undefined };
            expect(hasPermission(user, Permissions.VIEW_METRICS)).toBe(false);
        });

        it('should return false if permission is undefined', () => {
            const user = { role: Roles.ADMIN };
            expect(hasPermission(user, undefined)).toBe(false);
        });

        it('should work correctly for RABBI role', () => {
            const user = { role: Roles.RABBI };
            expect(hasPermission(user, Permissions.POST_ANNOUNCEMENTS)).toBe(true);
            expect(hasPermission(user, Permissions.MANAGE_CALENDAR)).toBe(true);
            expect(hasPermission(user, Permissions.VIEW_METRICS)).toBe(false);
        });

        it('should work correctly for SOCIAL_CHAIR role', () => {
            const user = { role: Roles.SOCIAL_CHAIR };
            expect(hasPermission(user, Permissions.POST_ANNOUNCEMENTS)).toBe(true);
            expect(hasPermission(user, Permissions.MANAGE_CALENDAR)).toBe(true);
            expect(hasPermission(user, Permissions.MANAGE_MESSAGES)).toBe(false);
        });
    });

    describe('MANAGE_DIRECTORY permission (member directory)', () => {
        it('is defined', () => {
            expect(Permissions.MANAGE_DIRECTORY).toBe('manage_directory');
        });

        it('is granted to ADMIN and RABBI only', () => {
            expect(hasPermission({ role: Roles.ADMIN }, Permissions.MANAGE_DIRECTORY)).toBe(true);
            expect(hasPermission({ role: Roles.RABBI }, Permissions.MANAGE_DIRECTORY)).toBe(true);
            expect(hasPermission({ role: Roles.MEMBER }, Permissions.MANAGE_DIRECTORY)).toBe(false);
            expect(hasPermission({ role: Roles.SOCIAL_CHAIR }, Permissions.MANAGE_DIRECTORY)).toBe(false);
            expect(hasPermission({ role: Roles.TREASURER }, Permissions.MANAGE_DIRECTORY)).toBe(false);
        });
    });

    describe('MEMBERSHIP_DIRECTOR role (item 13)', () => {
        it('is defined', () => {
            expect(Roles.MEMBERSHIP_DIRECTOR).toBe('membership_director');
        });

        it('has admin-like membership/content management permissions', () => {
            const perms = getRolePermissions(Roles.MEMBERSHIP_DIRECTOR);
            expect(perms).toContain(Permissions.MANAGE_MEMBERS);
            expect(perms).toContain(Permissions.MANAGE_DIRECTORY);
            expect(perms).toContain(Permissions.POST_ANNOUNCEMENTS);
            expect(perms).toContain(Permissions.MANAGE_CALENDAR);
            expect(perms).toContain(Permissions.MANAGE_MESSAGES);
            expect(perms).toContain(Permissions.MANAGE_CONTENT);
            expect(perms).toContain(Permissions.VIEW_DONATIONS);
            expect(perms).toContain(Permissions.VIEW_METRICS);
        });

        it('does NOT have live-stream capabilities (manage streaming / moderate chat)', () => {
            const perms = getRolePermissions(Roles.MEMBERSHIP_DIRECTOR);
            expect(perms).not.toContain(Permissions.MANAGE_STREAMING);
            expect(perms).not.toContain(Permissions.MODERATE_CHAT);
        });
    });

    describe('Role to Permission Mapping Completeness', () => {
        it('should have role mapping for all roles', () => {
            const roles = [Roles.ADMIN, Roles.RABBI, Roles.SOCIAL_CHAIR, Roles.MEMBER];
            roles.forEach(role => {
                const perms = getRolePermissions(role);
                expect(Array.isArray(perms)).toBe(true);
            });
        });

        it('should not contain duplicate permissions within a role', () => {
            const allRoles = [Roles.ADMIN, Roles.RABBI, Roles.SOCIAL_CHAIR, Roles.MEMBER];
            allRoles.forEach(role => {
                const perms = getRolePermissions(role);
                const uniquePerms = new Set(perms);
                expect(perms.length).toBe(uniquePerms.size);
            });
        });
    });
});
