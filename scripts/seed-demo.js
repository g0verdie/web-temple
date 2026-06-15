/**
 * scripts/seed-demo.js
 *
 * Re-runnable demo seeder for Board demos / local environments.
 *
 *   npm run seed            # provisions demo accounts + content
 *   npm run seed -- --force # required to run when NODE_ENV=production
 *
 * Idempotent: a second run produces no duplicates. Deliberately writes via
 * direct parameterized SQL (NOT the service layer) so it never enqueues member
 * email — AnnouncementService/EventService/RecordingService all fan out emails
 * on create/publish, which a seed must not trigger.
 *
 * NOTE: this is an operational script under scripts/ (not src/), so console
 * output is acceptable here.
 */

require('dotenv').config();

const bcrypt = require('bcrypt');
const db = require('../src/config/db');
const { Roles } = require('../src/config/roles-permissions');

const BCRYPT_COST = 10;
const DEMO_DOMAIN = 'florencetemple.org';
const DEMO_PASSWORD = 'DemoPass!2026';

const CONTENT_OWNER_EMAIL = `demo-admin@${DEMO_DOMAIN}`;

/**
 * Production safety guard. Refuses to run when NODE_ENV=production unless
 * --force is passed on argv.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {boolean} true if safe to proceed
 */
function assertSafeToRun(argv) {
    if (process.env.NODE_ENV === 'production' && !argv.includes('--force')) {
        return false;
    }
    return true;
}

/**
 * Build the demo account descriptors: one per distinct role. The admin is the
 * designated content owner whose id B2 content references.
 * @returns {Array<{email,password,first_name,last_name,role,isContentOwner}>}
 */
function buildDemoAccounts() {
    return [
        {
            email: CONTENT_OWNER_EMAIL,
            password: DEMO_PASSWORD,
            first_name: 'Demo',
            last_name: 'Admin',
            role: Roles.ADMIN,
            isContentOwner: true
        },
        {
            email: `demo-rabbi@${DEMO_DOMAIN}`,
            password: DEMO_PASSWORD,
            first_name: 'Demo',
            last_name: 'Rabbi',
            role: Roles.RABBI,
            isContentOwner: false
        },
        {
            email: `demo-social-chair@${DEMO_DOMAIN}`,
            password: DEMO_PASSWORD,
            first_name: 'Demo',
            last_name: 'SocialChair',
            role: Roles.SOCIAL_CHAIR,
            isContentOwner: false
        },
        {
            email: `demo-treasurer@${DEMO_DOMAIN}`,
            password: DEMO_PASSWORD,
            first_name: 'Demo',
            last_name: 'Treasurer',
            role: Roles.TREASURER,
            isContentOwner: false
        },
        {
            email: `demo-member@${DEMO_DOMAIN}`,
            password: DEMO_PASSWORD,
            first_name: 'Demo',
            last_name: 'Member',
            role: Roles.MEMBER,
            isContentOwner: false
        }
    ];
}

/**
 * Upsert the demo accounts (idempotent by email) and resolve the content-owner
 * id for B2 foreign keys.
 *
 * Mirrors the LIVE insert shape in authService.registerUser (email, password_hash,
 * first_name, last_name, role) — deliberately NOT scripts/create-admin.js, which
 * is schema-stale (username/password/is_active columns do not exist).
 *
 * @param {{query: Function}} database - db module (or a mock in tests)
 * @returns {Promise<string>} the content-owner user id
 */
async function seedDemoAccounts(database) {
    const accounts = buildDemoAccounts();
    let contentOwnerId = null;

    for (const account of accounts) {
        const passwordHash = await bcrypt.hash(account.password, BCRYPT_COST);

        const result = await database.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             ON CONFLICT (email) DO UPDATE SET
                 first_name = EXCLUDED.first_name,
                 last_name = EXCLUDED.last_name,
                 role = EXCLUDED.role,
                 updated_at = NOW()
             RETURNING id`,
            [account.email, passwordHash, account.first_name, account.last_name, account.role]
        );

        if (account.isContentOwner) {
            if (result.rows && result.rows[0]) {
                contentOwnerId = result.rows[0].id;
            } else {
                // ON CONFLICT DO UPDATE always RETURNINGs a row; this fallback covers
                // mocks / DO NOTHING variants by re-reading the owner row.
                const lookup = await database.query(
                    'SELECT id FROM users WHERE email = $1',
                    [account.email]
                );
                contentOwnerId = lookup.rows[0] ? lookup.rows[0].id : null;
            }
        }
    }

    return contentOwnerId;
}

async function main() {
    const argv = process.argv.slice(2);

    if (!assertSafeToRun(argv)) {
        console.error(
            'Refusing to seed: NODE_ENV=production. Re-run with --force if this is intentional.'
        );
        process.exit(1);
    }

    try {
        console.log('Seeding demo accounts...');
        const contentOwnerId = await seedDemoAccounts(db);

        if (!contentOwnerId) {
            throw new Error('Could not resolve the content-owner account id.');
        }

        console.log('\nDemo accounts (all share the same password):');
        for (const account of buildDemoAccounts()) {
            console.log(`  ${account.role.padEnd(13)} ${account.email}`);
        }
        console.log(`\n  Password: ${DEMO_PASSWORD}`);
        console.log('\nDemo seed complete.');
    } catch (error) {
        console.error('Demo seed failed:', error.message);
        process.exitCode = 1;
    } finally {
        if (db.pool && typeof db.pool.end === 'function') {
            await db.pool.end();
        }
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    assertSafeToRun,
    buildDemoAccounts,
    seedDemoAccounts,
    CONTENT_OWNER_EMAIL
};
