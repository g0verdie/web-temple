const request = require('supertest');
const db = require('../../src/config/db');
const { encrypt } = require('../../src/utils/encryptionHelper');
const { logAudit } = require('../../src/services/auditService');

// Mock dependencies
jest.mock('../../src/config/db');
jest.mock('../../src/utils/encryptionHelper');
jest.mock('../../src/services/auditService');
jest.mock('../../src/utils/logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    http: jest.fn(),
    stream: { write: jest.fn() }
}));

// Import app AFTER mocks
const app = require('../../src/server');

describe('Integration: Donation API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Setup default mock implementations
        encrypt.mockImplementation(val => `enc:${val}`);
        db.query.mockResolvedValue({
            rows: [{
                id: 'donation-1',
                status: 'completed',
                created_at: new Date().toISOString()
            }]
        });
        logAudit.mockResolvedValue();
    });

    describe('POST /api/donations', () => {
        it('should create a donation successfully', async () => {
            const payload = {
                amount_cents: 5000,
                donation_type: 'one-time',
                donor_email: 'test@example.com',
                currency: 'USD'
            };

            const response = await request(app)
                .post('/api/donations')
                .send(payload)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe('donation-1');

            // Verify DB call
            expect(db.query).toHaveBeenCalledTimes(1);
            const queryArgs = db.query.mock.calls[0];
            expect(queryArgs[0]).toContain('INSERT INTO donations');
            expect(queryArgs[1]).toContain('enc:5000'); // Check encryption
        });

        it('should return 400 for missing required fields', async () => {
            const payload = {
                donor_email: 'test@example.com'
                // amount_cents and donation_type missing
            };

            const response = await request(app)
                .post('/api/donations')
                .send(payload)
                .expect(400);

            expect(response.body.error).toMatch(/custom|required/);
        });

        it('should return 400 for negative amount', async () => {
            const payload = {
                amount_cents: -500,
                donation_type: 'one-time'
            };

            const response = await request(app)
                .post('/api/donations')
                .send(payload)
                .expect(400);

            expect(response.body.error).toContain('positive integer');
        });

        it('should return 400 for amount exceeding limit', async () => {
            const payload = {
                amount_cents: 2000000000, // 2 billion > 1 billion limit
                donation_type: 'one-time'
            };

            const response = await request(app)
                .post('/api/donations')
                .send(payload)
                .expect(400);

            expect(response.body.error).toContain('exceeds maximum limit');
        });

        it('should handle database errors gracefully', async () => {
            db.query.mockRejectedValue(new Error('Connection failed'));

            const payload = {
                amount_cents: 5000,
                donation_type: 'one-time'
            };

            const response = await request(app)
                .post('/api/donations')
                .send(payload)
                .expect(500);

            expect(response.body.error).toBe('Server error');
        });
    });
});
