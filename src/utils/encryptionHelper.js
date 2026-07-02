const crypto = require('crypto');

/**
 * Encryption helper for sensitive fields (donations, PII).
 *
 * Ciphertext is stored in a versioned envelope: `<version-tag>:<base64(payload)>`
 * (e.g. `v1:...`). The version tag selects both the key and the cipher algorithm
 * from a small keyring, unlocking ENCRYPTION_KEY rotation while keeping every
 * legacy (pre-versioning) value decryptable forever.
 *
 * Formats:
 *   - Versioned:  `v1:base64(iv_hex:ct_hex)` — current write format. v1 uses the
 *     current ENCRYPTION_KEY with AES-256-CBC, so the inner payload is
 *     byte-compatible with the legacy layout apart from the added prefix.
 *   - Legacy:     `base64(iv_hex:ct_hex)` — any value without a recognized
 *     `vN:` prefix. Decrypted via the v1 key + AES-256-CBC, exactly as before.
 *
 * A `vN:` prefix is an unambiguous discriminator because base64 never contains
 * `:`, so a legacy blob can never be mistaken for a versioned one.
 *
 * See docs/plans/2026-07-02-003-feat-versioned-ciphertext-envelope-plan.md.
 */

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size
const VERSION_DELIMITER = ':';
const DEFAULT_VERSION = 'v1';

// Version tag → cipher algorithm. Versions not listed here default to
// AES-256-CBC, so rotating to a new key (e.g. v2, same algorithm) needs no code
// edit. A future authenticated version would reserve its slot here, e.g.
// `v2: 'aes-256-gcm'` — that algorithm is not implemented yet.
const VERSION_ALGORITHMS = {
    v1: 'aes-256-cbc',
};

// Matches a leading version tag like `v1:` / `v12:`. base64 never contains `:`,
// so an unprefixed (legacy) value can never match this.
const VERSION_TAG_RE = /^(v\d+):([\s\S]*)$/;
const PREVIOUS_KEY_RE = /^ENCRYPTION_KEY_V(\d+)$/;

const algorithmFor = (version) => VERSION_ALGORITHMS[version] || ALGORITHM;

const deriveKey = (secret) => crypto.createHash('sha256').update(String(secret)).digest();

/**
 * Build the keyring from the environment.
 *
 * The current version's secret is always ENCRYPTION_KEY. Previous versions'
 * secrets come from `ENCRYPTION_KEY_V<n>` variables, so a rotation is expressed
 * purely in config: bump ENCRYPTION_KEY_VERSION, set ENCRYPTION_KEY to the new
 * key, and retain the prior key as ENCRYPTION_KEY_V<old>. A deployment that sets
 * only ENCRYPTION_KEY behaves as before with that key as the current version.
 *
 * @param {object} env
 * @returns {{ currentVersion: string, keys: Object<string, string> }}
 */
const buildKeyring = (env) => {
    const currentVersion = (env.ENCRYPTION_KEY_VERSION || '').trim() || DEFAULT_VERSION;
    const keys = {};

    if (env.ENCRYPTION_KEY) {
        keys[currentVersion] = env.ENCRYPTION_KEY;
    }

    Object.keys(env).forEach((name) => {
        const match = PREVIOUS_KEY_RE.exec(name);
        if (match && env[name]) {
            const version = `v${match[1]}`;
            // The current version's key always comes from ENCRYPTION_KEY.
            if (!(version in keys)) {
                keys[version] = env[name];
            }
        }
    });

    return { currentVersion, keys };
};

/**
 * Validate the current encryption key is set.
 * @throws {Error} if ENCRYPTION_KEY is not configured
 */
const validateKey = () => {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY environment variable is not set. Cannot encrypt sensitive data.');
    }
    if (encryptionKey.length < 32) {
        throw new Error('ENCRYPTION_KEY must be at least 32 characters (256 bits)');
    }
};

/**
 * Encrypt a string value under the current keyring version.
 * @param {string} plaintext - The value to encrypt
 * @returns {string|null} `<current-version>:base64(iv:encrypted)`, or null for falsy input
 */
const encrypt = (plaintext) => {
    if (!plaintext) {
        return null;
    }

    validateKey();

    const { currentVersion, keys } = buildKeyring(process.env);
    const algorithm = algorithmFor(currentVersion);
    const key = deriveKey(keys[currentVersion]);

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    // Encrypt
    let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Wrap the base64(iv:encrypted) payload in the current version envelope.
    const payload = Buffer.from(`${iv.toString('hex')}:${encrypted}`).toString('base64');
    return `${currentVersion}${VERSION_DELIMITER}${payload}`;
};

/**
 * Decrypt a value.
 *
 * A recognized `vN:` prefix routes to that version's key + algorithm from the
 * keyring; a syntactically-versioned tag absent from the keyring throws rather
 * than falling back. Any value without a recognized prefix is legacy and is
 * decrypted with the v1 key + AES-256-CBC exactly as before versioning.
 *
 * @param {string} encrypted - Versioned or legacy ciphertext
 * @returns {string|null} Decrypted plaintext, or null for falsy input
 */
const decrypt = (encrypted) => {
    if (!encrypted) {
        return null;
    }

    validateKey();

    const { keys } = buildKeyring(process.env);

    // Route by version: a recognized prefix selects the version; anything else
    // is legacy and resolves to the v1 key/algorithm.
    const match = VERSION_TAG_RE.exec(encrypted);
    const version = match ? match[1] : DEFAULT_VERSION;
    const payload = match ? match[2] : encrypted;

    const secret = keys[version];
    if (!secret) {
        throw new Error(`Decryption failed: no key configured for version "${version}"`);
    }
    const algorithm = algorithmFor(version);

    try {
        // Decode from base64
        const parts = Buffer.from(payload, 'base64').toString('utf8').split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];

        // Create decipher
        const key = deriveKey(secret);
        const decipher = crypto.createDecipheriv(algorithm, key, iv);

        // Decrypt
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        throw new Error(`Decryption failed: ${error.message}`);
    }
};

module.exports = {
    encrypt,
    decrypt,
    validateKey,
    ALGORITHM,
};
