const fs = require('fs');
const path = require('path');

describe('status + email_verifications migration (025)', () => {
    const migrationsDir = path.join(__dirname, '../../migrations');
    const contents = fs.readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf8').toLowerCase());

    test('creates the email_verifications table', () => {
        expect(contents.some((c) => c.includes('email_verifications') && c.includes('create table'))).toBe(true);
    });

    test('adds a users.status column defaulting to active (existing users stay active)', () => {
        expect(contents.some((c) => c.includes('add column') && c.includes('status') && c.includes("default 'active'"))).toBe(true);
    });

    test('constrains status to the known lifecycle values', () => {
        expect(contents.some((c) => c.includes('pending_verification') && c.includes('pending_approval') && c.includes('rejected'))).toBe(true);
    });
});
