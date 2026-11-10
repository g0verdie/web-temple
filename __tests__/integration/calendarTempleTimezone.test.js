/**
 * The public calendar must reason about "today", the default month, the fetch
 * window, and which grid cell an event sits in using the TEMPLE timezone
 * (America/Chicago by default) — not UTC. Evenings in Chicago are already the
 * next day in UTC, so a UTC implementation marks tomorrow as "today", opens the
 * next month on the last evening of a month, and drops Friday-night services
 * into Saturday's cell.
 */
const request = require('supertest');
const app = require('../../src/server');
const db = require('../../src/config/db');
const EventService = require('../../src/services/EventService');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/EventService');

// Fake only Date so supertest's timers/sockets keep working.
const setClock = (iso) => jest.useFakeTimers({ now: new Date(iso), toFake: ['Date'] });

// The month-grid cell for a given day-of-month, isolated from the agenda copy.
const gridCell = (html, day) => {
    const grid = html.slice(html.indexOf('class="calendar-grid"'), html.indexOf('class="calendar-agenda"'));
    return grid.split('<td class="calendar-cell').find((c) => new RegExp(`calendar-daynum">${day}[ <]`).test(c));
};

describe('Public calendar uses the temple timezone, not UTC', () => {
    beforeEach(() => {
        db.query.mockResolvedValue({ rows: [] });
        EventService.getEventsInRange.mockResolvedValue([]);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('marks Mon Nov 9 as today at 6:11 PM CST, even though it is already Nov 10 in UTC', async () => {
        setClock('2026-11-10T00:11:00Z'); // Mon Nov 9, 18:11 CST
        const res = await request(app).get('/calendar');
        expect(res.status).toBe(200);
        expect(gridCell(res.text, 9)).toContain('calendar-today-tag');
        expect(gridCell(res.text, 10)).not.toContain('calendar-today-tag');
    });

    it('stays on November on the last evening of November (Nov 30, 7 PM CST == Dec 1 UTC)', async () => {
        setClock('2026-12-01T01:00:00Z');
        const res = await request(app).get('/calendar');
        expect(res.text).toContain('November 2026');
        expect(gridCell(res.text, 30)).toContain('calendar-today-tag');
    });

    it('fetches the temple-local month across a DST change (Nov 2026: starts CDT, ends CST)', async () => {
        // DST ends Sun Nov 1, 2026 at 2 AM, so Nov 1 00:00 is still CDT (UTC-5) while
        // Dec 1 00:00 is CST (UTC-6).
        await request(app).get('/calendar?month=2026-11');
        const [start, end] = EventService.getEventsInRange.mock.calls.at(-1);
        expect(start.toISOString()).toBe('2026-11-01T05:00:00.000Z');
        expect(end.toISOString()).toBe('2026-12-01T05:59:59.999Z');
    });

    it('fetches a December window entirely in CST (year rollover)', async () => {
        await request(app).get('/calendar?month=2026-12');
        const [start, end] = EventService.getEventsInRange.mock.calls.at(-1);
        expect(start.toISOString()).toBe('2026-12-01T06:00:00.000Z');
        expect(end.toISOString()).toBe('2027-01-01T05:59:59.999Z');
    });

    it('fetches a DST-month window with CDT offsets (July = UTC-5)', async () => {
        await request(app).get('/calendar?month=2026-07');
        const [start, end] = EventService.getEventsInRange.mock.calls.at(-1);
        expect(start.toISOString()).toBe('2026-07-01T05:00:00.000Z');
        expect(end.toISOString()).toBe('2026-08-01T04:59:59.999Z');
    });

    it('places a Friday 7 PM CST service in Friday\'s cell, not Saturday\'s', async () => {
        // Fri Nov 6, 2026 19:00 CST == Sat Nov 7 01:00 UTC.
        EventService.getEventsInRange.mockResolvedValue([
            { id: 1, title: 'Kabbalat Shabbat', date: new Date('2026-11-07T01:00:00Z'), visibility: 'public', type: 'service' }
        ]);
        const res = await request(app).get('/calendar?month=2026-11');
        expect(gridCell(res.text, 6)).toContain('Kabbalat Shabbat');
        expect(gridCell(res.text, 7)).not.toContain('Kabbalat Shabbat');
    });

    it('places an event on Nov 30 evening in November\'s grid (and it is inside the fetch window)', async () => {
        // Nov 30 19:00 CST == Dec 1 01:00 UTC.
        const date = new Date('2026-12-01T01:00:00Z');
        EventService.getEventsInRange.mockResolvedValue([
            { id: 2, title: 'Month End Study', date, visibility: 'public', type: 'event' }
        ]);
        const res = await request(app).get('/calendar?month=2026-11');
        const [, end] = EventService.getEventsInRange.mock.calls.at(-1);
        expect(date.getTime()).toBeLessThanOrEqual(end.getTime());
        expect(gridCell(res.text, 30)).toContain('Month End Study');
    });
});
