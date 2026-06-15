/**
 * Sentry no-op guard tests (issue #13).
 *
 * Sentry must add no event sends and no open handles when SENTRY_DSN is unset
 * and/or NODE_ENV==='test'. These tests confirm init no-ops and that booting
 * the real server.js with no DSN does not hang or break the suite.
 */

const Sentry = require('@sentry/node');
const sentry = require('../../src/config/sentry');

describe('Sentry init guard', () => {
    let initSpy;

    beforeEach(() => {
        initSpy = jest.spyOn(Sentry, 'init').mockImplementation(() => {});
    });

    afterEach(() => {
        initSpy.mockRestore();
    });

    test('initSentry() is a no-op under NODE_ENV=test (Sentry.init never called)', () => {
        expect(process.env.NODE_ENV).toBe('test');
        const result = sentry.initSentry();
        expect(result).toBe(false);
        expect(sentry.isEnabled()).toBe(false);
        expect(initSpy).not.toHaveBeenCalled();
    });

    test('attachErrorHandler() is a no-op when disabled', () => {
        const setupSpy = jest.spyOn(Sentry, 'setupExpressErrorHandler').mockImplementation(() => {});
        sentry.initSentry();
        sentry.attachErrorHandler({ use: jest.fn() });
        expect(setupSpy).not.toHaveBeenCalled();
        setupSpy.mockRestore();
    });
});

describe('server boots with Sentry disabled (no SENTRY_DSN in test)', () => {
    test('app loads and /health still responds 200', async () => {
        jest.resetModules();
        jest.doMock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
        jest.doMock('../../src/config/redis', () => ({
            get: jest.fn(),
            set: jest.fn(),
            setex: jest.fn(),
            del: jest.fn(),
            keys: jest.fn()
        }));
        const request = require('supertest');
        const app = require('../../src/server');
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ status: 'ok' }));
    });
});
