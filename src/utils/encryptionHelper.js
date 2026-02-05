const crypto = require('crypto');

/**
 * Encryption helper for sensitive fields (donations, PII)
 * Uses AES-256-CBC encryption with a master key from environment
 */

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size

/**
 * Validate encryption key is set
 * @throws {Error} if ENCRYPTION_KEY is not configured
 */
const validateKey = () => {
    if (!ENCRYPTION_KEY) {
        throw new Error('ENCRYPTION_KEY environment variable is not set. Cannot encrypt sensitive data.');
    }
    if (ENCRYPTION_KEY.length < 32) {
        throw new Error('ENCRYPTION_KEY must be at least 32 characters (256 bits)');
    }
};

/**
 * Encrypt a string value
 * @param {string} plaintext - The value to encrypt
 * @returns {string} IV:encrypted (base64 encoded)
 */
const encrypt = (plaintext) => {
    if (!plaintext) {
        return null;
    }

    validateKey();

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt
    let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV:encrypted as base64 for storage
    return Buffer.from(`${iv.toString('hex')}:${encrypted}`).toString('base64');
};

/**
 * Decrypt a value
 * @param {string} encrypted - Encrypted value (IV:encrypted in base64)
 * @returns {string} Decrypted plaintext
 */
const decrypt = (encrypted) => {
    if (!encrypted) {
        return null;
    }

    validateKey();

    try {
        // Decode from base64
        const parts = Buffer.from(encrypted, 'base64').toString('utf8').split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];
        
        // Create decipher
        const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        
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
