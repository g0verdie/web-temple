const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'web_temple',
    user: process.env.DB_USER || 'temple_user',
    password: process.env.DB_PASSWORD,
};

// Create (or no-op if already present) an admin user from ADMIN_* env vars.
// Mirrors the live insert shape in authService.registerUser — email,
// password_hash, first_name, last_name, role — because the users table has no
// username/password/is_active columns (the previous insert threw on every real DB).
// Accepts an injected client for testing.
async function createAdmin({ client = new Client(dbConfig) } = {}) {
    try {
        await client.connect();
        console.log('Connected to database.');

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;
        const firstName = process.env.ADMIN_FIRST_NAME || null;
        const lastName = process.env.ADMIN_LAST_NAME || null;

        if (!adminEmail || !adminPassword) {
            console.error('Missing required admin credentials. Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment (ADMIN_FIRST_NAME / ADMIN_LAST_NAME optional).');
            process.exit(1);
        }

        // Check if admin already exists
        const checkRes = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
        if (checkRes.rows.length > 0) {
            console.log('Admin user already exists.');
            return;
        }

        const passwordHash = await bcrypt.hash(adminPassword, 10);

        const insertQuery = `
      INSERT INTO users (email, password_hash, first_name, last_name, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'admin', NOW(), NOW())
      RETURNING id, email, role;
    `;

        const res = await client.query(insertQuery, [adminEmail, passwordHash, firstName, lastName]);
        console.log('Admin user created successfully:', res.rows[0]);

    } catch (err) {
        console.error('Error creating admin user:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

if (require.main === module) {
    createAdmin();
}

module.exports = { createAdmin };
