const crypto = require('crypto');

/**
 * Versioned ciphertext envelope + keyring (idea I6).
 *
 * Proves the acceptance examples from
 * docs/plans/2026-07-02-003-feat-versioned-ciphertext-envelope-plan.md:
 *   AE1 legacy round-trip, AE2 versioned round-trip, AE3 key rotation,
 *   AE4 unknown version tag throws (+ corrupted payload still throws).
 *
 * The helper reads its keyring from the environment, so rotation is simulated
 * by mutating process.env between calls — no require-cache juggling needed.
 */
describe('Security: Versioned Ciphertext Envelope', () => {
    const ORIGINAL_KEY = 'original-encryption-key-at-least-32-chars-long-aaa';
    const ROTATED_KEY = 'rotated-encryption-key-at-least-32-chars-long-bbbb';

    let encrypt, decrypt;
    let savedEnv;

    // Reproduce the PRE-CHANGE encrypt() exactly: base64(iv_hex:ct_hex), no
    // version prefix, sha256(key) derivation, AES-256-CBC. This is what already
    // sits in the database.
    const legacyEncrypt = (plaintext, secret) => {
        const iv = crypto.randomBytes(16);
        const key = crypto.createHash('sha256').update(String(secret)).digest();
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return Buffer.from(`${iv.toString('hex')}:${encrypted}`).toString('base64');
    };

    beforeAll(() => {
        savedEnv = { ...process.env };
        process.env.ENCRYPTION_KEY = ORIGINAL_KEY;
        delete process.env.ENCRYPTION_KEY_VERSION;
        delete process.env.ENCRYPTION_KEY_V1;
        delete process.env.ENCRYPTION_KEY_V2;
        delete require.cache[require.resolve('../../src/utils/encryptionHelper')];
        const h = require('../../src/utils/encryptionHelper');
        encrypt = h.encrypt;
        decrypt = h.decrypt;
    });

    // Reset to the single-key baseline after every test so rotation cases can
    // never leak into the next test.
    afterEach(() => {
        process.env.ENCRYPTION_KEY = ORIGINAL_KEY;
        delete process.env.ENCRYPTION_KEY_VERSION;
        delete process.env.ENCRYPTION_KEY_V1;
        delete process.env.ENCRYPTION_KEY_V2;
    });

    afterAll(() => {
        process.env = savedEnv;
    });

    // AE2 / R1, R9, R16
    test('versioned round-trip: encrypt stamps the current version tag and decrypt recovers the plaintext', () => {
        const enc = encrypt('donor@example.com');
        expect(enc.startsWith('v1:')).toBe(true);
        expect(decrypt(enc)).toBe('donor@example.com');
    });

    // R3 — v1 inner payload is byte-compatible with legacy apart from the prefix.
    test('the v1 inner payload is the legacy base64(iv:ct) layout with only a "v1:" prefix added', () => {
        const enc = encrypt('layout-check');
        const inner = enc.slice('v1:'.length);
        // The inner payload alone must decrypt via the legacy (unprefixed) path.
        expect(decrypt(inner)).toBe('layout-check');
    });

    // AE1 / R4, R6, R7 — legacy unprefixed round-trip
    test('legacy round-trip: a pre-change unprefixed ciphertext decrypts to the original plaintext', () => {
        const legacy = legacyEncrypt('legacy-secret-123', ORIGINAL_KEY);
        expect(legacy).not.toMatch(/^v\d+:/);
        expect(decrypt(legacy)).toBe('legacy-secret-123');
    });

    // AE3 / R5, R8, R10, R12, R17 — key rotation
    test('key rotation: a v1 value stays decryptable after rotating current to v2, and new writes emit v2', () => {
        // Encrypt under the original v1 key.
        const v1Value = encrypt('member-phone-555-1234');
        expect(v1Value.startsWith('v1:')).toBe(true);

        // Rotate: v2 becomes current (new key), v1 retained in the keyring.
        process.env.ENCRYPTION_KEY = ROTATED_KEY;
        process.env.ENCRYPTION_KEY_VERSION = 'v2';
        process.env.ENCRYPTION_KEY_V1 = ORIGINAL_KEY;

        // Pre-rotation ciphertext still decrypts (previous key retained).
        expect(decrypt(v1Value)).toBe('member-phone-555-1234');

        // A fresh encrypt now emits a v2 envelope under the new key...
        const v2Value = encrypt('member-phone-555-1234');
        expect(v2Value.startsWith('v2:')).toBe(true);
        expect(v2Value).not.toBe(v1Value);
        // ...and round-trips.
        expect(decrypt(v2Value)).toBe('member-phone-555-1234');

        // Legacy (unprefixed) data encrypted with the original key still decrypts
        // after rotation because v1's key is retained in the keyring.
        const legacy = legacyEncrypt('legacy-after-rotation', ORIGINAL_KEY);
        expect(decrypt(legacy)).toBe('legacy-after-rotation');
    });

    // AE4 / R5, R18 — unknown version tag throws (never mis-decrypts)
    test('an unknown version tag throws rather than falling back or mis-decrypting', () => {
        const enc = encrypt('secret');            // v1:...
        const forged = enc.replace(/^v1:/, 'v9:'); // v9 is not in the keyring
        expect(() => decrypt(forged)).toThrow();
    });

    // R18 — corrupted payloads still throw (preserve the existing guarantee)
    test('a corrupted legacy payload still throws', () => {
        const corrupted = Buffer.from('corrupted-data').toString('base64');
        expect(() => decrypt(corrupted)).toThrow();
    });

    test('a corrupted versioned payload still throws', () => {
        expect(() => decrypt('v1:' + Buffer.from('corrupted-data').toString('base64'))).toThrow();
    });

    // R13 — signatures/null-handling unchanged
    test('null and undefined still pass through unchanged', () => {
        expect(encrypt(null)).toBe(null);
        expect(encrypt(undefined)).toBe(null);
        expect(decrypt(null)).toBe(null);
        expect(decrypt(undefined)).toBe(null);
    });
});
