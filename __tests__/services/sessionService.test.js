const sessionService = require('../../src/services/sessionService');
const redis = require('../../src/config/redis');
const { Roles } = require('../../src/config/roles-permissions');

jest.mock('../../src/config/redis', () => ({
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn()
}));

describe('TC-2-5-5: Session Status Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return session status with remaining time for active ADMIN', async () => {
        const now = Date.now();
        const fiveMinutesAgo = String(now - (5 * 60 * 1000));

        redis.get.mockResolvedValueOnce(fiveMinutesAgo);

        const status = await sessionService.getSessionStatus({
            id: 'admin-1',
            role: Roles.ADMIN
        });

        expect(status.status).toBe('active');
        expect(status.remainingMs).toBeGreaterThan(24 * 60 * 1000); // ~25 min
        expect(status.percentRemaining).toBeGreaterThan(80); // >80% remaining
        expect(status.isWarningZone).toBe(false);
    });

    it('should indicate warning zone when session < 5% remaining', async () => {
        const now = Date.now();
        const twentyNineMinFortySixSecondsAgo = String(now - (29 * 60 * 1000 + 46 * 1000));

        redis.get.mockResolvedValueOnce(twentyNineMinFortySixSecondsAgo);

        const status = await sessionService.getSessionStatus({
            id: 'admin-1',
            role: Roles.ADMIN
        });

        expect(status.isWarningZone).toBe(true);
        expect(status.remainingMs).toBeLessThan(2 * 60 * 1000); // <2 min
        expect(status.percentRemaining).toBeLessThan(5);
    });

    it('should return session status for MEMBER with 30-day timeout', async () => {
        const now = Date.now();
        const tenDaysAgo = String(now - (10 * 24 * 60 * 60 * 1000));

        redis.get.mockResolvedValueOnce(tenDaysAgo);

        const status = await sessionService.getSessionStatus({
            id: 'member-1',
            role: Roles.MEMBER
        });

        expect(status.status).toBe('active');
        expect(status.remainingMs).toBeGreaterThan(19 * 24 * 60 * 60 * 1000); // ~20 days
        expect(status.percentRemaining).toBeGreaterThan(65);
        expect(status.timeoutMinutes).toBe(30 * 24 * 60); // 30 days in minutes
    });

    it('should throw 401 if session not found', async () => {
        redis.get.mockResolvedValueOnce(null);

        await expect(
            sessionService.getSessionStatus({
                id: 'user-1',
                role: Roles.MEMBER
            })
        ).rejects.toEqual({
            code: 401,
            message: 'Session not found'
        });
    });

    it('should throw 401 if not authenticated', async () => {
        await expect(
            sessionService.getSessionStatus(null)
        ).rejects.toEqual({
            code: 401,
            message: 'Not authenticated'
        });
    });

    it('should throw 500 on Redis error', async () => {
        redis.get.mockRejectedValueOnce(new Error('Redis timeout'));

        await expect(
            sessionService.getSessionStatus({
                id: 'user-1',
                role: Roles.MEMBER
            })
        ).rejects.toMatchObject({
            code: 500,
            message: 'Session check failed'
        });
    });
});

describe('TC-2-5-6: Session Expiration Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should show 0ms remaining when session just expired', async () => {
        const now = Date.now();
        const thirtyMinutesAgo = String(now - (30 * 60 * 1000));

        redis.get.mockResolvedValueOnce(thirtyMinutesAgo);

        const status = await sessionService.getSessionStatus({
            id: 'admin-1',
            role: Roles.ADMIN
        });

        expect(status.remainingMs).toBe(0);
        expect(status.percentRemaining).toBe(0);
    });

    it('should correctly calculate remaining time for RABBI role (same as ADMIN)', async () => {
        const now = Date.now();
        const tenMinutesAgo = String(now - (10 * 60 * 1000));

        redis.get.mockResolvedValueOnce(tenMinutesAgo);

        const status = await sessionService.getSessionStatus({
            id: 'rabbi-1',
            role: Roles.RABBI
        });

        expect(status.remainingMs).toBeGreaterThan(19 * 60 * 1000); // ~20 min
        expect(status.timeoutMinutes).toBe(30);
    });

    it('should track correct session key format for ADMIN role', async () => {
        const now = Date.now();
        const recentActivity = String(now - 1000);

        redis.get.mockResolvedValueOnce(recentActivity);
        await sessionService.getSessionStatus({
            id: 'admin-123',
            role: Roles.ADMIN
        });

        expect(redis.get).toHaveBeenCalledWith('session:admin:admin-123');
    });

    it('should track correct session key format for MEMBER role', async () => {
        const now = Date.now();
        const recentActivity = String(now - 1000);

        redis.get.mockResolvedValueOnce(recentActivity);
        await sessionService.getSessionStatus({
            id: 'member-456',
            role: Roles.MEMBER
        });

        expect(redis.get).toHaveBeenCalledWith('session:member:member-456');
    });
});

describe('Session Lifecycle (create/invalidate)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Since we updated the mock definition below, we need to ensure these are available
        redis.setex.mockResolvedValue('OK');
        redis.del.mockResolvedValue(1);
    });

    it('should create session with correct TTL for ADMIN', async () => {
        const user = { id: 'admin-1', role: Roles.ADMIN };
        await sessionService.createSession(user);

        const expectedKey = 'session:admin:admin-1';
        const expectedTTL = 30 * 60; // 30 min in seconds

        expect(redis.setex).toHaveBeenCalledWith(expectedKey, expectedTTL, expect.any(String));
    });

    it('should create session with correct TTL for MEMBER', async () => {
        const user = { id: 'member-1', role: Roles.MEMBER };
        await sessionService.createSession(user);

        const expectedKey = 'session:member:member-1';
        const expectedTTL = 30 * 24 * 60 * 60; // 30 days in seconds

        expect(redis.setex).toHaveBeenCalledWith(expectedKey, expectedTTL, expect.any(String));
    });

    it('should invalidate session by deleting key', async () => {
        const user = { id: 'admin-1', role: Roles.ADMIN };
        await sessionService.invalidateSession(user);

        const expectedKey = 'session:admin:admin-1';
        expect(redis.del).toHaveBeenCalledWith(expectedKey);
    });

    it('should fail to create session without user', async () => {
        await expect(sessionService.createSession(null)).rejects.toThrow('User required');
    });
});
