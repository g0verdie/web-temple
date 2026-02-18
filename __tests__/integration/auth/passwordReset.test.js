const request = require('supertest');
const app = require('../../../src/server');
const db = require('../../../src/config/db');
const { queue, enqueueEmail } = require('../../../src/services/emailQueueService');
const { hashPassword } = require('../../../src/utils/authHelper');

// Mock email queue
jest.mock('../../../src/services/emailQueueService', () => ({
    queue: {
        add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    },
    enqueueEmail: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
}));

describe('Password Reset Flow', () => {
    let user;
    let token;

    beforeAll(async () => {
        const passwordHash = await hashPassword('CurrentPassword123!');

        // Create a test user
        const res = await db.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, email`,
            ['reset_test@example.com', passwordHash, 'Reset', 'User', 'member']
        );
        user = res.rows[0];
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await db.query('DELETE FROM password_history WHERE user_id = $1', [user.id]);
        await db.query('DELETE FROM password_resets WHERE user_id = $1', [user.id]);
        await db.query('DELETE FROM users WHERE email = $1', ['reset_test@example.com']);
        await db.pool.end();
    });

    describe('POST /api/auth/password-reset-request', () => {
        it('should send a reset email for registered user', async () => {
            const res = await request(app)
                .post('/api/auth/password-reset-request')
                .send({ email: 'reset_test@example.com' });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify token was created in DB
            const tokenRes = await db.query('SELECT * FROM password_resets WHERE user_id = $1', [user.id]);
            expect(tokenRes.rows.length).toBeGreaterThan(0);
            token = tokenRes.rows[0].token;
        });

        it('should return success even for non-existent email', async () => {
            const res = await request(app)
                .post('/api/auth/password-reset-request')
                .send({ email: 'nonexistent@example.com' });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('POST /api/auth/reset-password', () => {
        it('should reset password with valid token', async () => {
            const newPassword = 'NewPassword123!';
            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: token,
                    new_password: newPassword
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify can login with new password (mocking auth check effectively)
            // In a real integration test we might call login endpoint
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'reset_test@example.com',
                    password: newPassword
                });

            expect(loginRes.statusCode).toBe(200);
            expect(loginRes.body.success).toBe(true);
        });

        it('should reject expired token', async () => {
            const expiredToken = 'expired-token';
            const expiredAt = new Date(Date.now() - 60 * 60 * 1000);

            await db.query(
                'INSERT INTO password_resets (user_id, token, expires_at, used) VALUES ($1, $2, $3, $4)',
                [user.id, expiredToken, expiredAt, false]
            );

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: expiredToken,
                    new_password: 'NewPassword123!'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/expired/i);
        });

        it('should fail with invalid token', async () => {
            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: 'invalid-token',
                    new_password: 'NewPassword123!'
                });

            expect(res.statusCode).toBe(400); // or 401/404 depending on implementation
            expect(res.body.success).toBe(false);
        });

        it('should fail if password is in history', async () => {
            // Trying to reset to the same password we just set
            // First we need a new token
            await request(app)
                .post('/api/auth/password-reset-request')
                .send({ email: 'reset_test@example.com' });

            const tokenRes = await db.query('SELECT * FROM password_resets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [user.id]);
            const newToken = tokenRes.rows[0].token;

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: newToken,
                    new_password: 'NewPassword123!' // Same as before
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/(cannot be one of your last|cannot be the same as your current)/i);
        });
        it('should increment token_version to invalidate old sessions', async () => {
            // Get current token_version
            const beforeRes = await db.query('SELECT token_version FROM users WHERE id = $1', [user.id]);
            const initialVersion = beforeRes.rows[0].token_version || 0;

            // Request reset
            await request(app)
                .post('/api/auth/password-reset-request')
                .send({ email: 'reset_test@example.com' });

            const tokenRes = await db.query('SELECT * FROM password_resets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [user.id]);
            const newToken = tokenRes.rows[0].token;

            // Execute reset
            await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: newToken,
                    new_password: 'NewPassword456!'
                });

            // Check token_version incremented
            const afterRes = await db.query('SELECT token_version FROM users WHERE id = $1', [user.id]);
            const finalVersion = afterRes.rows[0].token_version;

            expect(finalVersion).toBeGreaterThan(initialVersion);
        });

        it('should queue confirmation email after successful reset', async () => {
            const confirmToken = 'confirm-token';
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

            await db.query(
                'INSERT INTO password_resets (user_id, token, expires_at, used) VALUES ($1, $2, $3, $4)',
                [user.id, confirmToken, expiresAt, false]
            );

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: confirmToken,
                    new_password: 'NewPassword789!'
                });

            expect(res.statusCode).toBe(200);
            expect(enqueueEmail).toHaveBeenCalled();

            const [emailArgs] = enqueueEmail.mock.calls[enqueueEmail.mock.calls.length - 1];
            expect(emailArgs.to).toBe('reset_test@example.com');
            expect(emailArgs.subject).toMatch(/password has been changed/i);
        });
    });
});
