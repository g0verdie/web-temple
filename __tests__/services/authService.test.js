const { authenticateUser } = require('../../src/services/authService');
const db = require('../../src/config/db');
const { comparePassword } = require('../../src/utils/authHelper');
const { logAudit } = require('../../src/services/auditService');

jest.mock('../../src/config/db');
jest.mock('../../src/utils/authHelper');
jest.mock('../../src/services/auditService');

describe('authService.authenticateUser', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        logAudit.mockResolvedValue(true);
    });

    it('should throw error if account is locked', async () => {
        const lockoutTime = new Date(Date.now() + 10000); // Future time
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 1,
                email: 'test@example.com',
                password_hash: 'hash',
                lockout_until: lockoutTime,
                failed_login_attempts: 5
            }]
        });

        await expect(authenticateUser({ email: 'test@example.com', password: 'password' }))
            .rejects.toThrow(/Account is temporarily locked/);
    });

    it('should increment failed attempts on invalid password', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 1,
                email: 'test@example.com',
                password_hash: 'hash',
                lockout_until: null,
                failed_login_attempts: 0
            }]
        });
        comparePassword.mockResolvedValueOnce(false); // Invalid password

        await expect(authenticateUser({ email: 'test@example.com', password: 'wrong' }))
            .rejects.toThrow('Invalid email or password');

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE users SET failed_login_attempts'),
            expect.arrayContaining([1, 1]) // increment to 1 for user 1
        );
    });

    it('should lock account after 5 failed attempts', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 1,
                email: 'test@example.com',
                password_hash: 'hash',
                lockout_until: null,
                failed_login_attempts: 4
            }]
        });
        comparePassword.mockResolvedValueOnce(false);

        await expect(authenticateUser({ email: 'test@example.com', password: 'wrong' }))
            .rejects.toThrow('Invalid email or password');

        // Should update lockout_until
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE users SET failed_login_attempts = $1, updated_at = NOW(), lockout_until = NOW() + INTERVAL \'15 minutes\''),
            expect.arrayContaining([5, 1])
        );
    });

    it('should reset failed attempts and update last_login_at on success', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 1,
                email: 'test@example.com',
                password_hash: 'hash',
                role: 'member',
                first_name: 'Test',
                last_name: 'User',
                lockout_until: null,
                failed_login_attempts: 2
            }]
        });
        comparePassword.mockResolvedValueOnce(true); // Valid password

        const user = await authenticateUser({ email: 'test@example.com', password: 'correct' });

        expect(user).toBeDefined();
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE users SET failed_login_attempts = 0, lockout_until = NULL, last_login_at = NOW()'),
            expect.arrayContaining([1])
        );
    });
});
