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

// ---------------------------------------------------------------------------
// B2 — content seeding (recordings, calendar events, announcements)
// All written via direct parameterized SQL to bypass the service-layer email
// fan-outs and keep full idempotency control. All rows are owned by the B1
// content owner.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Build the demo recordings (>=4), each with a stable provider key and a
 * service_date within the last ~8 weeks.
 * @returns {Array<Object>}
 */
function buildRecordings() {
    const now = Date.now();
    const specs = [
        { weeksAgo: 1, title: 'Shabbat Morning Service', torahPortion: 'Bereshit', duration: 4500 },
        { weeksAgo: 2, title: 'Friday Night Kabbalat Shabbat', torahPortion: 'Noach', duration: 3600 },
        { weeksAgo: 4, title: 'Shabbat Morning Service', torahPortion: 'Lech-Lecha', duration: 4800 },
        { weeksAgo: 6, title: 'Community Healing Service', torahPortion: 'Vayera', duration: 3300 },
        { weeksAgo: 8, title: 'Shabbat Morning Service', torahPortion: 'Chayei Sara', duration: 4200 }
    ];

    return specs.map((spec, index) => {
        const n = index + 1;
        return {
            providerRecordingId: `seed-rec-${n}`,
            title: spec.title,
            description: `Recorded service — ${spec.torahPortion}. Seeded demo content.`,
            serviceDate: new Date(now - spec.weeksAgo * WEEK_MS),
            torahPortion: spec.torahPortion,
            durationSeconds: spec.duration,
            providerVideoUrl: `https://example.org/seed/recordings/${n}`,
            previewUrl: `https://example.org/seed/recordings/${n}/preview.jpg`
        };
    });
}

/**
 * Build the demo calendar events (6-8): a mix of past and future, including at
 * least one FUTURE event_type='service' to drive the homepage countdown.
 * @returns {Array<Object>}
 */
function buildEvents() {
    const now = Date.now();
    return [
        {
            title: 'Friday Night Service',
            description: 'Weekly Kabbalat Shabbat.',
            startsAt: new Date(now + 3 * DAY_MS),
            endsAt: new Date(now + 3 * DAY_MS + 2 * 60 * 60 * 1000),
            visibility: 'public',
            eventType: 'service',
            location: 'Main Sanctuary',
            zoomUrl: null
        },
        {
            title: 'Shabbat Morning Service',
            description: 'Weekly Shabbat morning service and Torah reading.',
            startsAt: new Date(now + 10 * DAY_MS),
            endsAt: new Date(now + 10 * DAY_MS + 3 * 60 * 60 * 1000),
            visibility: 'public',
            eventType: 'service',
            location: 'Main Sanctuary',
            zoomUrl: null
        },
        {
            title: 'Adult Education: Intro to Talmud',
            description: 'Members-only weekly study session.',
            startsAt: new Date(now + 5 * DAY_MS),
            endsAt: new Date(now + 5 * DAY_MS + 90 * 60 * 1000),
            visibility: 'members',
            eventType: 'event',
            location: 'Library',
            zoomUrl: 'https://example.org/seed/zoom/talmud'
        },
        {
            title: 'Community Potluck Dinner',
            description: 'Bring a dish to share. Open to all.',
            startsAt: new Date(now + 18 * DAY_MS),
            endsAt: new Date(now + 18 * DAY_MS + 3 * 60 * 60 * 1000),
            visibility: 'public',
            eventType: 'event',
            location: 'Social Hall',
            zoomUrl: null
        },
        {
            title: 'Board Meeting',
            description: 'Monthly board meeting (members welcome to observe).',
            startsAt: new Date(now + 25 * DAY_MS),
            endsAt: new Date(now + 25 * DAY_MS + 2 * 60 * 60 * 1000),
            visibility: 'members',
            eventType: 'event',
            location: 'Conference Room',
            zoomUrl: null
        },
        {
            title: 'Friday Night Service',
            description: 'Past Kabbalat Shabbat service.',
            startsAt: new Date(now - 4 * DAY_MS),
            endsAt: new Date(now - 4 * DAY_MS + 2 * 60 * 60 * 1000),
            visibility: 'public',
            eventType: 'service',
            location: 'Main Sanctuary',
            zoomUrl: null
        },
        {
            title: 'Past Community Lecture',
            description: 'A recent guest lecture.',
            startsAt: new Date(now - 11 * DAY_MS),
            endsAt: new Date(now - 11 * DAY_MS + 90 * 60 * 1000),
            visibility: 'public',
            eventType: 'event',
            location: 'Social Hall',
            zoomUrl: null
        }
    ];
}

/**
 * Build the demo announcements (>=3, exactly one featured), with fixed UUIDs
 * so re-runs upsert in place. body_html is static, pre-sanitized markup.
 * @returns {Array<Object>}
 */
function buildAnnouncements() {
    const now = Date.now();
    return [
        {
            id: 'a1f3c2d4-0001-4b5a-9c1e-000000000001',
            title: 'High Holy Days Schedule Now Available',
            bodyHtml:
                '<p>Our complete schedule for the High Holy Days is now posted. ' +
                'Please review service times and reserve your seats early.</p>',
            bodyText:
                'Our complete schedule for the High Holy Days is now posted. ' +
                'Please review service times and reserve your seats early.',
            featured: true,
            featuredUntil: new Date(now + 30 * DAY_MS),
            publishedAt: new Date(now - 1 * DAY_MS)
        },
        {
            id: 'a1f3c2d4-0002-4b5a-9c1e-000000000002',
            title: 'Volunteers Needed for Community Potluck',
            bodyHtml:
                '<p>We are looking for volunteers to help set up and serve at our ' +
                'upcoming community potluck. Reach out to the office to sign up.</p>',
            bodyText:
                'We are looking for volunteers to help set up and serve at our ' +
                'upcoming community potluck. Reach out to the office to sign up.',
            featured: false,
            featuredUntil: null,
            publishedAt: new Date(now - 5 * DAY_MS)
        },
        {
            id: 'a1f3c2d4-0003-4b5a-9c1e-000000000003',
            title: 'Adult Education Series Begins Next Week',
            bodyHtml:
                '<p>Join us for our new adult education series on the Talmud. ' +
                'Sessions are held weekly in the Library and are open to members.</p>',
            bodyText:
                'Join us for our new adult education series on the Talmud. ' +
                'Sessions are held weekly in the Library and are open to members.',
            featured: false,
            featuredUntil: null,
            publishedAt: new Date(now - 9 * DAY_MS)
        }
    ];
}

/**
 * Seed all demo content, owned by the B1 content owner. Idempotent:
 *  - recordings: ON CONFLICT (provider_name, provider_recording_id)
 *  - events: DELETE by created_by (the dedicated owner) then re-insert
 *  - announcements: ON CONFLICT (id) on fixed UUIDs
 * @param {{query: Function}} database
 * @param {string} contentOwnerId
 */
async function seedContent(database, contentOwnerId) {
    // Recordings (upsert on the provider natural key).
    for (const rec of buildRecordings()) {
        await database.query(
            `INSERT INTO recordings (
                provider_name, provider_recording_id, provider_video_url, preview_url,
                title, description, service_date, torah_portion, duration_seconds,
                publish_state, published_at, created_at, updated_at, updated_by
            ) VALUES ('seed', $1, $2, $3, $4, $5, $6, $7, $8, 'published', NOW(), NOW(), NOW(), $9)
            ON CONFLICT (provider_name, provider_recording_id) DO UPDATE SET
                provider_video_url = EXCLUDED.provider_video_url,
                preview_url = EXCLUDED.preview_url,
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                service_date = EXCLUDED.service_date,
                torah_portion = EXCLUDED.torah_portion,
                duration_seconds = EXCLUDED.duration_seconds,
                publish_state = 'published',
                published_at = NOW(),
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by`,
            [
                rec.providerRecordingId,
                rec.providerVideoUrl,
                rec.previewUrl,
                rec.title,
                rec.description,
                rec.serviceDate,
                rec.torahPortion,
                rec.durationSeconds,
                contentOwnerId
            ]
        );
    }

    // Events have a SERIAL id with no natural key: clear this owner's events,
    // then re-insert. Only the seed owns that account, so this is safe.
    await database.query('DELETE FROM events WHERE created_by = $1', [contentOwnerId]);
    for (const evt of buildEvents()) {
        await database.query(
            `INSERT INTO events (
                title, description, starts_at, ends_at, visibility, event_type, location, zoom_url, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                evt.title,
                evt.description,
                evt.startsAt,
                evt.endsAt,
                evt.visibility,
                evt.eventType,
                evt.location,
                evt.zoomUrl,
                contentOwnerId
            ]
        );
    }

    // Announcements (upsert on fixed UUIDs).
    for (const ann of buildAnnouncements()) {
        await database.query(
            `INSERT INTO announcements (
                id, title, body_html, body_text, status, featured, featured_until,
                published_at, updated_at, created_by, updated_by
            ) VALUES ($1, $2, $3, $4, 'published', $5, $6, $7, NOW(), $8, $8)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                body_html = EXCLUDED.body_html,
                body_text = EXCLUDED.body_text,
                status = 'published',
                featured = EXCLUDED.featured,
                featured_until = EXCLUDED.featured_until,
                published_at = EXCLUDED.published_at,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by`,
            [
                ann.id,
                ann.title,
                ann.bodyHtml,
                ann.bodyText,
                ann.featured,
                ann.featuredUntil,
                ann.publishedAt,
                contentOwnerId
            ]
        );
    }
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

        console.log('Seeding demo content (recordings, calendar, announcements)...');
        await seedContent(db, contentOwnerId);

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
    buildRecordings,
    buildEvents,
    buildAnnouncements,
    seedContent,
    CONTENT_OWNER_EMAIL
};
