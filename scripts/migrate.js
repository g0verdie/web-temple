/**
 * scripts/migrate.js
 * Simple migration runner with retry logic
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 seconds

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectWithRetry() {
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            const client = await pool.connect();
            return client;
        } catch (error) {
            retries++;
            console.log(`Connection attempt ${retries}/${MAX_RETRIES} failed. Retrying in ${RETRY_DELAY / 1000}s...`);
            if (retries === MAX_RETRIES) throw error;
            await sleep(RETRY_DELAY);
        }
    }
}

async function migrate() {
    let client;
    try {
        console.log('Connecting to database...');
        client = await connectWithRetry();

        // 1. Create migrations table if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Get applied migrations
        const result = await client.query('SELECT name FROM migrations');
        const appliedMigrations = new Set(result.rows.map(row => row.name));

        const migrationsDir = path.join(__dirname, '../migrations');
        const files = fs.readdirSync(migrationsDir).sort();

        // Check if we need to bootstrap (users table exists but no migrations recorded)
        if (appliedMigrations.size === 0) {
            const usersCheck = await client.query("SELECT to_regclass('public.users')");
            if (usersCheck.rows[0].to_regclass) {
                console.log('Existing database detected. Bootstrapping migration history...');
                const bootstrapFiles = [
                    '000_create_users_table.sql',
                    '001_create_static_pages.sql',
                    '002_create_messages_table.sql',
                    '003_create_audit_logs_table.sql',
                    '004_create_donations_table.sql',
                    '005_create_password_resets_table.sql',
                    '006_add_login_tracking_to_users.sql'
                ];

                for (const file of bootstrapFiles) {
                    if (files.includes(file)) {
                        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
                        appliedMigrations.add(file);
                        console.log(`mark ${file} as applied (bootstrapped)`);
                    }
                }
            }
        }

        console.log('Running migrations...');

        for (const file of files) {
            if (file.endsWith('.sql')) {
                if (appliedMigrations.has(file)) {
                    // console.log(`Skipping ${file} (already applied)`);
                    continue;
                }

                console.log(`Applying ${file}...`);
                const filePath = path.join(migrationsDir, file);
                const sql = fs.readFileSync(filePath, 'utf8');

                try {
                    await client.query('BEGIN');
                    await client.query(sql);
                    await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
                    await client.query('COMMIT');
                    console.log(`✅ Applied ${file}`);
                } catch (err) {
                    await client.query('ROLLBACK');
                    console.error(`❌ Failed to apply ${file}: ${err.message}`);
                    throw err; // Stop migration process
                }
            }
        }
        console.log('All migrations checked/applied successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

migrate();
