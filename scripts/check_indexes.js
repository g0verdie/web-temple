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
        const res = await pool.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'static_pages'");
        console.log("Indexes on static_pages:");
        res.rows.forEach(r => console.log(`- ${r.indexname}: ${r.indexdef}`));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
