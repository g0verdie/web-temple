const { enqueueEmail } = require('../../src/services/emailQueueService');

jest.mock('../../src/services/emailQueueService');
jest.mock('../../src/services/auditService'); // Mock audit service too

describe('Authentication API - Registration', () => {

    beforeAll(async () => {
        // Clean up test users before running tests
        await db.query("DELETE FROM users WHERE email LIKE '%test-registration%'");
    });

    afterAll(async () => {
        // Clean up test users after running tests
        await db.query("DELETE FROM users WHERE email LIKE '%test-registration%'");
        await db.end();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/auth/register', () => {

        it('should successfully register a new user with all fields and send welcome email', async () => {
            const newUser = {
                email: 'test-registration-full@example.com',
                password: 'SecurePass123!@#',
                first_name: 'Test',
                last_name: 'User'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(newUser)
                .expect('Content-Type', /json/)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Registration successful');
            expect(response.body.user).toHaveProperty('id');
            expect(response.body.user.email).toBe(newUser.email);
            expect(response.body.user.first_name).toBe(newUser.first_name);
            expect(response.body.user.last_name).toBe(newUser.last_name);
            expect(response.body.user.role).toBe('member');
            expect(response.body.user).not.toHaveProperty('password_hash');

            // Verify auth token cookie is set
            const cookies = response.headers['set-cookie'];
            expect(cookies).toBeDefined();
            expect(cookies.some(cookie => cookie.startsWith('auth_token='))).toBe(true);

            // Verify welcome email was enqueued
            expect(enqueueEmail).toHaveBeenCalledTimes(1);
            expect(enqueueEmail).toHaveBeenCalledWith(expect.objectContaining({
                to: newUser.email,
                subject: expect.stringContaining('Welcome'),
                priority: 2
            }));
        });

        it('should successfully register a user with only required fields', async () => {
            const newUser = {
                email: 'test-registration-minimal@example.com',
                password: 'SecurePass123!@#'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(newUser)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.user.email).toBe(newUser.email);
            expect(response.body.user.first_name).toBeNull();
            expect(response.body.user.last_name).toBeNull();
        });

        it('should reject registration with missing email', async () => {
            const newUser = {
                password: 'SecurePass123!@#'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(newUser)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Email and password are required');
        });

        it('should reject registration with missing password', async () => {
            const newUser = {
                email: 'test-registration-nopass@example.com'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(newUser)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Email and password are required');
        });

        it('should reject weak password (less than 12 characters)', async () => {
            const newUser = {
                email: 'test-registration-weak@example.com',
                password: 'Short1!'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(newUser)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Password must be at least 12 characters');
        });

        it('should reject password without complexity requirements', async () => {
            const newUser = {
                email: 'test-registration-simple@example.com',
                password: 'simplelowercase123'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(newUser)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Password must be at least 12 characters');
        });

        it('should reject duplicate email registration', async () => {
            const newUser = {
                email: 'test-registration-duplicate@example.com',
                password: 'SecurePass123!@#'
            };

            // First registration
            await request(app)
                .post('/api/auth/register')
                .send(newUser)
                .expect(201);

            // Attempt duplicate registration
            const response = await request(app)
                .post('/api/auth/register')
                .send(newUser)
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Email already registered');
        });

        it('should set secure HTTP-only cookie with auth token', async () => {
            const newUser = {
                email: 'test-registration-cookie@example.com',
                password: 'SecurePass123!@#'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(newUser)
                .expect(201);

            const cookies = response.headers['set-cookie'];
            const authCookie = cookies.find(cookie => cookie.startsWith('auth_token='));

            expect(authCookie).toBeDefined();
            expect(authCookie).toContain('HttpOnly');
            expect(authCookie).toContain('SameSite=Strict');
        });

        it('should auto-login user after successful registration', async () => {
            const newUser = {
                email: 'test-registration-autologin@example.com',
                password: 'SecurePass123!@#'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(newUser)
                .expect(201);

            // Extract cookie and make an authenticated request
            const cookies = response.headers['set-cookie'];
            const authCookie = cookies.find(cookie => cookie.startsWith('auth_token='));

            expect(authCookie).toBeDefined();
        });
    });
});
