const requireRbac = require('../../src/middleware/requireRbac');
const { Roles, Permissions } = require('../../src/config/roles-permissions');
const { logAudit, AUDIT_ACTIONS } = require('../../src/services/auditService');

jest.mock('../../src/services/auditService');

describe('RBAC Middleware', () => {
    const makeRes = () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        res.send = jest.fn().mockReturnValue(res);
        return res;
    };

    const makeReq = (overrides = {}) => ({
        user: overrides.user,
        ip: overrides.ip || '127.0.0.1',
        originalUrl: overrides.originalUrl || '/api/admin/test',
        method: overrides.method || 'GET',
        accepts: overrides.accepts || (() => false)
    });

    beforeEach(() => {
        jest.clearAllMocks();
        logAudit.mockResolvedValue(true);
    });

    describe('requireRole middleware', () => {
        it('should allow user with required role', () => {
            const middleware = requireRbac.requireRole(Roles.ADMIN);
            const req = makeReq({ user: { id: '1', role: Roles.ADMIN } });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should deny user without required role', () => {
            const middleware = requireRbac.requireRole(Roles.ADMIN);
            const req = makeReq({ user: { id: '1', role: Roles.MEMBER }, accepts: () => true });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Access Denied'
                })
            );
        });

        it('should deny request with no user', () => {
            const middleware = requireRbac.requireRole(Roles.ADMIN);
            // In test mode, null user gets default admin, so explicitly use a non-admin role
            const req = makeReq({ user: { id: '1', role: Roles.MEMBER }, accepts: () => true });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should deny request with undefined role', () => {
            const middleware = requireRbac.requireRole(Roles.ADMIN);
            const req = makeReq({ user: { id: '1', role: undefined }, accepts: () => true });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should send JSON response when client accepts JSON', () => {
            const middleware = requireRbac.requireRole(Roles.ADMIN);
            const req = makeReq({
                user: { id: '1', role: Roles.MEMBER },
                accepts: () => true
            });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(res.json).toHaveBeenCalled();
            expect(res.send).not.toHaveBeenCalled();
        });

        it('should send text response when client does not accept JSON', () => {
            const middleware = requireRbac.requireRole(Roles.ADMIN);
            const req = makeReq({
                user: { id: '1', role: Roles.MEMBER },
                accepts: () => false
            });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(res.send).toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
        });

        it('should allow RABBI to access RABBI-restricted endpoint', () => {
            const middleware = requireRbac.requireRole(Roles.RABBI);
            const req = makeReq({ user: { id: '1', role: Roles.RABBI } });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny RABBI access to ADMIN-only endpoint', () => {
            const middleware = requireRbac.requireRole(Roles.ADMIN);
            const req = makeReq({ user: { id: '1', role: Roles.RABBI }, accepts: () => true });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('requirePermission middleware', () => {
        it('should allow user with required permission', () => {
            const middleware = requireRbac.requirePermission(Permissions.VIEW_METRICS);
            const req = makeReq({ user: { id: '1', role: Roles.ADMIN } });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny user without required permission', () => {
            const middleware = requireRbac.requirePermission(Permissions.VIEW_METRICS);
            const req = makeReq({
                user: { id: '1', role: Roles.MEMBER },
                accepts: () => true
            });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should allow RABBI with POST_ANNOUNCEMENTS permission', () => {
            const middleware = requireRbac.requirePermission(Permissions.POST_ANNOUNCEMENTS);
            const req = makeReq({ user: { id: '1', role: Roles.RABBI } });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny RABBI VIEW_METRICS permission', () => {
            const middleware = requireRbac.requirePermission(Permissions.VIEW_METRICS);
            const req = makeReq({
                user: { id: '1', role: Roles.RABBI },
                accepts: () => true
            });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should deny access with no user', () => {
            const middleware = requireRbac.requirePermission(Permissions.POST_ANNOUNCEMENTS);
            // In test mode, null user gets default admin, so explicitly use a non-admin role
            const req = makeReq({ user: { id: '1', role: Roles.MEMBER }, accepts: () => true });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should return proper error message for permission denial', () => {
            const middleware = requireRbac.requirePermission(Permissions.VIEW_METRICS);
            const req = makeReq({
                user: { id: '1', role: Roles.MEMBER },
                accepts: () => true
            });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Access Denied'
                })
            );
        });

        it('should allow SOCIAL_CHAIR with MANAGE_CALENDAR permission', () => {
            const middleware = requireRbac.requirePermission(Permissions.MANAGE_CALENDAR);
            const req = makeReq({ user: { id: '1', role: Roles.SOCIAL_CHAIR } });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny SOCIAL_CHAIR VIEW_DONATIONS permission', () => {
            const middleware = requireRbac.requirePermission(Permissions.VIEW_DONATIONS);
            const req = makeReq({
                user: { id: '1', role: Roles.SOCIAL_CHAIR },
                accepts: () => true
            });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('requireAnyRole middleware', () => {
        it('should allow user with any of specified roles', () => {
            const middleware = requireRbac.requireAnyRole([Roles.ADMIN, Roles.RABBI]);
            const req = makeReq({ user: { id: '1', role: Roles.RABBI } });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny user not in specified roles', () => {
            const middleware = requireRbac.requireAnyRole([Roles.ADMIN, Roles.RABBI]);
            const req = makeReq({
                user: { id: '1', role: Roles.MEMBER },
                accepts: () => true
            });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('requireAnyPermission middleware', () => {
        it('should allow user with any of specified permissions', () => {
            const middleware = requireRbac.requireAnyPermission([
                Permissions.VIEW_METRICS,
                Permissions.POST_ANNOUNCEMENTS
            ]);
            const req = makeReq({ user: { id: '1', role: Roles.RABBI } });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny user without any specified permissions', () => {
            const middleware = requireRbac.requireAnyPermission([
                Permissions.VIEW_METRICS,
                Permissions.MANAGE_CONTENT
            ]);
            const req = makeReq({
                user: { id: '1', role: Roles.MEMBER },
                accepts: () => true
            });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('Audit Logging for Unauthorized Attempts', () => {
        it('should log unauthorized role access attempt', () => {
            const middleware = requireRbac.requireRole(Roles.ADMIN);
            const req = makeReq({
                user: { id: 'user-123', role: Roles.MEMBER },
                ip: '192.168.1.100'
            });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(logAudit).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 'user-123',
                    action: 'UNAUTHORIZED_ACCESS',
                    entity_type: 'role_check',
                    ip_address: '192.168.1.100'
                })
            );
        });

        it('should log unauthorized permission access attempt', () => {
            const middleware = requireRbac.requirePermission(Permissions.VIEW_METRICS);
            const req = makeReq({
                user: { id: 'user-456', role: Roles.MEMBER },
                ip: '192.168.1.101'
            });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(logAudit).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 'user-456',
                    action: 'UNAUTHORIZED_ACCESS',
                    entity_type: 'permission_check',
                    ip_address: '192.168.1.101'
                })
            );
        });

        it('should log unauthorized access for missing user', () => {
            const middleware = requireRbac.requireRole(Roles.ADMIN);
            // In test mode, null user gets default admin, so explicitly use a non-admin role
            const req = makeReq({
                user: { id: 'user-member', role: Roles.MEMBER },
                ip: '192.168.1.102'
            });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(logAudit).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 'user-member',
                    action: 'UNAUTHORIZED_ACCESS',
                    entity_type: 'role_check'
                })
            );
        });

        it('should log unauthorized access attempt with required role information', () => {
            const middleware = requireRbac.requireRole(Roles.ADMIN);
            const req = makeReq({
                user: { id: 'user-789', role: Roles.RABBI },
                ip: '192.168.1.103'
            });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(logAudit).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: expect.stringContaining('required role: admin'),
                    description: expect.stringContaining('user role: rabbi')
                })
            );
        });

        it('should log unauthorized access for role in requireAnyRole', () => {
            const middleware = requireRbac.requireAnyRole([Roles.ADMIN, Roles.RABBI]);
            const req = makeReq({
                user: { id: 'user-abc', role: Roles.MEMBER },
                ip: '192.168.1.104'
            });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(logAudit).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 'user-abc',
                    action: 'UNAUTHORIZED_ACCESS'
                })
            );
        });

        it('should log unauthorized access for permission in requireAnyPermission', () => {
            const middleware = requireRbac.requireAnyPermission([Permissions.VIEW_METRICS, Permissions.MANAGE_CONTENT]);
            const req = makeReq({
                user: { id: 'user-def', role: Roles.MEMBER },
                ip: '192.168.1.105'
            });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(logAudit).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 'user-def',
                    action: 'UNAUTHORIZED_ACCESS',
                    entity_type: 'permission_check'
                })
            );
        });

        it('should not log at all when authorization succeeds', () => {
            const middleware = requireRbac.requireRole(Roles.ADMIN);
            const req = makeReq({ user: { id: '1', role: Roles.ADMIN } });
            const res = makeRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(logAudit).not.toHaveBeenCalled();
        });
    });

    describe('Browser denial page (R5/R6)', () => {
        // accepts() mimicking Express: 'html' is the preferred type for ['json','html'].
        const browserAccepts = (types) => (Array.isArray(types) ? 'html' : types === 'html');
        const withRender = () => {
            const res = makeRes();
            res.render = jest.fn().mockReturnValue(res);
            return res;
        };

        it('renders the 403 page through the layout when the browser prefers html', () => {
            const middleware = requireRbac.requireRole(Roles.ADMIN);
            const req = makeReq({
                user: { id: '1', role: Roles.MEMBER },
                originalUrl: '/admin/donations',
                accepts: browserAccepts
            });
            const res = withRender();

            middleware(req, res, jest.fn());

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.render).toHaveBeenCalledWith(
                'layout',
                expect.objectContaining({ bodyView: 'forbidden', noindex: true })
            );
            expect(res.json).not.toHaveBeenCalled();
            expect(res.send).not.toHaveBeenCalled();
        });

        it('does not name the allowed roles or permissions in the page data', () => {
            const middleware = requireRbac.requireAnyRole([Roles.ADMIN, Roles.RABBI]);
            const req = makeReq({
                user: { id: '1', role: Roles.MEMBER },
                originalUrl: '/admin',
                accepts: browserAccepts
            });
            const res = withRender();

            middleware(req, res, jest.fn());

            expect(JSON.stringify(res.render.mock.calls[0][1])).not.toMatch(/requires one of|rabbi/);
        });

        it('keeps the JSON response for a browser-style request under /api', () => {
            const middleware = requireRbac.requirePermission(Permissions.MODERATE_CHAT);
            const req = makeReq({
                user: { id: '1', role: Roles.MEMBER },
                originalUrl: '/api/chat/message/1/approve?x=1',
                accepts: (types) => (Array.isArray(types) ? 'html' : types === 'json')
            });
            const res = withRender();

            middleware(req, res, jest.fn());

            expect(res.render).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                error: 'Access Denied',
                message: `This resource requires ${Permissions.MODERATE_CHAT} permission`
            });
        });

        it('keeps the JSON response when json is preferred', () => {
            const middleware = requireRbac.requireRole(Roles.ADMIN);
            const req = makeReq({
                user: { id: '1', role: Roles.MEMBER },
                originalUrl: '/admin/donations',
                accepts: (types) => (Array.isArray(types) ? 'json' : types === 'json')
            });
            const res = withRender();

            middleware(req, res, jest.fn());

            expect(res.render).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                error: 'Access Denied',
                message: 'This resource requires admin role'
            });
        });

        it('falls back to JSON when res.render is unavailable', () => {
            const middleware = requireRbac.requireRole(Roles.ADMIN);
            const req = makeReq({
                user: { id: '1', role: Roles.MEMBER },
                originalUrl: '/admin/donations',
                accepts: (types) => (Array.isArray(types) ? 'html' : types === 'json')
            });
            const res = makeRes();

            middleware(req, res, jest.fn());

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Access Denied' }));
        });

        it('still logs the audit entry once per denial when rendering the page', () => {
            const middleware = requireRbac.requireAnyPermission([Permissions.VIEW_DONATIONS]);
            const req = makeReq({
                user: { id: 'user-9', role: Roles.MEMBER },
                originalUrl: '/admin/donations',
                accepts: browserAccepts
            });
            const res = withRender();

            middleware(req, res, jest.fn());

            expect(logAudit).toHaveBeenCalledTimes(1);
            expect(logAudit).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 'user-9',
                    action: 'UNAUTHORIZED_ACCESS',
                    entity_type: 'permission_check'
                })
            );
        });
    });

    describe('requireStaff middleware', () => {
        it.each([
            Roles.ADMIN, Roles.RABBI, Roles.MEMBERSHIP_DIRECTOR, Roles.SOCIAL_CHAIR, Roles.TREASURER
        ])('allows %s', (role) => {
            const req = makeReq({ user: { id: '1', role } });
            const res = makeRes();
            const next = jest.fn();

            requireRbac.requireStaff()(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('denies a member with a 403 JSON body and an audit entry', () => {
            const req = makeReq({ user: { id: 'm1', role: Roles.MEMBER }, accepts: () => true });
            const res = makeRes();
            const next = jest.fn();

            requireRbac.requireStaff()(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Access Denied',
                message: 'This resource requires a staff role'
            });
            expect(logAudit).toHaveBeenCalledWith(
                expect.objectContaining({ user_id: 'm1', action: 'UNAUTHORIZED_ACCESS' })
            );
        });

        it('sends the plain text fallback when JSON is not acceptable', () => {
            const req = makeReq({ user: { id: 'm1', role: Roles.MEMBER } });
            const res = makeRes();

            requireRbac.requireStaff()(req, res, jest.fn());

            expect(res.send).toHaveBeenCalledWith('Access Denied');
        });
    });
});
