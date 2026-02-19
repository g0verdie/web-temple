const request = require('supertest');
const { queue, enqueueEmail } = require('../../../src/services/emailQueueService');
const { hashPassword } = require('../../../src/utils/authHelper');

// Mock email queue
jest.mock('../../../src/services/emailQueueService', () => ({
    queue: { add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }) },
    enqueueEmail: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
}));

// In-memory mock DB states
let mockUsers = [];
let mockPasswordResets = [];
let mockPasswordHistory = [];
let mockTokenVersion = 0;

jest.mock('../../../src/config/db', () => ({
    query: jest.fn(async (text, params) => {
        let queryText = (typeof text === 'string' ? text : text.text).toLowerCase();
        queryText = queryText.replace(/\s+/g, ' ');

        if (queryText.includes('insert into users')) {
            const user = { id: 1, email: params[0], password_hash: params[1], first_name: params[2], last_name: params[3], role: params[4], token_version: mockTokenVersion };
            mockUsers.push(user);
            return { rows: [user] };
        }
        if (queryText.includes('select') && queryText.includes('from password_resets pr join users u') && queryText.includes('pr.token = $1')) {
            const reset = mockPasswordResets.find(r => r.token === params[0]);
            if (!reset) return { rows: [] };
            const user = mockUsers.find(u => u.id === reset.user_id);
            return { rows: [{ ...reset, password_hash: user.password_hash, email: user.email }] };
        }
        if (queryText.includes('select') && queryText.includes('from password_resets') && queryText.includes('order by created_at desc limit 1')) {
            const userResets = mockPasswordResets.filter(r => r.user_id === params[0]);
            if (userResets.length === 0) return { rows: [] };
            return { rows: [userResets[userResets.length - 1]] };
        }
        if (queryText.includes('select') && queryText.includes('from password_resets where user_id = $1')) {
            return { rows: mockPasswordResets.filter(r => r.user_id === params[0]) };
        }
        if (queryText.includes('select') && queryText.includes('from users where email = $1')) {
            return { rows: mockUsers.filter(u => u.email === params[0]) };
        }
        if (queryText.includes('select token_version from users')) {
            const user = mockUsers.find(u => u.id === params[0]);
            return { rows: user ? [{ token_version: user.token_version }] : [] };
        }
        if (queryText.includes('select id, email, password_hash from users')) {
            const user = mockUsers.find(u => u.id === params[0]);
            return { rows: user ? [user] : [] };
        }
        if (queryText.includes('select password_hash from password_history')) {
            return { rows: mockPasswordHistory.filter(h => h.user_id === params[0]) };
        }
        if (queryText.includes('insert into password_resets')) {
            const reset = { id: mockPasswordResets.length + 1, user_id: params[0], token: params[1], expires_at: params[2], used: false, created_at: new Date() };
            mockPasswordResets.push(reset);
            return { rows: [reset] };
        }
        if (queryText.includes('update users set password_hash = $1') && queryText.includes('token_version')) {
            const user = mockUsers.find(u => u.id === params[1]);
            if (user) {
                user.password_hash = params[0];
                user.token_version++;
                mockTokenVersion++;
            }
            return { rows: [] };
        }
        if (queryText.includes('update password_resets set used = true')) {
            const reset = mockPasswordResets.find(r => r.id === params[0]);
            if (reset) reset.used = true;
            return { rows: [] };
        }
        if (queryText.includes('insert into password_history')) {
            mockPasswordHistory.push({ user_id: params[0], password_hash: params[1] });
            return { rows: [] };
        }
        if (queryText.includes('delete from')) {
            if (queryText.includes('password_history')) mockPasswordHistory = [];
            if (queryText.includes('password_resets')) mockPasswordResets = [];
            if (queryText.includes('users')) mockUsers = [];
            return { rows: [] };
        }
        return { rows: [] };
    }),
    pool: {
        connect: jest.fn().mockResolvedValue({
            query: jest.fn(async (text, params) => {
                let queryText = (typeof text === 'string' ? text : text.text).toLowerCase();
                queryText = queryText.replace(/\s+/g, ' ');

                if (queryText.includes('begin') || queryText.includes('commit') || queryText.includes('rollback')) {
                    return { rows: [] };
                }
                const dbMod = require('../../../src/config/db');
                return dbMod.query(text, params);
            }),
            release: jest.fn()
        }),
        end: jest.fn()
    }
}));

const db = require('../../../src/config/db');
const app = require('../../../src/server');

describe('Password Reset Flow', () => {
    let user;
    let token;

    beforeAll(async () => {
        const passwordHash = await hashPassword('CurrentPassword123!');
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
    });

    describe('POST /api/auth/password-reset-request', () => {
        it('should send a reset email for registered user', async () => {
            const res = await request(app)
                .post('/api/auth/password-reset-request')
                .send({ email: 'reset_test@example.com' });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
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
                .send({ token, new_password: newPassword });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);

            // Mock auth call logic
            db.query.mockImplementationOnce(async () => ({ rows: [mockUsers[0]] })); // Find user
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ email: 'reset_test@example.com', password: newPassword });

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
                .send({ token: expiredToken, new_password: 'NewPassword123!' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/expired/i);
        });

        it('should fail with invalid token', async () => {
            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 'invalid-token', new_password: 'NewPassword123!' });
            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should fail if password is in history', async () => {
            await request(app).post('/api/auth/password-reset-request').send({ email: 'reset_test@example.com' });
            const tokenRes = await db.query('SELECT * FROM password_resets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [user.id]);
            const newToken = tokenRes.rows[0].token;

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: newToken, new_password: 'NewPassword123!' }); // Same as before

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/(cannot be one of your last|cannot be the same as your current)/i);
        });

        it('should increment token_version to invalidate old sessions', async () => {
            const beforeRes = await db.query('SELECT token_version FROM users WHERE id = $1', [user.id]);
            const initialVersion = beforeRes.rows[0].token_version || 0;

            await request(app).post('/api/auth/password-reset-request').send({ email: 'reset_test@example.com' });
            const tokenRes = await db.query('SELECT * FROM password_resets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [user.id]);
            const newToken = tokenRes.rows[0].token;

            await request(app).post('/api/auth/reset-password').send({ token: newToken, new_password: 'NewPassword456!' });

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
                .send({ token: confirmToken, new_password: 'NewPassword789!' });

            expect(res.statusCode).toBe(200);
            expect(enqueueEmail).toHaveBeenCalled();
            const [emailArgs] = enqueueEmail.mock.calls[enqueueEmail.mock.calls.length - 1];
            expect(emailArgs.to).toBe('reset_test@example.com');
            expect(emailArgs.subject).toMatch(/password has been changed/i);
        });
    });
});
