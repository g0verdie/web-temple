const request = require('supertest');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));

const app = require('../../src/server');
const db = require('../../src/config/db');

describe('Public stream page (/streams/:id)', () => {
    afterEach(() => jest.clearAllMocks());

    it('renders an active stream with the Facebook embed and a live badge', async () => {
        db.query.mockResolvedValue({ rows: [{
            id: 7,
            title: 'Shabbat Service',
            status: 'active',
            facebook_live_url: 'https://www.facebook.com/share/abc/',
            scheduled_start: '2026-06-20T19:00:00Z'
        }] });
        const res = await request(app).get('/streams/7');
        expect(res.status).toBe(200);
        expect(res.text).toContain('Shabbat Service');
        expect(res.text).toContain('facebook.com/plugins/video.php'); // embed was built
        expect(res.text).toContain('Live now');
        expect(res.text).toContain('Back to Calendar');
    });

    it('renders a scheduled (upcoming) stream without an embed', async () => {
        db.query.mockResolvedValue({ rows: [{
            id: 8,
            title: 'Upcoming Service',
            status: 'scheduled',
            facebook_live_url: null,
            scheduled_start: '2099-01-01T19:00:00Z'
        }] });
        const res = await request(app).get('/streams/8');
        expect(res.status).toBe(200);
        expect(res.text).toContain('Upcoming Service');
        expect(res.text).toContain('Upcoming');
        expect(res.text).not.toContain('plugins/video.php');
    });

    it('returns 404 for a missing stream', async () => {
        db.query.mockResolvedValue({ rows: [] });
        const res = await request(app).get('/streams/999');
        expect(res.status).toBe(404);
    });

    it('returns 404 for a non-numeric id without hitting the DB', async () => {
        const res = await request(app).get('/streams/abc');
        expect(res.status).toBe(404);
        expect(db.query).not.toHaveBeenCalled();
    });
});
