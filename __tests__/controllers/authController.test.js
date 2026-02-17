const request = require('supertest');
const { login } = require('../../src/controllers/authController');
const authService = require('../../src/services/authService');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../../src/services/authService');
jest.mock('jsonwebtoken');

// Mock Express objects
const mockRequest = (body = {}) => ({
    body,
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' }
});

const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    return res;
};

describe('authController.login', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
    });

    it('should return 200 and set cookie on successful login', async () => {
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

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('Account is temporarily locked')
        }));
    });
});
