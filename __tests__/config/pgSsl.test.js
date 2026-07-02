/**
 * pgSsl.resolvePgSsl — single source of truth for the Postgres TLS option.
 *
 * Both src/config/db.js (the pool) and the boot preflight (R11) resolve TLS
 * through this one function so the preflight validates exactly the config the
 * pool will use. Non-production stays SSL-off; production is fail-closed
 * (verify the server certificate by default).
 */

const { resolvePgSsl } = require('../../src/config/pgSsl');

describe('resolvePgSsl', () => {
    test('returns false outside production (development)', () => {
        expect(resolvePgSsl({ NODE_ENV: 'development' })).toBe(false);
    });

    test('returns false under test', () => {
        expect(resolvePgSsl({ NODE_ENV: 'test' })).toBe(false);
    });

    test('production default verifies the server certificate', () => {
        expect(resolvePgSsl({ NODE_ENV: 'production' })).toEqual({ rejectUnauthorized: true });
    });

    test('production honors the explicit DATABASE_SSL_REJECT_UNAUTHORIZED=false opt-out', () => {
        expect(
            resolvePgSsl({ NODE_ENV: 'production', DATABASE_SSL_REJECT_UNAUTHORIZED: 'false' })
        ).toEqual({ rejectUnauthorized: false });
    });

    test('production with a CA certificate keeps verification on and passes the CA through', () => {
        const ca = '-----BEGIN CERTIFICATE-----\nMII...\n-----END CERTIFICATE-----';
        expect(resolvePgSsl({ NODE_ENV: 'production', DATABASE_CA_CERT: ca })).toEqual({
            rejectUnauthorized: true,
            ca,
        });
    });

    test('production forces verification when a CA is supplied even if DATABASE_SSL_REJECT_UNAUTHORIZED=false', () => {
        // A CA means "verify against this CA"; the false opt-out must not silently
        // win, because Node tls ignores the CA when rejectUnauthorized:false — the
        // config would then verify nothing despite carrying a certificate.
        const ca = '-----BEGIN CERTIFICATE-----\nMII...\n-----END CERTIFICATE-----';
        expect(
            resolvePgSsl({
                NODE_ENV: 'production',
                DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
                DATABASE_CA_CERT: ca,
            })
        ).toEqual({ rejectUnauthorized: true, ca });
    });
});
