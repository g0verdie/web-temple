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
const logger = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryptionHelper');
const { logAudit, AUDIT_ACTIONS } = require('./auditService');

const FLAG_DEFAULTS = {
    listed: false,
    show_phone: false,
    show_email: false,
    show_household: false
};

const FIELD_MAX = { phone: 32, household: 200, bio: 500, interests: 200 };

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
    if (row.show_household) shaped.household = safeDecrypt(row.household_encrypted);
    return shaped;
};

/**
 * Owner's own profile (for the edit page): all fields, with phone/household decrypted.
 * Returns flag defaults + empty fields when the member has no profile row yet.
 */
const getMyProfile = async (userId) => {
    const result = await db.query(
        `SELECT u.first_name, u.last_name, u.email,
                mp.listed, mp.show_phone, mp.show_email, mp.show_household,
                mp.phone_encrypted, mp.household_encrypted, mp.bio, mp.interests
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
        phone: safeDecrypt(row.phone_encrypted) || '',
        household: safeDecrypt(row.household_encrypted) || '',
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
    const household = cleanText(input.household, FIELD_MAX.household, 'Household');
    const bio = cleanText(input.bio, FIELD_MAX.bio, 'Bio');
    const interests = cleanText(input.interests, FIELD_MAX.interests, 'Interests');

    const phoneEncrypted = encrypt(phone);
    const householdEncrypted = encrypt(household);

    const result = await db.query(
        `INSERT INTO member_profiles
            (user_id, listed, show_phone, show_email, show_household,
             phone_encrypted, household_encrypted, bio, interests, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
            listed = EXCLUDED.listed,
            show_phone = EXCLUDED.show_phone,
            show_email = EXCLUDED.show_email,
            show_household = EXCLUDED.show_household,
            phone_encrypted = EXCLUDED.phone_encrypted,
            household_encrypted = EXCLUDED.household_encrypted,
            bio = EXCLUDED.bio,
            interests = EXCLUDED.interests,
            updated_at = NOW()
         RETURNING user_id`,
        [userId, flags.listed, flags.show_phone, flags.show_email, flags.show_household,
            phoneEncrypted, householdEncrypted, bio, interests]
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
               mp.show_phone, mp.show_email, mp.show_household,
               mp.phone_encrypted, mp.household_encrypted, mp.bio, mp.interests
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
    const result = await db.query(
        `SELECT mp.user_id, u.first_name, u.last_name, u.email,
                mp.show_phone, mp.show_email, mp.show_household,
                mp.phone_encrypted, mp.household_encrypted, mp.bio, mp.interests
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
                mp.listed, mp.show_phone, mp.show_email, mp.show_household,
                mp.phone_encrypted, mp.household_encrypted, mp.bio, mp.interests
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
        phone: safeDecrypt(row.phone_encrypted),
        household: safeDecrypt(row.household_encrypted),
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
const moderateProfile = async (targetUserId, { unlist = false, clearFields = [] } = {}) => {
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

module.exports = {
    getMyProfile,
    saveMyProfile,
    listListedProfiles,
    getListedProfile,
    getProfileForAdmin,
    listAllMembersForAdmin,
    moderateProfile,
    getNudgeState,
    dismissNudge,
    // exported for tests / reuse
    MODERATABLE_FIELDS,
    computeInitials
};
