/**
 * config/db.js
 * Database connection configuration using pg pool
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');
const sentry = require('./sentry');

// Use DATABASE_URL from environment or fallback to local default
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/web_temple';

const pool = new Pool({
    connectionString,
    // SSL is required for most production deployments (e.g., Heroku, RDS)
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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
