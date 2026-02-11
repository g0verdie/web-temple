const logger = require('../../src/utils/logger');
const emailService = require('../../src/services/emailService');

// Mock dependencies globally
jest.mock('../../src/utils/logger', () => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
}));

jest.mock('../../src/services/emailService', () => ({
    sendEmail: jest.fn()
}));

const emailQueueService = require('../../src/services/emailQueueService');

describe('emailQueueService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('uses expected retry schedule', () => {
        const schedule = emailQueueService.BACKOFF_SCHEDULE_MS;
        expect(schedule).toEqual([60000, 300000, 900000, 3600000, 21600000]);
        expect(emailQueueService.MAX_ATTEMPTS).toBe(schedule.length);
    });

    test('enqueueEmail requires recipient', async () => {
        await expect(emailQueueService.enqueueEmail({ subject: 'Hi' })).rejects.toThrow('Email recipient is required');
    });

    test('enqueueEmail stores job payload', async () => {
        const job = await emailQueueService.enqueueEmail({
            to: 'test@example.com',
            subject: 'Test Subject',
            text: 'Hello'
        });

        expect(job).toEqual(expect.objectContaining({
            data: expect.objectContaining({
                to: 'test@example.com',
                subject: 'Test Subject',
                text: 'Hello'
            })
        }));
    });

    test('getQueueStats returns counts and failed list', async () => {
        const stats = await emailQueueService.getQueueStats();
        expect(stats).toEqual(expect.objectContaining({
            counts: expect.any(Object),
            failed: expect.any(Array)
        }));
    });

    test('alertAdminFailure sends email on error', async () => {
        emailService.sendEmail.mockResolvedValue(true);
        process.env.ADMIN_EMAIL = 'admin@example.com';

        const job = { id: 'job-fail', attemptsMade: 5, failedReason: 'Test failure' };
        const error = new Error('Test failure');

        const result = await emailQueueService.alertAdminFailure(job, error);

        expect(result).toBe(true);
        expect(emailService.sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'admin@example.com',
                subject: expect.stringContaining('failure')
            })
        );
    });

    test('alertAdminFailure logs error if email fails', async () => {
        emailService.sendEmail.mockRejectedValue(new Error('SMTP Error'));
        process.env.ADMIN_EMAIL = 'admin@example.com';

        const job = { id: 'job-fail-2', attemptsMade: 5 };
        const error = new Error('Original error');

        const result = await emailQueueService.alertAdminFailure(job, error);

        expect(result).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(
            'Failed to send admin alert email',
            expect.any(Object)
        );
    });
});
