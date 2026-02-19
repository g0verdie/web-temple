const request = require('supertest');
const { login, logout } = require('../../src/controllers/authController');
const authService = require('../../src/services/authService');
const sessionService = require('../../src/services/sessionService');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../../src/services/authService');
jest.mock('../../src/services/sessionService');
jest.mock('jsonwebtoken');

// Mock Express objects
const mockRequest = (body = {}) => ({
    body,
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
    cookies: {},
    user: null
});

const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
};

describe('authController.login', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
        sessionService.createSession.mockResolvedValue();
        sessionService.invalidateSession.mockResolvedValue();
    });

    it('should return 200, create session, and set cookie on successful login', async () => {
        const req = mockRequest({ email: 'test@example.com', password: 'password' });
        const res = mockResponse();

        const mockUser = { id: 1, email: 'test@example.com', role: 'member' };
        authService.authenticateUser.mockResolvedValue(mockUser);
        jwt.sign.mockReturnValue('mock-token');

        await login(req, res);

        expect(authService.authenticateUser).toHaveBeenCalledWith(expect.objectContaining({
            email: 'test@example.com',
            password: 'password'
        }));
        expect(sessionService.createSession).toHaveBeenCalledWith(mockUser);
        expect(res.cookie).toHaveBeenCalledWith('auth_token', 'mock-token', expect.any(Object));
        expect(res.status).not.toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            user: expect.objectContaining({ email: 'test@example.com' })
        }));
    });

    it('should return 401 on invalid credentials', async () => {
        const req = mockRequest({ email: 'test@example.com', password: 'wrong' });
        const res = mockResponse();

        authService.authenticateUser.mockRejectedValue(new Error('Invalid email or password'));

        await login(req, res);

        expect(sessionService.createSession).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Invalid email or password'
        }));
    });

    it('should return 403 when account is locked', async () => {
        const req = mockRequest({ email: 'locked@example.com', password: 'password' });
        const res = mockResponse();

        authService.authenticateUser.mockRejectedValue(new Error('Account is temporarily locked. Please try again later.'));

        await login(req, res);

        expect(sessionService.createSession).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('Account is temporarily locked')
        }));
    });

    describe('TC-2-5-7: Secure Cookie Configuration (Story 2-5)', () => {
        it('should set HTTP-only cookie on successful login', async () => {
            const req = mockRequest({ email: 'test@example.com', password: 'password' });
            const res = mockResponse();

            const mockUser = { id: 1, email: 'test@example.com', role: 'member', token_version: 1 };
            authService.authenticateUser.mockResolvedValue(mockUser);
            jwt.sign.mockReturnValue('mock-token');

            await login(req, res);

            const cookieCall = res.cookie.mock.calls[0];
            const cookieOptions = cookieCall[2];

            expect(cookieOptions.httpOnly).toBe(true);
        });

        it('should set SameSite=Strict on cookie for CSRF protection', async () => {
            const req = mockRequest({ email: 'test@example.com', password: 'password' });
            const res = mockResponse();

            const mockUser = { id: 1, email: 'test@example.com', role: 'member', token_version: 1 };
            authService.authenticateUser.mockResolvedValue(mockUser);
            jwt.sign.mockReturnValue('mock-token');

            await login(req, res);

            const cookieCall = res.cookie.mock.calls[0];
            const cookieOptions = cookieCall[2];

            expect(cookieOptions.sameSite).toBe('strict');
        });

        it('should set Secure flag in production environment', async () => {
            process.env.NODE_ENV = 'production';
            const req = mockRequest({ email: 'test@example.com', password: 'password' });
            const res = mockResponse();

            const mockUser = { id: 1, email: 'test@example.com', role: 'member', token_version: 1 };
            authService.authenticateUser.mockResolvedValue(mockUser);
            jwt.sign.mockReturnValue('mock-token');

            await login(req, res);

            const cookieCall = res.cookie.mock.calls[0];
            const cookieOptions = cookieCall[2];

            expect(cookieOptions.secure).toBe(true);
        });

        it('should NOT set Secure flag in test/dev environment', async () => {
            process.env.NODE_ENV = 'test';
            const req = mockRequest({ email: 'test@example.com', password: 'password' });
            const res = mockResponse();

            const mockUser = { id: 1, email: 'test@example.com', role: 'member', token_version: 1 };
            authService.authenticateUser.mockResolvedValue(mockUser);
            jwt.sign.mockReturnValue('mock-token');

            await login(req, res);

            const cookieCall = res.cookie.mock.calls[0];
            const cookieOptions = cookieCall[2];

            expect(cookieOptions.secure).toBe(false);
        });

        it('should set maxAge to 30 days for session timeout', async () => {
            const req = mockRequest({ email: 'test@example.com', password: 'password' });
            const res = mockResponse();

            const mockUser = { id: 1, email: 'test@example.com', role: 'member', token_version: 1 };
            authService.authenticateUser.mockResolvedValue(mockUser);
            jwt.sign.mockReturnValue('mock-token');

            await login(req, res);

            const cookieCall = res.cookie.mock.calls[0];
            const cookieOptions = cookieCall[2];

            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            expect(cookieOptions.maxAge).toBe(thirtyDaysMs);
        });

        it('should clear auth cookie and invalidate session on logout', async () => {
            const req = mockRequest();
            req.user = { id: 1, role: 'member' }; // Simulate authenticated user
            const res = mockResponse();

            await logout(req, res);

            expect(sessionService.invalidateSession).toHaveBeenCalledWith(req.user, { jti: null, exp: null });
            expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: 'Logout successful'
            }));
        });
    });
});