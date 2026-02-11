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

async function createAdmin() {
    const client = new Client(dbConfig);

    try {
        await client.connect();
        console.log('Connected to database.');

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;
        const adminUsername = process.env.ADMIN_USERNAME;

        if (!adminEmail || !adminPassword || !adminUsername) {
            console.error('Missing required admin credentials. Set ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_PASSWORD in the environment.');
            process.exit(1);
        }

        // Check if admin already exists
        const checkRes = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
        if (checkRes.rows.length > 0) {
            console.log('Admin user already exists.');
            return;
        }

        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        const insertQuery = `
      INSERT INTO users (username, email, password, role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, 'admin', true, NOW(), NOW())
      RETURNING id, username, email;
    `;

        const res = await client.query(insertQuery, [adminUsername, adminEmail, hashedPassword]);
        console.log('Admin user created successfully:', res.rows[0]);

    } catch (err) {
        console.error('Error creating admin user:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

createAdmin();
