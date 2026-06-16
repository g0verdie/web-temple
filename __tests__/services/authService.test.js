const { authenticateUser, registerUser } = require('../../src/services/authService');
const db = require('../../src/config/db');
const { comparePassword, hashPassword } = require('../../src/utils/authHelper');
const { logAudit } = require('../../src/services/auditService');
const MemberDirectoryService = require('../../src/services/MemberDirectoryService');

jest.mock('../../src/config/db');
jest.mock('../../src/utils/authHelper');
jest.mock('../../src/services/auditService');
jest.mock('../../src/services/MemberDirectoryService');

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

describe('authService.registerUser directory opt-in (item 6)', () => {
    const goodPassword = 'SecurePass123!@#';

    beforeEach(() => {
        jest.clearAllMocks();
        logAudit.mockResolvedValue(true);
        hashPassword.mockResolvedValue('hashed-pw');
    });

    const mockInsert = (id) => {
        db.query
            .mockResolvedValueOnce({ rows: [] })                                  // SELECT existing user
            .mockResolvedValueOnce({ rows: [{ id, email: `${id}@x.com`, role: 'member' }] }); // INSERT ... RETURNING
    };

    it('creates a listed directory profile when directory_listed is true', async () => {
        mockInsert('u1');
        MemberDirectoryService.saveMyProfile.mockResolvedValue({ user_id: 'u1' });

        await registerUser({ email: 'u1@x.com', password: goodPassword, directory_listed: true });

        expect(MemberDirectoryService.saveMyProfile).toHaveBeenCalledWith('u1', { listed: true });
    });

    it('does NOT touch the directory when directory_listed is absent/false', async () => {
        mockInsert('u2');
        await registerUser({ email: 'u2@x.com', password: goodPassword });
        expect(MemberDirectoryService.saveMyProfile).not.toHaveBeenCalled();
    });

    it('still returns the created account when the directory write fails (failure isolation)', async () => {
        mockInsert('u3');
        MemberDirectoryService.saveMyProfile.mockRejectedValue(new Error('directory down'));

        const user = await registerUser({ email: 'u3@x.com', password: goodPassword, directory_listed: true });

        expect(user.id).toBe('u3'); // registration succeeds despite the directory failure
    });
});
