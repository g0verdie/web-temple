const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../../src/services/authService');
const { logAudit, AUDIT_ACTIONS } = require('../../src/services/auditService');
const db = require('../../src/config/db');
const { comparePassword } = require('../../src/utils/authHelper');
const { Roles } = require('../../src/config/roles-permissions');

jest.mock('../../src/config/db');
jest.mock('../../src/utils/authHelper');
jest.mock('../../src/services/auditService');

describe('RBAC Integration - Auth Login with Role Loading', () => {
    const JWT_SECRET = 'test-jwt-secret';

    beforeEach(() => {
        jest.clearAllMocks();
        logAudit.mockResolvedValue(true);
        process.env.JWT_SECRET = JWT_SECRET;
    });

    it('should load user role from database on login', async () => {
        const mockUser = {
            id: 'user-123',
            email: 'rabbi@example.com',
            password_hash: 'hashed-password',
            role: Roles.RABBI,
            first_name: 'Rabbi',
            last_name: 'Cohen',
            token_version: 1,
            failed_login_attempts: 0,
            lockout_until: null
        };

        db.query.mockResolvedValueOnce({ rows: [mockUser] });
        comparePassword.mockResolvedValueOnce(true);
        db.query.mockResolvedValueOnce({ rows: [] }); // Reset failed attempts

        const user = await authenticateUser({
            email: 'rabbi@example.com',
            password: 'correct-password',
            ip_address: '127.0.0.1'
        });

        expect(user.role).toBe(Roles.RABBI);
        expect(user.email).toBe('rabbi@example.com');
    });

    it('should load ADMIN role from database on login', async () => {
        const mockUser = {
            id: 'admin-456',
            email: 'admin@example.com',
            password_hash: 'hashed-password',
            role: Roles.ADMIN,
            first_name: 'Admin',
            last_name: 'User',
            token_version: 1,
            failed_login_attempts: 0,
            lockout_until: null
        };

        db.query.mockResolvedValueOnce({ rows: [mockUser] });
        comparePassword.mockResolvedValueOnce(true);
        db.query.mockResolvedValueOnce({ rows: [] });

        const user = await authenticateUser({
            email: 'admin@example.com',
            password: 'correct-password',
            ip_address: '127.0.0.1'
        });

        expect(user.role).toBe(Roles.ADMIN);
    });

    it('JWT token should include role after successful login', async () => {
        const mockUser = {
            id: 'user-789',
            email: 'rabbi@example.com',
            password_hash: 'hashed-password',
            role: Roles.RABBI,
            first_name: 'Rabbi',
            last_name: 'Cohen',
            token_version: 1,
            failed_login_attempts: 0,
            lockout_until: null
        };

        db.query.mockResolvedValueOnce({ rows: [mockUser] });
        comparePassword.mockResolvedValueOnce(true);
        db.query.mockResolvedValueOnce({ rows: [] });

        const user = await authenticateUser({
            email: 'rabbi@example.com',
            password: 'correct-password',
            ip_address: '127.0.0.1'
        });

        // Simulate JWT token creation as done in authController
        const token = jwt.sign(
            {
                user_id: user.id,
                email: user.email,
                role: user.role,
                token_version: user.token_version
            },
            JWT_SECRET
        );

        // Decode token and verify role is present
        const decoded = jwt.verify(token, JWT_SECRET);
        expect(decoded.role).toBe(Roles.RABBI);
        expect(decoded.email).toBe('rabbi@example.com');
        expect(decoded.user_id).toBe('user-789');
    });

    it('should log admin login to audit log', async () => {
        const mockAdmin = {
            id: 'admin-999',
            email: 'admin@example.com',
            password_hash: 'hashed-password',
            role: Roles.ADMIN,
            first_name: 'Admin',
            last_name: 'User',
            token_version: 1,
            failed_login_attempts: 0,
            lockout_until: null
        };

        db.query.mockResolvedValueOnce({ rows: [mockAdmin] });
        comparePassword.mockResolvedValueOnce(true);
        db.query.mockResolvedValueOnce({ rows: [] });

        await authenticateUser({
            email: 'admin@example.com',
            password: 'correct-password',
            ip_address: '192.168.1.1'
        });

        // Verify audit log was called
        expect(logAudit).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 'admin-999',
                action: AUDIT_ACTIONS.USER_LOGIN,
                description: expect.stringContaining('logged in')
            })
        );
    });

    it('should log rabbi login to audit log', async () => {
        const mockRabbi = {
            id: 'rabbi-888',
            email: 'rabbi@example.com',
            password_hash: 'hashed-password',
            role: Roles.RABBI,
            first_name: 'Rabbi',
            last_name: 'Cohen',
            token_version: 1,
            failed_login_attempts: 0,
            lockout_until: null
        };

        db.query.mockResolvedValueOnce({ rows: [mockRabbi] });
        comparePassword.mockResolvedValueOnce(true);
        db.query.mockResolvedValueOnce({ rows: [] });

        await authenticateUser({
            email: 'rabbi@example.com',
            password: 'correct-password',
            ip_address: '192.168.1.2'
        });

        expect(logAudit).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 'rabbi-888',
                action: AUDIT_ACTIONS.USER_LOGIN,
                ip_address: '192.168.1.2'
            })
        );
    });

    it('should preserve role from login through session', async () => {
        const mockUser = {
            id: 'user-555',
            email: 'rabbi@example.com',
            password_hash: 'hashed-password',
            role: Roles.RABBI,
            first_name: 'Rabbi',
            last_name: 'Cohen',
            token_version: 1,
            failed_login_attempts: 0,
            lockout_until: null
        };

        db.query.mockResolvedValueOnce({ rows: [mockUser] });
        comparePassword.mockResolvedValueOnce(true);
        db.query.mockResolvedValueOnce({ rows: [] });

        const authenticated = await authenticateUser({
            email: 'rabbi@example.com',
            password: 'correct-password',
            ip_address: '127.0.0.1'
        });

        // Create JWT as controller would
        const token = jwt.sign(
            {
                user_id: authenticated.id,
                email: authenticated.email,
                role: authenticated.role,
                token_version: authenticated.token_version
            },
            JWT_SECRET
        );

        // Simulate middleware extracting role from JWT
        const decoded = jwt.verify(token, JWT_SECRET);

        // Verify role persisted through the entire flow
        expect(decoded.role).toBe(Roles.RABBI);
        expect(authenticated.role).toBe(Roles.RABBI);
    });

    it('should preserve SOCIAL_CHAIR role (Phase 2)', async () => {
        const mockUser = {
            id: 'user-chair',
            email: 'chairperson@example.com',
            password_hash: 'hashed-password',
            role: Roles.SOCIAL_CHAIR,
            first_name: 'Social',
            last_name: 'Chair',
            token_version: 1,
            failed_login_attempts: 0,
            lockout_until: null
        };

        db.query.mockResolvedValueOnce({ rows: [mockUser] });
        comparePassword.mockResolvedValueOnce(true);
        db.query.mockResolvedValueOnce({ rows: [] });

        const user = await authenticateUser({
            email: 'chairperson@example.com',
            password: 'correct-password',
            ip_address: '127.0.0.1'
        });

        expect(user.role).toBe(Roles.SOCIAL_CHAIR);
    });

    it('regular members should also have role preserved', async () => {
        const mockMember = {
            id: 'member-001',
            email: 'member@example.com',
            password_hash: 'hashed-password',
            role: Roles.MEMBER,
            first_name: 'Regular',
            last_name: 'Member',
            token_version: 1,
            failed_login_attempts: 0,
            lockout_until: null
        };

        db.query.mockResolvedValueOnce({ rows: [mockMember] });
        comparePassword.mockResolvedValueOnce(true);
        db.query.mockResolvedValueOnce({ rows: [] });

        const user = await authenticateUser({
            email: 'member@example.com',
            password: 'correct-password',
            ip_address: '127.0.0.1'
        });

        expect(user.role).toBe(Roles.MEMBER);
    });
});
