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

    it('should allow request when user is not admin (no timeout needed)', async () => {
        const middleware = sessionTimeout();
        const req = makeReq({ user: { id: '1', role: Roles.MEMBER } });
        const res = makeRes();
        const next = jest.fn();

        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow admin request when no session timeout configured', async () => {
        const middleware = sessionTimeout();
        const req = makeReq({ user: { id: '1', role: Roles.ADMIN } });
        const res = makeRes();
        const next = jest.fn();

        redis.get.mockResolvedValueOnce(null);

        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
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
        const req = makeReq({ user: { id: '1', role: Roles.ADMIN }, accepts: () => true });
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
            accepts: () => true
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
            accepts: () => true
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
        const req = makeReq({ user: { id: '1', role: Roles.ADMIN }, accepts: () => true });
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
