/**
 * services/MemberDirectoryService.js
 * Member directory: profile read/write, opt-in/visibility-enforced browse & search,
 * and admin moderation. Privacy invariants live here (see plan KTD2/KTD3):
 *  - Visibility is enforced server-side: hidden fields and unlisted profiles never
 *    leave the service for member-facing callers.
 *  - phone and household are encrypted at rest and NEVER appear in WHERE/ILIKE/ORDER.
 *  - Decryption is failure-tolerant: a single bad/stale-key value omits that field
 *    rather than throwing and taking down a whole listing.
 *  - There is no `asAdmin` bypass parameter: admin-only reads are separate methods.
 */

const db = require('../config/db');
const validator = require('validator');
const logger = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryptionHelper');
const { logAudit, AUDIT_ACTIONS } = require('./auditService');

const FLAG_DEFAULTS = {
    listed: false,
    show_phone: false,
    show_email: false,
    show_household: false,
    show_address: false,
    show_birthday: false
};

const FIELD_MAX = { phone: 32, address: 200, bio: 500, interests: 200 };

// Only these columns may be cleared by moderation (allow-list — never trust caller input for column names).
const MODERATABLE_FIELDS = ['bio', 'interests', 'household_encrypted'];

const normalizeFlags = (input) => {
    const merged = { ...FLAG_DEFAULTS };
    if (input && typeof input === 'object') {
        for (const [key, value] of Object.entries(input)) {
            if (Object.prototype.hasOwnProperty.call(FLAG_DEFAULTS, key) && typeof value === 'boolean') {
                merged[key] = value;
            }
        }
    }
    return merged;
};

const cleanText = (value, max, name) => {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    if (s.length === 0) return null;
    if (s.length > max) {
        throw new Error(`${name} must be ${max} characters or fewer`);
    }
    return s;
};

// Household is a structured list of people: { name, relationship, birthday }.
// It is stored as an encrypted JSON array (see migration 018 / household_encrypted).
const HOUSEHOLD_MAX_PEOPLE = 20;
const HOUSEHOLD_FIELD_MAX = { name: 80, relationship: 60 };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Normalize caller input (array, or a JSON string the client pre-serialized) into a
// clean array of people. Trims fields, drops entries with no name, clears non-ISO
// birthdays, and caps the list length. Returns [] for empty/invalid input.
const normalizeHousehold = (value) => {
    let arr = value;
    if (typeof arr === 'string') {
        const trimmed = arr.trim();
        if (!trimmed) return [];
        try {
            arr = JSON.parse(trimmed);
        } catch (e) {
            // Treat an unparseable string as a single legacy free-text entry.
            return [{ name: trimmed.slice(0, HOUSEHOLD_FIELD_MAX.name), relationship: '', birthday: '' }];
        }
    }
    if (!Array.isArray(arr)) return [];

    const people = [];
    for (const entry of arr) {
        if (!entry || typeof entry !== 'object') continue;
        const name = String(entry.name || '').trim().slice(0, HOUSEHOLD_FIELD_MAX.name);
        if (!name) continue; // a person without a name is not a person
        const relationship = String(entry.relationship || '').trim().slice(0, HOUSEHOLD_FIELD_MAX.relationship);
        const rawBirthday = String(entry.birthday || '').trim();
        const birthday = ISO_DATE.test(rawBirthday) ? rawBirthday : '';
        people.push({ name, relationship, birthday });
        if (people.length >= HOUSEHOLD_MAX_PEOPLE) break;
    }
    return people;
};

// Decrypted household value → array of people. Backward-compatible: legacy values are
// encrypted plain text (not JSON), so a parse failure or non-array result is treated as
// a single free-text entry rather than throwing (KTD2: never crash a render).
const parseHousehold = (decrypted) => {
    if (!decrypted) return [];
    try {
        const parsed = JSON.parse(decrypted);
        if (Array.isArray(parsed)) {
            return normalizeHousehold(parsed);
        }
    } catch (e) {
        // not JSON — fall through to the legacy single-entry path
    }
    return [{ name: String(decrypted).slice(0, HOUSEHOLD_FIELD_MAX.name), relationship: '', birthday: '' }];
};

// Birthday: stored as a full ISO date (YYYY-MM-DD), encrypted at rest, but only the
// month and day are ever shown to other members (the year/age stays private — KTD3).
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

// Validate caller input into a stored birthday string or null. The YEAR IS OPTIONAL:
//  - 'YYYY-MM-DD' (full date) — validated strictly and rejected if in the future.
//  - 'MM-DD'      (month + day only, year omitted) — validated against a leap year so
//                 Feb 29 is allowed; no future check (a month/day has no year to compare).
// Members only ever see the month + day, so omitting the year keeps the age private by
// construction. Parsed from the page's month/day/(optional year) fields.
const cleanBirthday = (value) => {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    if (s.length === 0) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        if (!validator.isDate(s, { format: 'YYYY-MM-DD', strictMode: true })) {
            throw new Error('Birthday must be a valid date');
        }
        // Lexical ISO compare is timezone-agnostic and good enough for a birthday guard.
        const todayIso = new Date().toISOString().slice(0, 10);
        if (s > todayIso) {
            throw new Error('Birthday cannot be in the future');
        }
        return s;
    }
    if (/^\d{2}-\d{2}$/.test(s)) {
        // 2000 is a leap year, so a Feb 29 birthday (year unknown) is accepted.
        if (!validator.isDate(`2000-${s}`, { format: 'YYYY-MM-DD', strictMode: true })) {
            throw new Error('Birthday must be a valid date');
        }
        return s;
    }
    throw new Error('Birthday must be a valid date');
};

// Member-facing display: month + day only, never the year. Accepts both the full
// 'YYYY-MM-DD' and the year-less 'MM-DD' stored forms. Parsed straight from the string
// (no Date object) to avoid any timezone shift. Returns null on bad input.
const formatBirthdayMonthDay = (value) => {
    const m = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!m) return null;
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${MONTH_NAMES[month - 1]} ${day}`;
};

// Failure-tolerant decrypt: never throw out of a listing render (KTD2).
const safeDecrypt = (value) => {
    if (!value) return null;
    try {
        return decrypt(value);
    } catch (err) {
        logger.warn(`Member directory: failed to decrypt a field, omitting it (${err.message})`);
        return null;
    }
};

const computeInitials = (firstName, lastName, email) => {
    const f = (firstName || '').trim();
    const l = (lastName || '').trim();
    if (f || l) {
        return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() || (email || '?').charAt(0).toUpperCase();
    }
    return (email || '?').charAt(0).toUpperCase();
};

/**
 * Shape a joined row for a MEMBER-facing viewer: include sensitive fields ONLY when
 * their show_* flag is true. Hidden fields are absent from the returned object (no
 * key at all) so they never reach the controller/view/payload (R7/AE2).
 */
const shapeForMember = (row) => {
    const shaped = {
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        initials: computeInitials(row.first_name, row.last_name, row.email),
        bio: row.bio || null,
        interests: row.interests || null
    };
    if (row.show_phone) shaped.phone = safeDecrypt(row.phone_encrypted);
    if (row.show_email) shaped.email = row.email;
    if (row.show_household) shaped.household = parseHousehold(safeDecrypt(row.household_encrypted));
    if (row.show_address) shaped.address = safeDecrypt(row.address_encrypted);
    if (row.show_birthday) shaped.birthday = formatBirthdayMonthDay(safeDecrypt(row.birthday_encrypted));
    return shaped;
};

/**
 * Owner's own profile (for the edit page): all fields, with phone/household decrypted.
 * Returns flag defaults + empty fields when the member has no profile row yet.
 */
const getMyProfile = async (userId) => {
    const result = await db.query(
        `SELECT u.first_name, u.last_name, u.email,
                mp.listed, mp.show_phone, mp.show_email, mp.show_household, mp.show_address, mp.show_birthday,
                mp.phone_encrypted, mp.household_encrypted, mp.address_encrypted, mp.birthday_encrypted, mp.bio, mp.interests
         FROM users u
         LEFT JOIN member_profiles mp ON mp.user_id = u.id
         WHERE u.id = $1`,
        [userId]
    );
    if (result.rows.length === 0) {
        throw new Error('User not found');
    }
    const row = result.rows[0];
    return {
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        listed: row.listed || false,
        show_phone: row.show_phone || false,
        show_email: row.show_email || false,
        show_household: row.show_household || false,
        show_address: row.show_address || false,
        show_birthday: row.show_birthday || false,
        phone: safeDecrypt(row.phone_encrypted) || '',
        household: parseHousehold(safeDecrypt(row.household_encrypted)),
        address: safeDecrypt(row.address_encrypted) || '',
        birthday: safeDecrypt(row.birthday_encrypted) || '',
        bio: row.bio || '',
        interests: row.interests || ''
    };
};

/**
 * Create/update the caller's own profile. Validates, encrypts PII, upserts, audits.
 * `household_consent` must be true when enabling show_household (defense-in-depth for
 * the UI acknowledgement that no non-consenting person is named — see plan R3).
 */
const saveMyProfile = async (userId, input = {}) => {
    const flags = normalizeFlags(input);
    if (flags.show_household && input.household_consent !== true) {
        throw new Error('Household consent acknowledgement is required to show household');
    }

    const phone = cleanText(input.phone, FIELD_MAX.phone, 'Phone');
    const address = cleanText(input.address, FIELD_MAX.address, 'Address');
    const birthday = cleanBirthday(input.birthday);
    const bio = cleanText(input.bio, FIELD_MAX.bio, 'Bio');
    const interests = cleanText(input.interests, FIELD_MAX.interests, 'Interests');

    // Household is a structured people-list serialized to JSON; empty list stores null.
    const householdPeople = normalizeHousehold(input.household);
    const householdJson = householdPeople.length > 0 ? JSON.stringify(householdPeople) : null;

    const phoneEncrypted = encrypt(phone);
    const householdEncrypted = encrypt(householdJson);
    const addressEncrypted = encrypt(address);
    const birthdayEncrypted = encrypt(birthday);

    const result = await db.query(
        `INSERT INTO member_profiles
            (user_id, listed, show_phone, show_email, show_household, show_address,
             phone_encrypted, household_encrypted, address_encrypted, bio, interests,
             show_birthday, birthday_encrypted, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
            listed = EXCLUDED.listed,
            show_phone = EXCLUDED.show_phone,
            show_email = EXCLUDED.show_email,
            show_household = EXCLUDED.show_household,
            show_address = EXCLUDED.show_address,
            phone_encrypted = EXCLUDED.phone_encrypted,
            household_encrypted = EXCLUDED.household_encrypted,
            address_encrypted = EXCLUDED.address_encrypted,
            bio = EXCLUDED.bio,
            interests = EXCLUDED.interests,
            show_birthday = EXCLUDED.show_birthday,
            birthday_encrypted = EXCLUDED.birthday_encrypted,
            updated_at = NOW()
         RETURNING user_id`,
        [userId, flags.listed, flags.show_phone, flags.show_email, flags.show_household, flags.show_address,
            phoneEncrypted, householdEncrypted, addressEncrypted, bio, interests,
            flags.show_birthday, birthdayEncrypted]
    );

    logAudit({
        user_id: userId,
        action: AUDIT_ACTIONS.DIRECTORY_LISTING_UPDATED,
        entity_type: 'member_profile',
        entity_id: userId,
        description: `Directory profile saved (listed: ${flags.listed})`
    }).catch(err => logger.error('Audit log error:', err));

    return { user_id: result.rows[0].user_id, ...flags };
};

/**
 * Browse/search LISTED profiles only. Reads live (no cache — KTD8). Search matches
 * name + interests via ILIKE; encrypted columns are never referenced in WHERE/ORDER.
 */
const listListedProfiles = async ({ search, page = 1, limit = 20 } = {}) => {
    const offset = (page - 1) * limit;
    const whereClauses = ['mp.listed = true'];
    const values = [];
    let paramIndex = 1;

    if (search && String(search).trim()) {
        whereClauses.push(
            `(u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR mp.interests ILIKE $${paramIndex})`
        );
        values.push(`%${String(search).trim()}%`);
        paramIndex++;
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;
    const countQuery = `SELECT COUNT(*) FROM member_profiles mp JOIN users u ON u.id = mp.user_id ${whereString}`;
    const dataQuery = `
        SELECT mp.user_id, u.first_name, u.last_name, u.email,
               mp.show_phone, mp.show_email, mp.show_household, mp.show_address, mp.show_birthday,
               mp.phone_encrypted, mp.household_encrypted, mp.address_encrypted, mp.birthday_encrypted, mp.bio, mp.interests
        FROM member_profiles mp
        JOIN users u ON u.id = mp.user_id
        ${whereString}
        ORDER BY u.last_name ASC, u.first_name ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

    const client = await db.pool.connect();
    try {
        const countResult = await client.query(countQuery, values);
        const rawCount = countResult && countResult.rows && countResult.rows[0]
            ? parseInt(countResult.rows[0].count, 10)
            : 0;
        const totalCount = Number.isFinite(rawCount) && rawCount >= 0 ? rawCount : 0;

        const dataResult = await client.query(dataQuery, [...values, limit, offset]);
        return {
            profiles: dataResult.rows.map(shapeForMember),
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page
        };
    } catch (error) {
        logger.error('Error listing directory profiles:', error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Single LISTED profile for a member viewer. Returns null when the member is not
 * listed (member-facing callers can never see an unlisted profile).
 */
const getListedProfile = async (userId) => {
    // Guard the UUID column: a malformed id (e.g. /directory/foo) would otherwise
    // hit Postgres 22P02 and surface as a 500. Treat it as not-found instead
    // (mirrors RecordingService.getPublishedRecordingById's uuid guard).
    if (!userId || !validator.isUUID(String(userId))) {
        return null;
    }
    const result = await db.query(
        `SELECT mp.user_id, u.first_name, u.last_name, u.email,
                mp.show_phone, mp.show_email, mp.show_household, mp.show_address, mp.show_birthday,
                mp.phone_encrypted, mp.household_encrypted, mp.address_encrypted, mp.birthday_encrypted, mp.bio, mp.interests
         FROM member_profiles mp
         JOIN users u ON u.id = mp.user_id
         WHERE mp.user_id = $1 AND mp.listed = true`,
        [userId]
    );
    if (result.rows.length === 0) return null;
    return shapeForMember(result.rows[0]);
};

/**
 * ADMIN-ONLY: full profile for any member regardless of listed/visibility (R16).
 * Reachable only from a requirePermission(MANAGE_DIRECTORY)-gated controller.
 */
const getProfileForAdmin = async (userId) => {
    const result = await db.query(
        `SELECT u.id AS user_id, u.first_name, u.last_name, u.email,
                mp.listed, mp.show_phone, mp.show_email, mp.show_household, mp.show_address, mp.show_birthday,
                mp.phone_encrypted, mp.household_encrypted, mp.address_encrypted, mp.birthday_encrypted, mp.bio, mp.interests
         FROM users u
         LEFT JOIN member_profiles mp ON mp.user_id = u.id
         WHERE u.id = $1`,
        [userId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        listed: row.listed || false,
        show_phone: row.show_phone || false,
        show_email: row.show_email || false,
        show_household: row.show_household || false,
        show_address: row.show_address || false,
        show_birthday: row.show_birthday || false,
        phone: safeDecrypt(row.phone_encrypted),
        household: parseHousehold(safeDecrypt(row.household_encrypted)),
        address: safeDecrypt(row.address_encrypted),
        birthday: safeDecrypt(row.birthday_encrypted),
        bio: row.bio || null,
        interests: row.interests || null
    };
};

/**
 * ADMIN-ONLY: list all members (listed or not), with optional name/email/interest
 * search. Lightweight rows (no decrypted PII) for the admin table (R16).
 */
const listAllMembersForAdmin = async ({ search, page = 1, limit = 20 } = {}) => {
    const offset = (page - 1) * limit;
    const whereClauses = ['1=1'];
    const values = [];
    let paramIndex = 1;

    if (search && String(search).trim()) {
        whereClauses.push(
            `(u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR mp.interests ILIKE $${paramIndex})`
        );
        values.push(`%${String(search).trim()}%`);
        paramIndex++;
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;
    const countQuery = `SELECT COUNT(*) FROM users u LEFT JOIN member_profiles mp ON mp.user_id = u.id ${whereString}`;
    const dataQuery = `
        SELECT u.id AS user_id, u.first_name, u.last_name, u.email,
               COALESCE(mp.listed, false) AS listed,
               (mp.user_id IS NOT NULL) AS has_profile
        FROM users u
        LEFT JOIN member_profiles mp ON mp.user_id = u.id
        ${whereString}
        ORDER BY u.last_name ASC, u.first_name ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

    const client = await db.pool.connect();
    try {
        const countResult = await client.query(countQuery, values);
        const rawCount = countResult && countResult.rows && countResult.rows[0]
            ? parseInt(countResult.rows[0].count, 10)
            : 0;
        const totalCount = Number.isFinite(rawCount) && rawCount >= 0 ? rawCount : 0;

        const dataResult = await client.query(dataQuery, [...values, limit, offset]);
        return {
            members: dataResult.rows,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page
        };
    } catch (error) {
        logger.error('Error listing all members for admin:', error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * ADMIN-ONLY moderation (R17): unlist a profile and/or clear offending free-text
 * fields. `clearFields` is validated against MODERATABLE_FIELDS — any other column
 * name is ignored. Audit-logged. Standalone; no dependency on the Rabbi dashboard.
 */
const moderateProfile = async (targetUserId, { unlist = false, clearFields = [], actorId = null } = {}) => {
    const setClauses = [];
    if (unlist) setClauses.push('listed = false');

    const fieldsToClear = Array.isArray(clearFields)
        ? clearFields.filter(f => MODERATABLE_FIELDS.includes(f))
        : [];
    for (const field of fieldsToClear) {
        setClauses.push(`${field} = NULL`); // field is from the fixed allow-list, never raw input
    }

    if (setClauses.length === 0) {
        return { moderated: false };
    }

    setClauses.push('updated_at = NOW()');
    await db.query(
        `UPDATE member_profiles SET ${setClauses.join(', ')} WHERE user_id = $1`,
        [targetUserId]
    );

    logAudit({
        user_id: actorId,
        action: AUDIT_ACTIONS.DIRECTORY_MODERATED,
        entity_type: 'member_profile',
        entity_id: targetUserId,
        description: `Directory profile moderated (unlist: ${!!unlist}; cleared: ${fieldsToClear.join(',') || 'none'})`
    }).catch(err => logger.error('Audit log error:', err));

    return { moderated: true, unlisted: !!unlist, cleared: fieldsToClear };
};

/**
 * Whether to show the activation nudge to a member: only when they are not listed
 * and have not dismissed it (R20). Dismissal lives in users.notification_preferences.
 */
const getNudgeState = async (userId) => {
    const result = await db.query(
        `SELECT COALESCE(mp.listed, false) AS listed,
                COALESCE((u.notification_preferences->>'directory_nudge_dismissed')::boolean, false) AS dismissed
         FROM users u
         LEFT JOIN member_profiles mp ON mp.user_id = u.id
         WHERE u.id = $1`,
        [userId]
    );
    if (result.rows.length === 0) {
        return { listed: false, dismissed: false, showNudge: false };
    }
    const { listed, dismissed } = result.rows[0];
    return { listed, dismissed, showNudge: !listed && !dismissed };
};

/**
 * Persist nudge dismissal. Uses a jsonb merge so other notification preferences are
 * preserved untouched (no read-modify-write race).
 */
const dismissNudge = async (userId) => {
    await db.query(
        `UPDATE users
         SET notification_preferences = COALESCE(notification_preferences, '{}'::jsonb) || '{"directory_nudge_dismissed": true}'::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [userId]
    );
    return true;
};

/**
 * ADMIN-ONLY export (item 8): every LISTED member, shaped to the member-visible
 * projection — hidden fields are omitted and the birthday is month+day only, exactly
 * as the public browse shows them (shapeForMember). Unbounded over listed members (a
 * single congregation), no pagination; decrypts PII per row. The export can never
 * include an unlisted member or a field a member chose to hide.
 */
const listAllForExport = async () => {
    const result = await db.query(
        `SELECT mp.user_id, u.first_name, u.last_name, u.email,
                mp.show_phone, mp.show_email, mp.show_household, mp.show_address, mp.show_birthday,
                mp.phone_encrypted, mp.household_encrypted, mp.address_encrypted, mp.birthday_encrypted, mp.bio, mp.interests
         FROM member_profiles mp
         JOIN users u ON u.id = mp.user_id
         WHERE mp.listed = true
         ORDER BY u.last_name ASC, u.first_name ASC`
    );
    return result.rows.map(shapeForMember);
};

// Stable column order for both CSV and JSON exports.
const EXPORT_COLUMNS = ['Name', 'Email', 'Phone', 'Address', 'Birthday', 'Interests', 'Bio', 'Household'];

// Flatten a member-visible profile to a human-readable export record. Fields the member
// hid are absent from `shaped`, so they serialize as empty here — the export can never
// reveal a hidden field. Household (a people array) is joined to a readable string.
const toExportRecord = (p) => ({
    Name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
    Email: p.email || '',
    Phone: p.phone || '',
    Address: p.address || '',
    Birthday: p.birthday || '',
    Interests: p.interests || '',
    Bio: p.bio || '',
    Household: Array.isArray(p.household)
        ? p.household.map(h => (h.relationship ? `${h.name} (${h.relationship})` : h.name)).join('; ')
        : ''
});

// CSV with spreadsheet-formula-injection neutralization — names/bio/interests/household
// are fully user-controlled. Mirrors DonationService.toCsv.
const toCsv = (profiles) => {
    const escape = (v) => {
        let s = String(v == null ? '' : v);
        if (/^[=+\-@]/.test(s)) s = `'${s}`;
        return `"${s.replace(/"/g, '""')}"`;
    };
    const header = EXPORT_COLUMNS.join(',');
    const lines = (profiles || []).map((p) => {
        const rec = toExportRecord(p);
        return EXPORT_COLUMNS.map((c) => escape(rec[c])).join(',');
    });
    return [header, ...lines].join('\n');
};

// JSON export: the same member-visible records as the CSV, as structured objects.
const toExportJson = (profiles) => (profiles || []).map(toExportRecord);

module.exports = {
    getMyProfile,
    saveMyProfile,
    listListedProfiles,
    getListedProfile,
    getProfileForAdmin,
    listAllMembersForAdmin,
    listAllForExport,
    toCsv,
    toExportJson,
    moderateProfile,
    getNudgeState,
    dismissNudge,
    // exported for tests / reuse
    EXPORT_COLUMNS,
    MODERATABLE_FIELDS,
    computeInitials
};
