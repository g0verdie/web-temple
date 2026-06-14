const fs = require('fs');
const path = require('path');

describe('member_profiles migration', () => {
    const migrationsDir = path.join(__dirname, '../../migrations');
    const content = fs.readFileSync(
        path.join(migrationsDir, '018_create_member_profiles.sql'),
        'utf8'
    );
    const lower = content.toLowerCase();

    test('creates member_profiles idempotently', () => {
        expect(lower).toContain('create table if not exists member_profiles');
    });

    test('keys on user_id with cascade delete', () => {
        expect(lower).toContain('user_id uuid primary key references users(id) on delete cascade');
    });

    test('opt-in and visibility flags default to false (private by default)', () => {
        for (const col of ['listed', 'show_phone', 'show_email', 'show_household']) {
            const re = new RegExp(`${col}\\s+boolean\\s+not null\\s+default false`, 'i');
            expect(content).toMatch(re);
        }
    });

    test('stores phone and household as encrypted TEXT columns', () => {
        expect(lower).toContain('phone_encrypted text');
        expect(lower).toContain('household_encrypted text');
    });

    test('indexes the listed flag (hot browse/search predicate)', () => {
        expect(lower).toContain('create index if not exists idx_member_profiles_listed on member_profiles(listed)');
    });
});
