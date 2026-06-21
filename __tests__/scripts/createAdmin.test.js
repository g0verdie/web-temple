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
        expect(insert.params).toContain('admin'); // role defaults to 'admin' (now a bound param, not a SQL literal)
        const hashed = insert.params.find((p) => typeof p === 'string' && p.startsWith('$2'));
        expect(hashed).toBeTruthy();
        expect(await bcrypt.compare('s3cret-pass', hashed)).toBe(true);
        // Plaintext password is never passed as a parameter.
        expect(insert.params).not.toContain('s3cret-pass');
    });

    it('exits without inserting when admin credentials are missing', async () => {
        delete process.env.ADMIN_EMAIL;
        delete process.env.ADMIN_PASSWORD;
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
        const { createAdmin } = require('../../scripts/create-admin');
        const client = makeClient();

        await expect(createAdmin({ client })).rejects.toThrow('process.exit');

        expect(exitSpy).toHaveBeenCalledWith(1);
        const insert = client.calls.find((c) => /INSERT INTO users/i.test(c.text));
        expect(insert).toBeFalsy();
        exitSpy.mockRestore();
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

    it('provisions a non-admin role when ADMIN_ROLE is set (item 13)', async () => {
        process.env.ADMIN_EMAIL = 'md@temple.org';
        process.env.ADMIN_PASSWORD = 's3cret-pass';
        process.env.ADMIN_ROLE = 'membership_director';
        const { createAdmin } = require('../../scripts/create-admin');
        const client = makeClient();

        await createAdmin({ client });

        const insert = client.calls.find((c) => /INSERT INTO users/i.test(c.text));
        expect(insert.params).toContain('membership_director');
    });

    it('rejects an invalid ADMIN_ROLE without inserting', async () => {
        process.env.ADMIN_EMAIL = 'x@temple.org';
        process.env.ADMIN_PASSWORD = 's3cret-pass';
        process.env.ADMIN_ROLE = 'superuser';
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
        const { createAdmin } = require('../../scripts/create-admin');
        const client = makeClient();

        await expect(createAdmin({ client })).rejects.toThrow('process.exit');
        expect(exitSpy).toHaveBeenCalledWith(1);
        const insert = client.calls.find((c) => /INSERT INTO users/i.test(c.text));
        expect(insert).toBeFalsy();
        exitSpy.mockRestore();
    });
});
