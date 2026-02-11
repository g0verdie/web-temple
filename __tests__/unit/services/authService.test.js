const { registerUser, authenticateUser, changePassword, requestPasswordReset } = require('../../../src/services/authService');
const db = require('../../../src/config/db');

jest.mock('../../../src/config/db', () => {

    let users = [];
    let idCounter = 1;

    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const query = jest.fn(async (text, params = []) => {
        if (text.startsWith('DELETE FROM users WHERE email LIKE')) {
            const pattern = params[0] || '';
            const regex = new RegExp(`^${escapeRegex(pattern).replace(/%/g, '.*')}$`);
            users = users.filter((user) => !regex.test(user.email));
            return { rowCount: 1, rows: [] };
        }

        if (text.startsWith('DELETE FROM users WHERE email = $1')) {
            const email = params[0];
            users = users.filter((user) => user.email !== email);
            return { rowCount: 1, rows: [] };
        }

        if (text.startsWith('SELECT id FROM users WHERE email = $1')) {
            const email = params[0];
            const user = users.find((u) => u.email === email);
            return { rows: user ? [{ id: user.id }] : [] };
        }

        if (text.startsWith('SELECT id, email, password_hash, role, first_name, last_name FROM users WHERE email = $1')) {
            const email = params[0];
            const user = users.find((u) => u.email === email);
            return { rows: user ? [user] : [] };
        }

        if (text.startsWith('INSERT INTO users')) {
            const [email, password_hash, first_name, last_name, role] = params;
            const newUser = {
                id: `user-${idCounter++}`,
                email,
                password_hash,
                first_name: first_name || null,
                last_name: last_name || null,
                role,
                created_at: new Date()
            };
            users.push(newUser);
            return {
                rows: [
                    {
                        id: newUser.id,
                        email: newUser.email,
                        first_name: newUser.first_name,
                        last_name: newUser.last_name,
                        role: newUser.role,
                        created_at: newUser.created_at
                    }
                ]
            };
        }

        if (text.startsWith('SELECT id, email, password_hash FROM users WHERE id = $1')) {
            const id = params[0];
            const user = users.find((u) => u.id === id);
            return { rows: user ? [user] : [] };
        }

        if (text.startsWith('UPDATE users SET password_hash')) {
            const [password_hash, id] = params;
            const user = users.find((u) => u.id === id);
            if (user) user.password_hash = password_hash;
            return { rows: [] };
        }

        if (text.startsWith('SELECT password_hash FROM users WHERE id = $1')) {
            const id = params[0];
            const user = users.find((u) => u.id === id);
            return { rows: user ? [{ password_hash: user.password_hash }] : [] };
        }

        return { rows: [] };
    });

    const reset = () => {
        users = [];
        idCounter = 1;
    };

    return {
        query,
        pool: { query },
        __reset: reset
    };
});

describe('Unit: Authentication Service', () => {
    beforeEach(() => {
        if (typeof db.__reset === 'function') {
            db.__reset();
        }
    });

    beforeAll(async () => {
        // Clean up test data before running
        await db.query('DELETE FROM users WHERE email LIKE $1', ['test-auth-%@example.com']);
    });

    afterAll(async () => {
        // Clean up test data after running
        await db.query('DELETE FROM users WHERE email LIKE $1', ['test-auth-%@example.com']);
    });

    describe('User Registration', () => {
        it('should register a new user with hashed password', async () => {
            const userData = {
                email: 'test-auth-register@example.com',
                password: 'TestPassword123!',
                first_name: 'Test',
                last_name: 'User',
                ip_address: '127.0.0.1',
            };

            const user = await registerUser(userData);

            expect(user).toBeDefined();
            expect(user.email).toBe(userData.email);
            expect(user.first_name).toBe('Test');
            expect(user.role).toBe('member');
            expect(user.password_hash).toBeUndefined(); // Should not return hash

            // Verify password was hashed in database
            const dbUser = await db.query(
                'SELECT password_hash FROM users WHERE id = $1',
                [user.id]
            );
            expect(dbUser.rows[0].password_hash).toBeDefined();
            expect(dbUser.rows[0].password_hash).not.toBe(userData.password);
        });

        it('should reject password shorter than 12 characters', async () => {
            const userData = {
                email: 'test-auth-short-pw@example.com',
                password: 'Short123!',  // Only 9 characters
                ip_address: '127.0.0.1',
            };

            await expect(registerUser(userData)).rejects.toThrow(
                'Password must be at least 12 characters'
            );
        });

        it('should reject duplicate email', async () => {
            const email = 'test-auth-duplicate@example.com';

            // Register first user
            await registerUser({
                email,
                password: 'ValidPassword123!',
                ip_address: '127.0.0.1',
            });

            // Try to register with same email
            await expect(
                registerUser({
                    email,
                    password: 'AnotherPassword123!',
                    ip_address: '127.0.0.1',
                })
            ).rejects.toThrow('Email already registered');
        });
    });

    describe('User Authentication', () => {
        beforeEach(async () => {
            // Clean up potentially existing user
            await db.query('DELETE FROM users WHERE email = $1', ['test-auth-login@example.com']);

            // Create a test user for auth tests
            await registerUser({
                email: 'test-auth-login@example.com',
                password: 'ValidPassword123!',
                first_name: 'Test',
                last_name: 'Login',
                ip_address: '127.0.0.1',
            });
        });

        it('should authenticate user with correct credentials', async () => {
            const user = await authenticateUser({
                email: 'test-auth-login@example.com',
                password: 'ValidPassword123!',
                ip_address: '127.0.0.1',
            });

            expect(user).toBeDefined();
            expect(user.email).toBe('test-auth-login@example.com');
            expect(user.first_name).toBe('Test');
            expect(user.password_hash).toBeUndefined();
        });

        it('should reject wrong password', async () => {
            await expect(
                authenticateUser({
                    email: 'test-auth-login@example.com',
                    password: 'WrongPassword123!',
                    ip_address: '127.0.0.1',
                })
            ).rejects.toThrow('Invalid email or password');
        });

        it('should reject non-existent email', async () => {
            await expect(
                authenticateUser({
                    email: 'test-auth-nonexistent@example.com',
                    password: 'AnyPassword123!',
                    ip_address: '127.0.0.1',
                })
            ).rejects.toThrow('Invalid email or password');
        });
    });

    describe('Password Management', () => {
        beforeEach(async () => {
            // Clean up potentially existing user
            await db.query('DELETE FROM users WHERE email = $1', ['test-auth-password@example.com']);

            // Create a test user for password tests
            const user = await registerUser({
                email: 'test-auth-password@example.com',
                password: 'CurrentPassword123!',
                ip_address: '127.0.0.1',
            });
            this.testUserId = user.id;
        });

        it('should change password successfully', async () => {
            await changePassword({
                user_id: this.testUserId,
                current_password: 'CurrentPassword123!',
                new_password: 'NewPassword456!',
                ip_address: '127.0.0.1',
            });

            // Verify login with new password works
            const user = await authenticateUser({
                email: 'test-auth-password@example.com',
                password: 'NewPassword456!',
                ip_address: '127.0.0.1',
            });

            expect(user).toBeDefined();
        });

        it('should reject wrong current password', async () => {
            await expect(
                changePassword({
                    user_id: this.testUserId,
                    current_password: 'WrongCurrent123!',
                    new_password: 'NewPassword456!',
                    ip_address: '127.0.0.1',
                })
            ).rejects.toThrow('Current password is incorrect');
        });

        it('should reject new password shorter than 12 characters', async () => {
            await expect(
                changePassword({
                    user_id: this.testUserId,
                    current_password: 'CurrentPassword123!',
                    new_password: 'Short123!',
                    ip_address: '127.0.0.1',
                })
            ).rejects.toThrow('New password must be at least 12 characters');
        });

        it('should reject identical current and new password', async () => {
            await expect(
                changePassword({
                    user_id: this.testUserId,
                    current_password: 'CurrentPassword123!',
                    new_password: 'CurrentPassword123!',
                    ip_address: '127.0.0.1',
                })
            ).rejects.toThrow('New password cannot be the same as current password');
        });
    });

    describe('Password Reset Requests', () => {
        it('should return success message even if email does not exist', async () => {
            const response = await requestPasswordReset({
                email: 'missing-user@example.com',
                ip_address: '127.0.0.1'
            });

            expect(response).toEqual({
                message: 'If an account exists with this email, a reset link will be sent'
            });
        });

        it('should create a reset token for existing users', async () => {
            await registerUser({
                email: 'test-auth-reset@example.com',
                password: 'ValidPassword123!',
                ip_address: '127.0.0.1'
            });

            const response = await requestPasswordReset({
                email: 'test-auth-reset@example.com',
                ip_address: '127.0.0.1'
            });

            expect(response).toEqual({
                message: 'If an account exists with this email, a reset link will be sent'
            });
        });
    });
});
