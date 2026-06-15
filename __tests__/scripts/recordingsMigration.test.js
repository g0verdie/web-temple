const fs = require('fs');
const path = require('path');

describe('recordings migration 013', () => {
    const migrationsDir = path.join(__dirname, '../../migrations');
    const file = '013_add_service_type_and_indexes.sql';

    test('does not set NOT NULL on first_name/last_name (those columns live on users, not recordings)', () => {
        // The recordings table (012) has no first_name/last_name columns — rabbi
        // names live on users and are LEFT JOINed at query time. Altering them
        // here breaks a fresh `npm run migrate` at 013.
        const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        expect(content).not.toMatch(/ALTER COLUMN\s+first_name/i);
        expect(content).not.toMatch(/ALTER COLUMN\s+last_name/i);
    });
});
