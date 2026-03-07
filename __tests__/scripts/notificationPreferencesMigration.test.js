const fs = require('fs');
const path = require('path');

describe('notification preferences migration', () => {
    test('adds notification_preferences column to users', () => {
        const migrationsDir = path.join(__dirname, '../../migrations');
        const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql'));

        const hasNotificationPreferences = files.some((file) => {
            const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            return content.includes('notification_preferences') && content.toLowerCase().includes('alter table users');
        });

        expect(hasNotificationPreferences).toBe(true);
    });
});
