const fs = require('fs');
const path = require('path');

describe('email change requests migration', () => {
    test('creates email_change_requests table', () => {
        const migrationsDir = path.join(__dirname, '../../migrations');
        const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql'));

        const hasEmailChangeRequests = files.some((file) => {
            const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8').toLowerCase();
            return content.includes('email_change_requests') && content.includes('create table');
        });

        expect(hasEmailChangeRequests).toBe(true);
    });
});
