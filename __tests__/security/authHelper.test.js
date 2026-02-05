const { hashPassword, comparePassword } = require('../../src/utils/authHelper');

describe('Security: Auth Helper (Bcrypt)', () => {
    it('should hash a password successfully', async () => {
        const password = 'mySuperSecretPassword123!';
        const hash = await hashPassword(password);

        expect(hash).toBeDefined();
        expect(hash).not.toBe(password);
        expect(hash).toMatch(/^\$2b\$10\$.+/); // Bcrypt pattern
    });

    it('should verify a correct password', async () => {
        const password = 'correct-password';
        const hash = await hashPassword(password);
        const isValid = await comparePassword(password, hash);

        expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
        const password = 'password';
        const hash = await hashPassword(password);
        const isValid = await comparePassword('wrong-password', hash);

        expect(isValid).toBe(false);
    });
});
