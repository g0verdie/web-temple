/**
 * config/db.js
 * Database connection configuration using pg pool
 */

const { Pool } = require('pg');

// Use DATABASE_URL from environment or fallback to local default
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/web_temple';

const pool = new Pool({
    connectionString,
    // SSL is required for most production deployments (e.g., Heroku, RDS)
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
