const { submitMessage } = require('../../src/controllers/messageController');
const pool = require('../../src/config/db');
const axios = require('axios');
const emailService = require('../../src/services/emailService');

// Mock dependencies
jest.mock('../../src/config/db');
jest.mock('axios');
jest.mock('../../src/services/emailService');
jest.mock('express-validator', () => ({
    validationResult: jest.fn(() => ({
        isEmpty: jest.fn(() => true),
        array: jest.fn(() => [])
    }))
}));

describe('Message Controller', () => {
    let req, res;

    beforeEach(() => {
        process.env.CAPTCHA_SECRET = 'mock-secret';
        req = {
            body: {
                name: 'John Doe',
                email: 'john@example.com',
                subject: 'Test Subject',
                message: 'This is a test message over 10 chars',
                captchaToken: 'valid-token'
            },
            xhr: true
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        jest.clearAllMocks();
    });

    it('should submit message successfully', async () => {
        // Mock CAPTCHA success
        axios.post.mockResolvedValue({ data: { success: true } });
        // Mock DB insert
        pool.query.mockResolvedValue({ rows: [{ id: '123', created_at: new Date() }] });
        // Mock Email success
        emailService.sendContactNotification.mockResolvedValue({});

        await submitMessage(req, res);

        expect(axios.post).toHaveBeenCalled();
        expect(pool.query).toHaveBeenCalled();
        expect(emailService.sendContactNotification).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return error for invalid CAPTCHA', async () => {
        axios.post.mockResolvedValue({ data: { success: false } });

        await submitMessage(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid CAPTCHA' });
    });

    it('should handle server errors', async () => {
        axios.post.mockResolvedValue({ data: { success: true } });
        pool.query.mockRejectedValue(new Error('DB Error'));

        await submitMessage(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });
});
