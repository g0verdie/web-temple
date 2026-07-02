/**
 * config/db.js
 * Database connection configuration using pg pool
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');
const sentry = require('./sentry');
const { resolvePgSsl } = require('./pgSsl');

// Use DATABASE_URL from environment or fallback to local default
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/web_temple';

const pool = new Pool({
    connectionString,
    // SSL is required for most production deployments (e.g., Heroku, RDS).
    // In production the server certificate is now VERIFIED by default
    // (rejectUnauthorized: true), resolved via config/pgSsl.js — the same source
    // the boot preflight (R11) checks, so the pool and the gate cannot drift.
    ssl: resolvePgSsl(),
});

// An idle client can emit 'error' if the backend drops it (e.g. a DB failover
// or an idle-timeout reaped connection). Without this listener pg re-throws and
// the web process crashes. Log + report instead; the pool retires the bad
// client and the next query gets a fresh one. Mirrors redis.on('error').
pool.on('error', (err) => {
    logger.error('Postgres pool error (idle client)', { error: err && err.message, stack: err && err.stack });
    sentry.captureException(err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
