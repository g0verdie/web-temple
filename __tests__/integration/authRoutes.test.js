const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

// Mock pg at the module level like other integration tests
jest.mock('pg', () => {
    const mPool = {
        query: jest.fn(),
        connect: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
    };
    return { Pool: jest.fn(() => mPool) };
});

jest.mock('../../src/services/emailQueueService', () => ({
    enqueueEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn().mockResolvedValue(true),
    AUDIT_ACTIONS: {
        USER_REGISTERED: 'USER_REGISTERED',
        USER_LOGIN: 'USER_LOGIN',
        PASSWORD_CHANGED: 'PASSWORD_CHANGED',
        PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED'
    }
}));

jest.mock('../../src/services/authService');

jest.mock('../../src/services/emailTemplateService', () => ({
    renderTemplate: jest.fn(() => ({
        subject: 'Welcome',
        html: '<p>Welcome</p>',
        text: 'Welcome'
    }))
}));

const { enqueueEmail } = require('../../src/services/emailQueueService');
const { registerUser, authenticateUser, requestPasswordReset } = require('../../src/services/authService');

const app = require('../../src/server');

describe('Authentication API Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/auth/register', () => {
        it('should successfully register a new user with all fields', async () => {
            const newUser = {
                email: 'test-registration-full@example.com',
                password: 'SecurePass123!@#',
                first_name: 'Test',
                last_name: 'User'
            };

            registerUser.mockResolvedValue({
                id: 1,
                email: newUser.email,
                first_name: newUser.first_name,
                last_name: newUser.last_name,
                role: 'member'
            });

            const response = await request(app)
                .post('/api/auth/register')
                .send(newUser)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Registration successful');
            expect(response.body.user).toHaveProperty('id');
            expect(response.body.user.email).toBe(newUser.email);
            expect(response.body.user.first_name).toBe(newUser.first_name);
            expect(response.body.user.role).toBe('member');

            const cookies = response.headers['set-cookie'];
            expect(cookies).toBeDefined();
            expect(cookies.some(cookie => cookie.startsWith('auth_token='))).toBe(true);

            expect(enqueueEmail).toHaveBeenCalledTimes(1);
        });

        it('should reject registration with missing email', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({ password: 'SecurePass123!@#' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Email and password are required');
            expect(registerUser).not.toHaveBeenCalled();
        });

        it('should reject duplicate email registration', async () => {
            registerUser.mockRejectedValue(new Error('Email already registered'));

            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'SecurePass123!@#'
                })
                .expect(409);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/auth/login', () => {
        it('should successfully login with valid credentials', async () => {
            const mockUser = {
                id: 1,
                email: 'test@example.com',
                role: 'member',
                first_name: 'Test',
                last_name: 'User'
            };

            authenticateUser.mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'CorrectPass123!@#'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Login successful');
            expect(response.body.user).toEqual(mockUser);

            const cookies = response.headers['set-cookie'];
            expect(cookies).toBeDefined();
            expect(cookies.some(cookie => cookie.startsWith('auth_token='))).toBe(true);
        });

        it('should return 401 with invalid password', async () => {
            authenticateUser.mockRejectedValue(new Error('Invalid email or password'));

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'WrongPassword123!@#'
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid email or password');
        });

        it('should return 403 when account is locked', async () => {
            authenticateUser.mockRejectedValue(
                new Error('Account is temporarily locked. Please try again in 10 minutes (until 3:45 PM).')
            );

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'CorrectPass123!@#'
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Account is temporarily locked');
            expect(response.body.message).toContain('10 minutes');
        });

        it('should handle missing credentials', async () => {
            authenticateUser.mockRejectedValue(new Error('Email and password are required'));

            const response = await request(app)
                .post('/api/auth/login')
                .send({})
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should successfully logout', async () => {
            const response = await request(app)
                .post('/api/auth/logout')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Logout successful');
        });
    });

    describe('POST /api/auth/password-reset-request', () => {
        it('should handle password reset request', async () => {
            requestPasswordReset.mockResolvedValue({
                message: 'If an account exists with this email, a reset link will be sent'
            });

            const response = await request(app)
                .post('/api/auth/password-reset-request')
                .send({ email: 'test@example.com' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('If an account exists');
        });

        it('should reject missing email', async () => {
            const response = await request(app)
                .post('/api/auth/password-reset-request')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Email is required');
        });
    });
});
