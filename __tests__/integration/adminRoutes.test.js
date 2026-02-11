const request = require('supertest');
const fs = require('fs');
const path = require('path');

// No fs mocks!

jest.mock('pg', () => {
    const mPool = {
        query: jest.fn(),
        connect: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
    };
    return { Pool: jest.fn(() => mPool) };
});

const app = require('../../src/server');

describe('Admin Routes Integration', () => {
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, 'backups.log');
    const backupFile = path.join(logDir, 'backups.log.bak');

    // Ensure logs dir exists
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    beforeAll(() => {
        // Backup existing log if any
        if (fs.existsSync(logFile)) {
            fs.renameSync(logFile, backupFile);
        }
    });

    afterAll(() => {
        // Restore backup if any
        if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

        if (fs.existsSync(backupFile)) {
            fs.renameSync(backupFile, logFile);
        }
    });

    it('GET /admin should return dashboard with status', async () => {
        // Write test log
        const logData = '{"timestamp": "2023-01-01T12:00:00Z", "status": "SUCCESS", "message": "Test Backup", "size_bytes": 500}\n';
        fs.writeFileSync(logFile, logData);

        const res = await request(app).get('/admin');

        if (res.statusCode !== 200) {
            console.error('Test Failed Response:', res.text);
        }

        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('Admin Dashboard');
        expect(res.text).toContain('Success');
        expect(res.text).toContain('Last Successful Backup');
        expect(res.text).toContain('Email Queue');
    });

    it('GET /admin should show alert on latest backup failure', async () => {
        // Write success then failure log
        const logData = [
            '{"timestamp": "2023-01-01T12:00:00Z", "status": "SUCCESS", "message": "Old Success", "size_bytes": 500}',
            '{"timestamp": "2023-01-02T12:00:00Z", "status": "ERROR", "message": "Backup Failed", "size_bytes": 0}'
        ].join('\n') + '\n';

        fs.writeFileSync(logFile, logData);

        const res = await request(app).get('/admin');

        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('Backup Failure Detected');
        expect(res.text).toContain('Backup Failed'); // Error message
        // Should still show last success details
        expect(res.text).toContain('Last Successful Backup');
        expect(res.text).toContain('1/1/2023');
    });

    it('GET /admin should handle no backups', async () => {
        // Remove log file
        if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

        const res = await request(app).get('/admin');

        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('No successful backups found');
    });

    it('GET /admin should display email queue stats', async () => {
        const res = await request(app).get('/admin');
        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('Waiting:');
        expect(res.text).toContain('Active:');
        expect(res.text).toContain('Failed:');
    });

    it('POST /admin/email-queue/:id/retry should retry failed job', async () => {
        // Create a job directly in the test queue
        const emailQueueService = require('../../src/services/emailQueueService');
        const job = await emailQueueService.queue.add('email', { to: 'test@example.com' });

        // Retry it using the ID
        const res = await request(app).post(`/admin/email-queue/${job.id}/retry`);

        // Should redirect back to dashboard
        expect(res.statusCode).toBe(302);
        expect(res.header.location).toBe('/admin');
    });
});
