jest.mock('../../src/utils/logger', () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
}));

const logger = require('../../src/utils/logger');
const errorHandler = require('../../src/middleware/errorHandler');
const { NotFoundError, ValidationError } = require('../../src/errors');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    return res;
};

const mockReq = (overrides = {}) => ({
    path: '/some/page',
    originalUrl: '/some/page',
    method: 'GET',
    ip: '127.0.0.1',
    id: 'req-1',
    headers: {},
    ...overrides
});

const ORIGINAL_ENV = process.env.NODE_ENV;

afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_ENV;
    jest.clearAllMocks();
});

describe('terminal errorHandler', () => {
    it('preserves EBADCSRFTOKEN -> 403 JSON behavior (R6)', () => {
        const req = mockReq();
        const res = mockRes();
        errorHandler({ code: 'EBADCSRFTOKEN' }, req, res, () => {});
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: 'Invalid CSRF token. Please refresh the page and try again.'
        });
    });

    it('AE1: a NotFoundError on a JSON route returns 404 with the safe message and no stack', () => {
        const req = mockReq({ path: '/api/thing', originalUrl: '/api/thing' });
        const res = mockRes();
        errorHandler(new NotFoundError('User not found'), req, res, () => {});
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'User not found' });
        expect(res.render).not.toHaveBeenCalled();
        const body = res.json.mock.calls[0][0];
        expect(JSON.stringify(body)).not.toMatch(/at Object|\.js:\d+/);
    });

    it('AE2: an untyped bare Error in production yields 500 generic JSON while full detail is logged', () => {
        process.env.NODE_ENV = 'production';
        const req = mockReq({ path: '/api/x', originalUrl: '/api/x', method: 'POST' });
        const res = mockRes();
        errorHandler(new Error('pg_dump failed: /secret/path'), req, res, () => {});
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Something went wrong' });
        // full internal message + stack logged regardless of what the client sees (R7)
        expect(logger.error).toHaveBeenCalledTimes(1);
        const [logMsg, logMeta] = logger.error.mock.calls[0];
        expect(logMsg).toContain('pg_dump failed: /secret/path');
        expect(logMsg).toContain('/api/x');
        expect(logMsg).toContain('POST');
        expect(logMeta).toHaveProperty('stack');
        expect(logMeta).toHaveProperty('requestId', 'req-1');
    });

    it('R8: content-negotiates HTML for a browser (non-/api, no JSON Accept)', () => {
        const req = mockReq({ path: '/dashboard', originalUrl: '/dashboard', headers: { accept: 'text/html' } });
        const res = mockRes();
        errorHandler(new NotFoundError('Nope'), req, res, () => {});
        expect(res.render).toHaveBeenCalledWith('error', expect.objectContaining({
            message: 'Nope',
            noindex: true
        }));
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).not.toHaveBeenCalled();
    });

    it('R8: JSON for Accept: application/json even off the /api prefix', () => {
        const req = mockReq({ path: '/dashboard', originalUrl: '/dashboard', headers: { accept: 'application/json' } });
        const res = mockRes();
        errorHandler(new ValidationError('bad'), req, res, () => {});
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'bad' });
        expect(res.render).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('R9: non-production may surface the real message for an untyped error (dev convenience)', () => {
        process.env.NODE_ENV = 'development';
        const req = mockReq({ path: '/dashboard', originalUrl: '/dashboard', headers: { accept: 'text/html' } });
        const res = mockRes();
        errorHandler(new Error('boom detail'), req, res, () => {});
        expect(res.render).toHaveBeenCalledWith('error', expect.objectContaining({ message: 'boom detail' }));
    });

    it('exposed typed errors always show their client message even in production', () => {
        process.env.NODE_ENV = 'production';
        const req = mockReq({ path: '/api/x', originalUrl: '/api/x' });
        const res = mockRes();
        errorHandler(new ValidationError('Title is required'), req, res, () => {});
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Title is required' });
    });
});
