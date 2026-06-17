const bcrypt = require('bcrypt');

// Behavior coverage for scripts/create-admin.js. The script historically INSERTed
// columns (username, password, is_active) that do not exist on the users table, so
// it threw on any real DB. These tests pin the schema-correct insert shape (mirrors
// authService.registerUser) via an injected fake pg client — no real DB, no auto-run.

const makeClient = (existing = false) => {
    const calls = [];
    return {
        calls,
        connect: jest.fn().mockResolvedValue(),
        end: jest.fn().mockResolvedValue(),
        query: jest.fn(async (text, params) => {
            calls.push({ text, params });
            if (/SELECT id FROM users/i.test(text)) {
                return { rows: existing ? [{ id: 'existing-id' }] : [] };
            }
            if (/INSERT INTO users/i.test(text)) {
                return { rows: [{ id: 'new-id', email: params[0], role: 'admin' }] };
            }
            return { rows: [] };
        })
    };
};

describe('create-admin script', () => {
    const baseEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...baseEnv };
        jest.resetModules();
        jest.restoreAllMocks();
    });

    it('inserts an admin using only columns that exist in the users schema', async () => {
        process.env.ADMIN_EMAIL = 'rabbi@temple.org';
        process.env.ADMIN_PASSWORD = 's3cret-pass';
        const { createAdmin } = require('../../scripts/create-admin');
        const client = makeClient();

        await createAdmin({ client });

        const insert = client.calls.find((c) => /INSERT INTO users/i.test(c.text));
        expect(insert).toBeTruthy();

        const cols = insert.text.match(/INSERT INTO users \(([^)]*)\)/i)[1]
            .split(',').map((s) => s.trim());
        expect(cols).toContain('email');
        expect(cols).toContain('password_hash');
        expect(cols).toContain('role');
        // The stale, non-existent columns must be gone.
        expect(cols).not.toContain('username');
        expect(cols).not.toContain('is_active');
        expect(cols).not.toContain('password');
    });

    it('stores a bcrypt hash of the password and the admin role', async () => {
        process.env.ADMIN_EMAIL = 'rabbi@temple.org';
        process.env.ADMIN_PASSWORD = 's3cret-pass';
        const { createAdmin } = require('../../scripts/create-admin');
        const client = makeClient();

        await createAdmin({ client });

        const insert = client.calls.find((c) => /INSERT INTO users/i.test(c.text));
        expect(insert.text.toLowerCase()).toContain("'admin'");
        const hashed = insert.params.find((p) => typeof p === 'string' && p.startsWith('$2'));
        expect(hashed).toBeTruthy();
        expect(await bcrypt.compare('s3cret-pass', hashed)).toBe(true);
        // Plaintext password is never passed as a parameter.
        expect(insert.params).not.toContain('s3cret-pass');
    });

    it('does not insert when an admin with that email already exists', async () => {
        process.env.ADMIN_EMAIL = 'exists@temple.org';
        process.env.ADMIN_PASSWORD = 'pw';
        const { createAdmin } = require('../../scripts/create-admin');
        const client = makeClient(true);

        await createAdmin({ client });

        const insert = client.calls.find((c) => /INSERT INTO users/i.test(c.text));
        expect(insert).toBeFalsy();
    });
});
