const requireAdmin = require('../../src/middleware/requireAdmin');

describe('requireAdmin middleware', () => {
    const makeRes = () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        res.send = jest.fn().mockReturnValue(res);
        return res;
    };

    const makeReq = (overrides = {}) => ({
        user: overrides.user,
        query: overrides.query || {},
        get: overrides.get || (() => undefined),
        accepts: overrides.accepts || (() => false)
    });

    afterEach(() => {
        delete process.env.ADMIN_TOKEN;
        jest.clearAllMocks();
    });

    it('allows admin role user', () => {
        const req = makeReq({ user: { role: 'admin' } });
        const res = makeRes();
        const next = jest.fn();

        requireAdmin(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('rejects when admin token required and missing', () => {
        process.env.ADMIN_TOKEN = 'secret';
        const req = makeReq({
            accepts: () => true
        });
        const res = makeRes();
        const next = jest.fn();

        requireAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
        expect(next).not.toHaveBeenCalled();
    });

    it('allows when admin token provided', () => {
        process.env.ADMIN_TOKEN = 'secret';
        const req = makeReq({
            get: (header) => (header === 'x-admin-token' ? 'secret' : undefined)
        });
        const res = makeRes();
        const next = jest.fn();

        requireAdmin(req, res, next);

        expect(req.user).toEqual(expect.objectContaining({ role: 'admin' }));
        expect(next).toHaveBeenCalled();
    });

    it('allows when no token configured and no user', () => {
        const req = makeReq();
        const res = makeRes();
        const next = jest.fn();

        requireAdmin(req, res, next);

        expect(req.user).toEqual(expect.objectContaining({ role: 'admin' }));
        expect(next).toHaveBeenCalled();
    });

    it('rejects non-admin user when no admin token configured', () => {
        const req = makeReq({ user: { role: 'member' }, accepts: () => false });
        const res = makeRes();
        const next = jest.fn();

        requireAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.send).toHaveBeenCalledWith('Forbidden');
        expect(next).not.toHaveBeenCalled();
    });
});
