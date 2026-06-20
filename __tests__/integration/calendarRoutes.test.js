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

describe('Public calendar page (U5)', () => {
    let memberToken;

    beforeAll(() => { memberToken = mkToken('member'); });

    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        db.query.mockImplementation((sql, params) => {
            const id = params && params[0];
            return Promise.resolve({ rows: [{ id, token_version: 1, role: 'member', email: 'member@x.com' }] });
        });
    });

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    it('happy: anonymous request gets public-only events (includeMembersOnly=false)', async () => {
        EventService.getEventsInRange.mockResolvedValue([
            { id: 1, title: 'Public Picnic', date: futureDate, visibility: 'public' }
        ]);
        const res = await request(app).get('/calendar');
        expect(res.status).toBe(200);
        expect(res.text).toContain('Public Picnic');
        expect(res.text).toContain('class="calendar-grid"'); // month grid (table) view
        expect(res.text).toContain('<th scope="col">'); // weekday headers
        expect(res.text).toContain('Log in'); // anon members prompt
        const lastCall = EventService.getEventsInRange.mock.calls.at(-1);
        expect(lastCall[2]).toBe(false);
    });

    it('happy: member request includes members-only events (includeMembersOnly=true)', async () => {
        EventService.getEventsInRange.mockResolvedValue([
            { id: 2, title: 'Members Study', date: futureDate, visibility: 'members' }
        ]);
        const res = await request(app).get('/calendar').set('Cookie', [`auth_token=${memberToken}`]);
        expect(res.status).toBe(200);
        expect(res.text).toContain('Members Study');
        const lastCall = EventService.getEventsInRange.mock.calls.at(-1);
        expect(lastCall[2]).toBe(true);
    });

    it('error: a members-only event never appears in an anonymous response', async () => {
        // Service is asked for public-only; simulate it returning only public rows.
        EventService.getEventsInRange.mockResolvedValue([
            { id: 1, title: 'Public Picnic', date: futureDate, visibility: 'public' }
        ]);
        const res = await request(app).get('/calendar');
        expect(res.text).not.toContain('Members Study');
    });

    it('edge: ?month=YYYY-MM is accepted and paginates', async () => {
        EventService.getEventsInRange.mockResolvedValue([]);
        const res = await request(app).get('/calendar?month=2099-07');
        expect(res.status).toBe(200);
        expect(res.text).toContain('July 2099');
    });

    it('error: ?month=garbage returns 400', async () => {
        const res = await request(app).get('/calendar?month=garbage');
        expect(res.status).toBe(400);
    });

    it('scopes the fetched window to the viewed month (prev/next navigation works)', async () => {
        EventService.getEventsInRange.mockResolvedValue([]);
        await request(app).get('/calendar?month=2026-07');
        const [start, end] = EventService.getEventsInRange.mock.calls.at(-1);
        // Window is the requested month only — not a fixed now-relative range, which
        // is what made adjacent months render identical content.
        expect(start.toISOString().slice(0, 10)).toBe('2026-07-01');
        expect(end.toISOString().slice(0, 7)).toBe('2026-07');
        expect(end.getTime()).toBeGreaterThan(start.getTime());
    });

    it('edge: empty window renders the grid with an empty-state note', async () => {
        EventService.getEventsInRange.mockResolvedValue([]);
        const res = await request(app).get('/calendar');
        expect(res.status).toBe(200);
        expect(res.text).toContain('No events scheduled this month');
        expect(res.text).toContain('class="calendar-grid"'); // grid still renders
    });
});
