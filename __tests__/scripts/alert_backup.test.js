const { sendAlert } = require('../../scripts/alert_backup');
const emailService = require('../../src/services/emailService');

jest.mock('../../src/services/emailService');

describe('Backup Alert Script', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.argv = ['node', 'scripts/alert_backup.js']; // Reset args
    });

    test('should send email with correct parameters on failure', async () => {
        // Setup mock
        emailService.sendEmail.mockResolvedValue({ messageId: 'test-id' });

        await sendAlert('logs/test.log', 'Database connection failed');

        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
        const callArgs = emailService.sendEmail.mock.calls[0][0];
        expect(callArgs.to).toBe('admin@temple.org'); // Default or env
        expect(callArgs.subject).toContain('[URGENT] Temple Backup Failed');
        expect(callArgs.html).toContain('Database connection failed');
    });

    test('should handle missing arguments gracefully', async () => {
        emailService.sendEmail.mockResolvedValue({});

        await sendAlert();

        expect(emailService.sendEmail).toHaveBeenCalled();
        const callArgs = emailService.sendEmail.mock.calls[0][0];
        expect(callArgs.html).toContain('Unknown error');
    });
});
