const nodemailer = require('nodemailer');
const emailService = require('../../src/services/emailService');

jest.mock('nodemailer');

describe('emailService', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
        jest.clearAllMocks();
    });

    it('logs and resolves when SMTP is not configured', async () => {
        delete process.env.SMTP_HOST;
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await emailService.sendEmail({
            to: 'test@example.com',
            subject: 'Test',
            text: 'Hello'
        });

        expect(logSpy).toHaveBeenCalled();
        logSpy.mockRestore();
    });

    it('sends email when SMTP is configured', async () => {
        process.env.SMTP_HOST = 'smtp.example.com';
        process.env.SMTP_USER = 'user';
        process.env.SMTP_PASS = 'pass';

        const sendMail = jest.fn().mockResolvedValue({ messageId: 'abc' });
        nodemailer.createTransport.mockReturnValue({ sendMail });

        const info = await emailService.sendEmail({
            to: 'test@example.com',
            subject: 'Test',
            text: 'Hello'
        });

        expect(nodemailer.createTransport).toHaveBeenCalled();
        expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'test@example.com',
            subject: 'Test'
        }));
        expect(info).toEqual(expect.objectContaining({ messageId: 'abc' }));
    });

    it('sendContactNotification builds message', async () => {
        delete process.env.SMTP_HOST;
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await emailService.sendContactNotification({
            name: 'Test User',
            email: 'test@example.com',
            subject: 'Hello',
            message: 'Message body'
        });

        expect(logSpy).toHaveBeenCalled();
        logSpy.mockRestore();
    });
});
