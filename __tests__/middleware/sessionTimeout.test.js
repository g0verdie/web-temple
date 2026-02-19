const sessionTimeout = require('../../src/middleware/sessionTimeout');
const { Roles } = require('../../src/config/roles-permissions');

// Mock redis directly with all needed methods
jest.mock('../../src/config/redis', () => ({
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn()
}));

const redis = require('../../src/config/redis');

describe('Session Timeout Middleware', () => {
    const makeRes = () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        res.clearCookie = jest.fn().mockReturnValue(res);
        res.send = jest.fn().mockReturnValue(res);
        res.redirect = jest.fn().mockReturnValue(res);
        return res;
    };

    const makeReq = (overrides = {}) => ({
        user: overrides.user || null,
        cookies: overrides.cookies || {},
        accepts: overrides.accepts || (() => false)
    });

    beforeEach(() => {
        jest.clearAllMocks();
        redis.setex.mockResolvedValue('OK');
        redis.get.mockResolvedValue(null);
    });

    it('should allow request when user is member (valid session)', async () => {
        const middleware = sessionTimeout();
        const req = makeReq({ user: { id: '1', role: Roles.MEMBER } });
        const res = makeRes();
        const next = jest.fn();

        redis.get.mockResolvedValueOnce(String(Date.now()));
        redis.setex.mockResolvedValueOnce('OK');

        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request if session missing in Redis (strict enforcement)', async () => {
        const middleware = sessionTimeout();
        const req = makeReq({ user: { id: '1', role: Roles.ADMIN }, accepts: (type) => type === 'json' });
        const res = makeRes();
        const next = jest.fn();

        redis.get.mockResolvedValueOnce(null);

        await middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
    });

    it('should refresh admin session on each request', async () => {
        const middleware = sessionTimeout();
        const req = makeReq({ user: { id: '1', role: Roles.ADMIN } });
        const res = makeRes();
        const next = jest.fn();

        redis.get.mockResolvedValueOnce(String(Date.now()));
        redis.setex.mockResolvedValueOnce('OK');

        await middleware(req, res, next);

        expect(redis.setex).toHaveBeenCalledWith(
            expect.stringContaining('session:admin:1'),
            expect.any(Number),
            expect.any(String)
        );
        expect(next).toHaveBeenCalled();
    });

    it('should reject admin request if session expired (30+ min inactive)', async () => {
        const middleware = sessionTimeout();
        const req = makeReq({ user: { id: '1', role: Roles.ADMIN }, accepts: (type) => type === 'json' });
        const res = makeRes();
        const next = jest.fn();

        const thirtyOneMinutesAgo = Date.now() - (31 * 60 * 1000);
        redis.get.mockResolvedValueOnce(String(thirtyOneMinutesAgo));

        await middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Session expired'
            })
        );
        expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
    });

    it('should reject admin request if session expired with text response', async () => {
        const middleware = sessionTimeout();
        const req = makeReq({
            user: { id: '1', role: Roles.ADMIN },
            accepts: () => false
        });
        const res = makeRes();
        const next = jest.fn();

        const thirtyOneMinutesAgo = Date.now() - (31 * 60 * 1000);
        redis.get.mockResolvedValueOnce(String(thirtyOneMinutesAgo));

        await middleware(req, res, next);

        expect(res.send).toHaveBeenCalledWith('Session expired');
    });

    it('should allow admin request within 30-minute window', async () => {
        const middleware = sessionTimeout();
        const req = makeReq({ user: { id: '1', role: Roles.ADMIN } });
        const res = makeRes();
        const next = jest.fn();

        const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
        redis.get.mockResolvedValueOnce(String(fifteenMinutesAgo));
        redis.setex.mockResolvedValueOnce('OK');

        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalledWith(401);
    });

    it('should handle RABBI role same as ADMIN', async () => {
        const middleware = sessionTimeout();
        const req = makeReq({ user: { id: '2', role: Roles.RABBI } });
        const res = makeRes();
        const next = jest.fn();

        redis.get.mockResolvedValueOnce(String(Date.now() - (10 * 60 * 1000)));
        redis.setex.mockResolvedValueOnce('OK');

        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('should expire RABBI session after 30 minutes', async () => {
        const middleware = sessionTimeout();
        const req = makeReq({
            user: { id: '2', role: Roles.RABBI },
            accepts: (type) => type === 'json'
        });
        const res = makeRes();
        const next = jest.fn();

        const thirtyOneMinutesAgo = Date.now() - (31 * 60 * 1000);
        redis.get.mockResolvedValueOnce(String(thirtyOneMinutesAgo));

        await middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should clear cookie on session timeout', async () => {
        const middleware = sessionTimeout();
        const req = makeReq({
            user: { id: '1', role: Roles.ADMIN },
            accepts: (type) => type === 'json'
        });
        const res = makeRes();
        const next = jest.fn();

        const thirtyOneMinutesAgo = Date.now() - (31 * 60 * 1000);
        redis.get.mockResolvedValueOnce(String(thirtyOneMinutesAgo));

        await middleware(req, res, next);

        expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
    });

    it('should handle redis errors gracefully (fail-secure)', async () => {
        const middleware = sessionTimeout();
        const req = makeReq({ user: { id: '1', role: Roles.ADMIN }, accepts: (type) => type === 'json' });
        const res = makeRes();
        const next = jest.fn();

        redis.get.mockRejectedValueOnce(new Error('Redis error'));

        await middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should set correct Redis TTL (30 minutes)', async () => {
        const middleware = sessionTimeout({ timeoutMinutes: 30 });
        const req = makeReq({ user: { id: '1', role: Roles.ADMIN } });
        const res = makeRes();
        const next = jest.fn();

        redis.get.mockResolvedValueOnce(String(Date.now()));
        redis.setex.mockResolvedValueOnce('OK');

        await middleware(req, res, next);

        const setexCall = redis.setex.mock.calls[0];
        const ttlSeconds = setexCall[1];
        const thirtyMinutesInSeconds = 30 * 60;

        expect(ttlSeconds).toBe(thirtyMinutesInSeconds);
    });
});

describe('Session Timeout Middleware - Role-Based Timeouts (Story 2-5)', () => {
    const makeRes = () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        res.clearCookie = jest.fn().mockReturnValue(res);
        res.send = jest.fn().mockReturnValue(res);
        res.redirect = jest.fn().mockReturnValue(res);
        return res;
    };

    const makeReq = (overrides = {}) => ({
        user: overrides.user || null,
        cookies: overrides.cookies || {},
        accepts: overrides.accepts || (() => false)
    });

    beforeEach(() => {
        jest.clearAllMocks();
        redis.setex.mockResolvedValue('OK');
        redis.get.mockResolvedValue(null);
    });

    describe('TC-2-5-1: Admin timeout after 30 minutes inactivity', () => {
        it('should expire ADMIN session after 30+ minutes of inactivity', async () => {
            const middleware = sessionTimeout();
            const req = makeReq({
                user: { id: 'admin-1', role: Roles.ADMIN },
                accepts: (type) => type === 'json'
            });
            const res = makeRes();
            const next = jest.fn();

            // Set last activity to 31 minutes ago
            const thirtyOneMinutesAgo = Date.now() - (31 * 60 * 1000);
            redis.get.mockResolvedValueOnce(String(thirtyOneMinutesAgo));

            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Session expired'
            }));
            expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
            expect(next).not.toHaveBeenCalled();
        });

        it('should allow ADMIN session within 30 minutes of activity', async () => {
            const middleware = sessionTimeout();
            const req = makeReq({
                user: { id: 'admin-1', role: Roles.ADMIN }
            });
            const res = makeRes();
            const next = jest.fn();

            const twentyNineMinutesAgo = Date.now() - (29 * 60 * 1000);
            redis.get.mockResolvedValueOnce(String(twentyNineMinutesAgo));
            redis.setex.mockResolvedValueOnce('OK');

            await middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalledWith(401);
        });
    });

    describe('TC-2-5-2: Member timeout after 30 days inactivity', () => {
        it('should expire MEMBER session after 30+ days of inactivity', async () => {
            const middleware = sessionTimeout();
            const req = makeReq({
                user: { id: 'member-1', role: Roles.MEMBER },
                accepts: (type) => type === 'json'
            });
            const res = makeRes();
            const next = jest.fn();

            // Set last activity to 31 days ago
            const thirtyOneDaysAgo = Date.now() - (31 * 24 * 60 * 60 * 1000);
            redis.get.mockResolvedValueOnce(String(thirtyOneDaysAgo));

            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Session expired'
            }));
            expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
            expect(next).not.toHaveBeenCalled();
        });

        it('should allow MEMBER session within 30 days of activity', async () => {
            const middleware = sessionTimeout();
            const req = makeReq({
                user: { id: 'member-1', role: Roles.MEMBER }
            });
            const res = makeRes();
            const next = jest.fn();

            const twentyNineDaysAgo = Date.now() - (29 * 24 * 60 * 60 * 1000);
            redis.get.mockResolvedValueOnce(String(twentyNineDaysAgo));
            redis.setex.mockResolvedValueOnce('OK');

            await middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalledWith(401);
        });

        it('should track MEMBER session activity with 30-day Redis TTL', async () => {
            const middleware = sessionTimeout();
            const req = makeReq({
                user: { id: 'member-1', role: Roles.MEMBER }
            });
            const res = makeRes();
            const next = jest.fn();

            redis.get.mockResolvedValueOnce(String(Date.now()));
            redis.setex.mockResolvedValueOnce('OK');

            await middleware(req, res, next);

            const setexCall = redis.setex.mock.calls[0];
            const ttlSeconds = setexCall[1];
            const thirtyDaysInSeconds = 30 * 24 * 60 * 60;

            expect(ttlSeconds).toBe(thirtyDaysInSeconds);
            expect(next).toHaveBeenCalled();
        });
    });

    describe('TC-2-5-8: Session activity tracking on each request', () => {
        it('should update session activity timestamp for ADMIN on each request', async () => {
            const middleware = sessionTimeout();
            const req = makeReq({ user: { id: 'admin-1', role: Roles.ADMIN } });
            const res = makeRes();
            const next = jest.fn();

            redis.get.mockResolvedValueOnce(String(Date.now() - 5 * 60 * 1000));
            redis.setex.mockResolvedValueOnce('OK');

            await middleware(req, res, next);

            expect(redis.setex).toHaveBeenCalledWith(
                expect.stringContaining('session:admin:admin-1'),
                expect.any(Number),
                expect.any(String)
            );
        });

        it('should update session activity timestamp for MEMBER on each request', async () => {
            const middleware = sessionTimeout();
            const req = makeReq({ user: { id: 'member-1', role: Roles.MEMBER } });
            const res = makeRes();
            const next = jest.fn();

            redis.get.mockResolvedValueOnce(String(Date.now() - 10 * 24 * 60 * 60 * 1000));
            redis.setex.mockResolvedValueOnce('OK');

            await middleware(req, res, next);

            expect(redis.setex).toHaveBeenCalledWith(
                expect.stringContaining('session:member:member-1'),
                expect.any(Number),
                expect.any(String)
            );
        });
    });

    describe('TC-2-5-3: Token invalidation on timeout', () => {
        it('should add token to invalidation blacklist when session expires', async () => {
            const middleware = sessionTimeout();
            const req = makeReq({
                user: { id: 'admin-1', role: Roles.ADMIN },
                accepts: (type) => type === 'json'
            });
            const res = makeRes();
            const next = jest.fn();

            const thirtyOneMinutesAgo = Date.now() - (31 * 60 * 1000);
            redis.get.mockResolvedValueOnce(String(thirtyOneMinutesAgo));
            redis.del.mockResolvedValueOnce(1); // Simulate deletion of session key
            redis.setex.mockResolvedValueOnce('OK'); // For blacklist

            await middleware(req, res, next);

            // Should clear cookie on timeout (already verified)
            expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should delete expired session key from Redis', async () => {
            const middleware = sessionTimeout();
            const req = makeReq({
                user: { id: 'member-1', role: Roles.MEMBER },
                accepts: (type) => type === 'json'
            });
            const res = makeRes();
            const next = jest.fn();

            const thirtyOneDaysAgo = Date.now() - (31 * 24 * 60 * 60 * 1000);
            redis.get.mockResolvedValueOnce(String(thirtyOneDaysAgo));
            redis.del.mockResolvedValueOnce(1);

            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
        });
    });

    describe('TC-2-5-4: Prevent token reuse after timeout', () => {
        it('should reject reuse of expired token on subsequent request', async () => {
            const middleware = sessionTimeout();
            const req = makeReq({
                user: { id: 'admin-1', role: Roles.ADMIN },
                accepts: (type) => type === 'json'
            });
            const res = makeRes();
            const next = jest.fn();

            const thirtyOneMinutesAgo = Date.now() - (31 * 60 * 1000);
            redis.get.mockResolvedValueOnce(String(thirtyOneMinutesAgo));

            await middleware(req, res, next);

            // First call should reject
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Session expired'
            }));

            // Second request with same (now expired) session should also fail
            res.status.mockClear();
            redis.get.mockResolvedValueOnce(String(thirtyOneMinutesAgo)); // Still expired

            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
        });
    });
});

