const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

/**
 * Hash a plain text password using bcrypt.
 * @param {string} password - The plain text password.
 * @returns {Promise<string>} The hashed password.
 */
const hashPassword = async (password) => {
    if (!password) {
        throw new Error('Password is required');
    }
    return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare a plain text password with a hash.
 * @param {string} password - The plain text password.
 * @param {string} hash - The bcrypt hash.
 * @returns {Promise<boolean>} True if match, false otherwise.
 */
const comparePassword = async (password, hash) => {
    if (!password || !hash) {
        throw new Error('Password and hash are required');
    }
    return bcrypt.compare(password, hash);
};

module.exports = {
    hashPassword,
    comparePassword
};
