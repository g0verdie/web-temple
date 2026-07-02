/**
 * pgSsl.js — single source of truth for the Postgres SSL/TLS option.
 *
 * Both src/config/db.js (which opens the pool) and the boot preflight
 * (src/config/preflight.js, R11) resolve TLS through this one function, so the
 * preflight validates exactly the config the pool will use — the two cannot
 * drift.
 *
 * Outside production, SSL is off (unchanged local/CI behavior). In production
 * the default is fail-closed: the server certificate IS verified
 * (rejectUnauthorized: true). Deployments whose Postgres presents a private CA
 * supply it via DATABASE_CA_CERT (PEM), which keeps verification on. The
 * historical behavior (rejectUnauthorized: false) is still reachable via
 * DATABASE_SSL_REJECT_UNAUTHORIZED=false, but the boot preflight refuses to
 * start on it — so disabling verification becomes an explicit, logged operator
 * choice rather than a silent default.
 */
// Deploy note: because the production default verifies the server certificate,
// a managed Postgres presenting a private-CA or self-signed cert will refuse to
// boot (preflight R11) unless the deployment supplies DATABASE_CA_CERT
// (preferred) — or, as a last resort, sets the DATABASE_SSL_REJECT_UNAUTHORIZED
// =false opt-out to disable verification entirely.
function resolvePgSsl(env = process.env) {
    if (env.NODE_ENV !== 'production') {
        return false;
    }

    const ca = env.DATABASE_CA_CERT;
    // A CA is only supplied when the deployment wants that CA verified, so its
    // presence forces verification on: Node tls ignores the CA when
    // rejectUnauthorized:false, so honoring the opt-out here would yield a config
    // that verifies nothing despite carrying a certificate.
    const rejectUnauthorized = ca ? true : env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';

    const ssl = { rejectUnauthorized };
    if (ca) {
        ssl.ca = ca;
    }
    return ssl;
}

module.exports = { resolvePgSsl };
