const request = require('supertest');
const app = require('../../src/server');
const pool = require('../../src/config/db');
const axios = require('axios');
const emailService = require('../../src/services/emailService');

// Mock external dependencies to avoid actual calls during integration tests
jest.mock('../../src/services/emailService');
jest.mock('axios');

// We need to mock DB query for integration test unless we use a test DB.
// For now, let's mock pool.query if it's imported in controller.
// Since controller imports pool directly, jest.mock('../../src/config/db') above relies on module caching.
// But `app` imports `server` which imports routes which imports controller which imports db.
// We mocked db in the UNIT test file, but here we might want to mock it too or rely on `jest.mock`.
jest.mock('../../src/config/db');

describe('Contact Route Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Setup default DB mock behavior
        pool.query.mockResolvedValue({ rows: [{ id: '123' }] });
        axios.post.mockResolvedValue({ data: { success: true } });
        emailService.sendContactNotification.mockResolvedValue(true);
    });

    describe('GET /contact', () => {
        it('should render contact page', async () => {
            const res = await request(app).get('/contact');
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Contact Us');
            expect(res.text).toContain('<form');
        });
    });

    describe('POST /contact', () => {
        it('should validate missing fields', async () => {
            const res = await request(app)
                .post('/contact')
                .send({ name: '' });

            expect(res.statusCode).toBe(400);
            // Expect validation errors
            expect(res.body.errors).toBeDefined();
        });

        it('should accept valid submission', async () => {
            const res = await request(app)
                .post('/contact')
                .send({
                    name: 'Test',
                    email: 'test@example.com',
                    subject: 'Subject',
                    message: 'Long enough message for validation',
                    captchaToken: 'token'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
        });
    });
});
