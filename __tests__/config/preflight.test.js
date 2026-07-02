/**
 * Fail-closed boot preflight (docs/plans/2026-07-01-004-feat-boot-preflight-plan.md).
 *
 * Two tiers: security checks are fatal (refuse the boot), content checks warn.
 * Production-only — inert under NODE_ENV=test/development so the suite and dev
 * boots are never blocked.
 */

jest.mock('../../src/utils/logger', () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
}));

const logger = require('../../src/utils/logger');
const { evaluatePreflight, runPreflight } = require('../../src/config/preflight');
const { resolvePgSsl } = require('../../src/config/pgSsl');

// A production env in which every enumerated check passes. Individual tests
// override single keys to drive one check red at a time.
const goodEnv = () => ({
    NODE_ENV: 'production',
    JWT_SECRET: 'a-real-random-64-char-secret-value-not-a-placeholder-xxxxxxxxxxxx',
    ENCRYPTION_KEY: '28d8c744b15c94f8152150da0c3c0788e271dcab65e09f90f94e897f927d17be',
    APP_URL: 'https://www.example.org',
    TEMPLE_EIN: '12-3456789',
    FACEBOOK_PAGE_ID: '1234567890',
});

const messages = (arr) => arr.join(' | ');

describe('evaluatePreflight — logic', () => {
    test('AE5 (R1): every check passes → no fatal, no warnings', () => {
        const { fatal, warnings } = evaluatePreflight(goodEnv());
        expect(fatal).toEqual([]);
        expect(warnings).toEqual([]);
    });

    test('AE1 (R4, R8): placeholder JWT_SECRET is fatal and names JWT_SECRET', () => {
        const { fatal } = evaluatePreflight({ ...goodEnv(), JWT_SECRET: 'your_jwt_secret_key' });
        expect(fatal.some((m) => /JWT_SECRET/.test(m))).toBe(true);
    });

    test('R8: empty JWT_SECRET is fatal and names JWT_SECRET', () => {
        const { fatal } = evaluatePreflight({ ...goodEnv(), JWT_SECRET: '' });
        expect(fatal.some((m) => /JWT_SECRET/.test(m))).toBe(true);
    });

    test('R9: placeholder ENCRYPTION_KEY is fatal and names ENCRYPTION_KEY', () => {
        const { fatal } = evaluatePreflight({ ...goodEnv(), ENCRYPTION_KEY: 'your_encryption_key' });
        expect(fatal.some((m) => /ENCRYPTION_KEY/.test(m))).toBe(true);
    });

    test('R9: too-short ENCRYPTION_KEY is fatal (consistent with encryptionHelper ≥32)', () => {
        const { fatal } = evaluatePreflight({ ...goodEnv(), ENCRYPTION_KEY: 'short-key' });
        expect(fatal.some((m) => /ENCRYPTION_KEY/.test(m))).toBe(true);
    });

    test('AE2 (R4, R10): localhost APP_URL is fatal and names APP_URL', () => {
        const { fatal } = evaluatePreflight({ ...goodEnv(), APP_URL: 'http://localhost:3000' });
        expect(fatal.some((m) => /APP_URL/.test(m))).toBe(true);
    });

    test('R10: 127.0.0.1 APP_URL is fatal and names APP_URL', () => {
        const { fatal } = evaluatePreflight({ ...goodEnv(), APP_URL: 'http://127.0.0.1:3000' });
        expect(fatal.some((m) => /APP_URL/.test(m))).toBe(true);
    });

    test('R10: unset APP_URL is fatal and names APP_URL', () => {
        const env = goodEnv();
        delete env.APP_URL;
        const { fatal } = evaluatePreflight(env);
        expect(fatal.some((m) => /APP_URL/.test(m))).toBe(true);
    });

    test('AE3 (R4, R11): rejectUnauthorized:false with no CA is fatal and names the Postgres TLS check', () => {
        const { fatal } = evaluatePreflight({
            ...goodEnv(),
            DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
        });
        expect(fatal.some((m) => /Postgres|TLS/i.test(m))).toBe(true);
    });

    test('R11: a supplied CA forces verification on, so false+ca passes because the effective config actually verifies', () => {
        const env = {
            ...goodEnv(),
            DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
            DATABASE_CA_CERT: '-----BEGIN CERTIFICATE-----\nMII...\n-----END CERTIFICATE-----',
        };
        // The effective TLS config must actually verify the server cert to pass
        // R11 — a CA alongside rejectUnauthorized:false must not slip through as a
        // non-verifying config.
        expect(resolvePgSsl(env).rejectUnauthorized).toBe(true);
        const { fatal } = evaluatePreflight(env);
        expect(fatal.some((m) => /Postgres|TLS/i.test(m))).toBe(false);
    });

    test('AE4 (R6, R12): non-numeric FACEBOOK_PAGE_ID warns (not fatal) and names FACEBOOK_PAGE_ID', () => {
        const { fatal, warnings } = evaluatePreflight({ ...goodEnv(), FACEBOOK_PAGE_ID: 'my.temple.page' });
        expect(fatal).toEqual([]);
        expect(warnings.some((m) => /FACEBOOK_PAGE_ID/.test(m))).toBe(true);
    });

    test('R12: unset FACEBOOK_PAGE_ID does not warn', () => {
        const env = goodEnv();
        delete env.FACEBOOK_PAGE_ID;
        const { warnings } = evaluatePreflight(env);
        expect(warnings.some((m) => /FACEBOOK_PAGE_ID/.test(m))).toBe(false);
    });

    test('R13: absent TEMPLE_EIN warns (not fatal) and names TEMPLE_EIN', () => {
        const env = goodEnv();
        delete env.TEMPLE_EIN;
        const { fatal, warnings } = evaluatePreflight(env);
        expect(fatal).toEqual([]);
        expect(warnings.some((m) => /TEMPLE_EIN/.test(m))).toBe(true);
    });

    test('AE7 (R3, R5): placeholder JWT_SECRET AND localhost APP_URL → both are named', () => {
        const { fatal } = evaluatePreflight({
            ...goodEnv(),
            JWT_SECRET: 'your_jwt_secret_key',
            APP_URL: 'http://localhost:3000',
        });
        expect(messages(fatal)).toMatch(/JWT_SECRET/);
        expect(messages(fatal)).toMatch(/APP_URL/);
    });
});

describe('runPreflight — boot behavior', () => {
    const ORIGINAL_ENV = process.env;
    let exitSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...ORIGINAL_ENV };
        exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env = ORIGINAL_ENV;
        exitSpy.mockRestore();
    });

    test('AE6 (R2): under NODE_ENV=test the preflight does not run, even with red config', () => {
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = 'your_jwt_secret_key';
        process.env.APP_URL = 'http://localhost:3000';
        runPreflight();
        expect(exitSpy).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });

    test('R2: under development the preflight does not run', () => {
        process.env.NODE_ENV = 'development';
        process.env.JWT_SECRET = 'your_jwt_secret_key';
        runPreflight();
        expect(exitSpy).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });

    test('AE1 (R4): in production a fatal failure exits non-zero and logs an error naming the check', () => {
        Object.assign(process.env, goodEnv(), { JWT_SECRET: 'your_jwt_secret_key' });
        runPreflight();
        expect(exitSpy).toHaveBeenCalledWith(1);
        const logged = logger.error.mock.calls.map((c) => c[0]).join(' | ');
        expect(logged).toMatch(/JWT_SECRET/);
    });

    test('AE4 (R6): in production a content failure warns but does not exit', () => {
        Object.assign(process.env, goodEnv(), { FACEBOOK_PAGE_ID: 'not-numeric' });
        runPreflight();
        expect(exitSpy).not.toHaveBeenCalled();
        const warned = logger.warn.mock.calls.map((c) => c[0]).join(' | ');
        expect(warned).toMatch(/FACEBOOK_PAGE_ID/);
    });

    test('AE5 (R1): in production with all checks passing, boot proceeds (no exit, no warnings)', () => {
        Object.assign(process.env, goodEnv());
        runPreflight();
        expect(exitSpy).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
    });
});
