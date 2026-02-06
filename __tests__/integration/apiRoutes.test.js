const request = require('supertest');
const app = require('../../src/server');
const fs = require('fs');
const path = require('path');

jest.mock('pg', () => {
    const mPool = {
        query: jest.fn(),
        connect: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
    };
    return { Pool: jest.fn(() => mPool) };
});

describe('API Admin Routes Integration', () => {
    // Determine log content based on what the API expects (absolute paths or relative fallback)
    // The API implementation uses BACKUP_LOG_FILE env var or defaults to ../../logs/backups.log relative to its file
    // We can set the Env var for testing to be safe

    const testLogFile = path.join(__dirname, 'test_backups.log');

    beforeAll(() => {
        process.env.BACKUP_LOG_FILE = testLogFile;
    });

    afterAll(() => {
        if (fs.existsSync(testLogFile)) fs.unlinkSync(testLogFile);
        delete process.env.BACKUP_LOG_FILE;
    });

    it('GET /api/admin/backups/status should return JSON status', async () => {
        // Write test log
        const logData = '{"timestamp": "2023-01-01T12:00:00Z", "status": "SUCCESS", "message": "API Test Backup", "size_bytes": 1234}\n';
        fs.writeFileSync(testLogFile, logData);

        const res = await request(app).get('/api/admin/backups/status');

        expect(res.statusCode).toBe(200);
        expect(res.type).toBe('application/json');
        expect(res.body.status).toBe('success');
        expect(res.body.lastBackup.message).toBe('API Test Backup');
        expect(res.body.lastBackup.size_bytes).toBe(1234);
    });

    it('GET /api/admin/backups/status should report failure status', async () => {
        const logData = '{"timestamp": "2023-01-02T12:00:00Z", "status": "ERROR", "message": "Failed Backup"}\n';
        fs.writeFileSync(testLogFile, logData);

        const res = await request(app).get('/api/admin/backups/status');

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('error');
        expect(res.body.lastBackup.message).toBe('Failed Backup');
        expect(res.body.lastSuccess).toBeNull();
    });

    it('GET /api/admin/backups/status should handle missing log file', async () => {
        if (fs.existsSync(testLogFile)) fs.unlinkSync(testLogFile);

        const res = await request(app).get('/api/admin/backups/status');

        expect(res.statusCode).toBe(200);
        expect(res.type).toBe('application/json');
        expect(res.body.status).toBe('no-backups'); // or no-success-backups depending on logic path
    });
});
