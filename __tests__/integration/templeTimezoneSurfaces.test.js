/**
 * Surface-level coverage for the one temple-timezone formatter.
 * Translates the plan's Acceptance Examples into route assertions: the same
 * stored instant must render the same temple-local clock time everywhere.
 */
const request = require('supertest');
const app = require('../../src/server');
const db = require('../../src/config/db');
const EventService = require('../../src/services/EventService');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/EventService');

const mkToken = (role) => jwt.sign(
    { user_id: `${role}-1`, role, email: `${role}@x.com`, token_version: 1 },
    process.env.JWT_SECRET || 'test-jwt-secret'
);

// A fixed summer instant: 7:00 PM UTC on 2099-07-04 == 2:00 PM CDT (America/Chicago).
const SUMMER_INSTANT = new Date('2099-07-04T19:00:00Z');

describe('temple-timezone formatter across surfaces', () => {
    let adminToken;
    beforeAll(() => { adminToken = mkToken('admin'); });
    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        db.query.mockImplementation((sql, params) => {
            const id = params && params[0];
            const role = String(id || '').startsWith('admin') ? 'admin' : 'member';
            return Promise.resolve({ rows: [{ id, token_version: 1, role, email: `${role}@x.com` }] });
        });
    });

    // AE1 (covers R2, R7, R9): the public calendar and the admin table render the
    // identical local clock time for one instant — not the old UTC vs server-local split.
    it('AE1: public calendar and admin table both show 2:00 PM (Central), not 7:00 PM (UTC)', async () => {
        const event = { id: 1, title: 'Kabbalat Shabbat', date: SUMMER_INSTANT, visibility: 'public', type: 'service' };

        EventService.getEventsInRange.mockResolvedValue([event]);
        const publicRes = await request(app).get('/calendar?month=2099-07');
        expect(publicRes.status).toBe(200);
        expect(publicRes.text).toContain('2:00 PM');
        expect(publicRes.text).not.toContain('7:00 PM');

        EventService.getEvents.mockResolvedValue([event]);
        const adminRes = await request(app).get('/admin/calendar').set('Cookie', [`auth_token=${adminToken}`]);
        expect(adminRes.status).toBe(200);
        expect(adminRes.text).toContain('2:00 PM');
        expect(adminRes.text).not.toContain('7:00 PM');
    });

    // AE2 (covers R8): the popup value is the server-formatted temple datetime and
    // carries the same clock time already shown in the event's grid cell.
    it('AE2: the popup data-when is server-formatted and matches the grid cell time', async () => {
        EventService.getEventsInRange.mockResolvedValue([
            { id: 2, title: 'Study', date: SUMMER_INSTANT, visibility: 'public' }
        ]);
        const res = await request(app).get('/calendar?month=2099-07');
        expect(res.status).toBe(200);
        // Grid cell time-only value.
        expect(res.text).toContain('data-time="2:00 PM"');
        // Popup full value (server-formatted, same clock time as the cell).
        expect(res.text).toContain('data-when="Saturday, July 4, 2099 at 2:00 PM"');
        // The visible <time> in the cell shows the same time.
        expect(res.text).toMatch(/class="calendar-event-time"[^>]*>2:00 PM</);
    });

    // AE4 (covers R13): calendar JSON-LD startDate carries the temple-zone offset for
    // the stored instant (-05:00 in summer), denoting the same instant.
    it('AE4: JSON-LD startDate carries the temple-zone offset', async () => {
        EventService.getEventsInRange.mockResolvedValue([
            { id: 3, title: 'Concert', date: SUMMER_INSTANT, visibility: 'public' }
        ]);
        const res = await request(app).get('/calendar?month=2099-07');
        expect(res.status).toBe(200);
        // JSON-LD startDate uses the temple offset form, not a bare-UTC "Z" instant.
        expect(res.text).toContain('startDate');
        expect(res.text).toContain('2099-07-04T14:00:00-05:00');
    });
});
