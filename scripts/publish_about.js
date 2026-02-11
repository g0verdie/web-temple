require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function run() {
    try {
        const res = await pool.query("UPDATE static_pages SET published = TRUE WHERE slug = 'about'");
        console.log(`Updated about page (count: ${res.rowCount})`);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
