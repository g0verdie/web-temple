const { createDonation } = require('../../src/controllers/donationController');
const db = require('../../src/config/db');
const { encrypt } = require('../../src/utils/encryptionHelper');
const { logAudit, AUDIT_ACTIONS } = require('../../src/services/auditService');

jest.mock('../../src/config/db');
jest.mock('../../src/utils/encryptionHelper');
jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn(() => Promise.resolve()),
    AUDIT_ACTIONS: {
        DONATION_RECEIVED: 'DONATION_RECEIVED'
    }
}));

describe('Donation Controller', () => {
    let req;
    let res;

    beforeEach(() => {
        req = {
            body: {
                amount_cents: 2500,
                donor_email: 'donor@example.com',
                donation_type: 'one-time',
                currency: 'USD',
                payment_method: 'paypal',
                payment_id: 'PAY-123',
                metadata: { campaign: 'spring' }
            },
            ip: '127.0.0.1'
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        encrypt.mockImplementation((value) => `enc:${value}`);
        db.query.mockResolvedValue({ rows: [{ id: 'donation-1', status: 'completed', created_at: new Date() }] });
        jest.clearAllMocks();
    });

    it('should create a donation and return 201', async () => {
        await createDonation(req, res);

        expect(encrypt).toHaveBeenCalledWith('2500');
        expect(encrypt).toHaveBeenCalledWith('donor@example.com');
        expect(db.query).toHaveBeenCalled();
        expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
            action: AUDIT_ACTIONS.DONATION_RECEIVED,
            entity_type: 'donation'
        }));
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should reject invalid amount', async () => {
        req.body.amount_cents = -5;

        await createDonation(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'amount_cents must be a positive integer' });
    });

    it('should reject missing donation type', async () => {
        delete req.body.donation_type;

        await createDonation(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'amount_cents and donation_type are required' });
    });

    it('should handle database errors', async () => {
        db.query.mockRejectedValue(new Error('DB error'));

        await createDonation(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });
});
