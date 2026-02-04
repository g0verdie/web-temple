/**
 * scripts/migrate.js
 * Simple migration runner with retry logic
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
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

        const migrationsDir = path.join(__dirname, '../migrations');
        const files = fs.readdirSync(migrationsDir).sort();

        console.log('Running migrations...');

        for (const file of files) {
            if (file.endsWith('.sql')) {
                console.log(`Checking ${file}...`);
                const filePath = path.join(migrationsDir, file);
                const sql = fs.readFileSync(filePath, 'utf8');
                await client.query(sql);
                console.log(`✅ Applied ${file}`);
            }
        }
        console.log('All migrations applied successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

migrate();
