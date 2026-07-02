/**
 * Mobile calendar agenda view (I4).
 * Below a ~700px breakpoint the public calendar renders a chronological,
 * date-grouped agenda list instead of the clipped 7-column month grid. The
 * agenda is built from the same fetched event set as the grid (so the two can't
 * drift) and routes every date/time through the temple-timezone formatter.
 *
 * Translates the plan's Acceptance Examples (AE1..AE4) into route + CSS assertions.
 */
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../src/server');
const db = require('../../src/config/db');
const EventService = require('../../src/services/EventService');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/EventService');

// Isolate the agenda rendering from the trailing grid/modal markup so ordering
// and heading assertions can't be satisfied by the grid's copy of the events.
const agendaSection = (html) => {
    const start = html.indexOf('class="calendar-agenda"');
    const end = html.indexOf('id="calendarEventModal"');
    return html.slice(start, end);
};

describe('Public calendar mobile agenda (I4)', () => {
    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        db.query.mockResolvedValue({ rows: [] });
    });

    // July 2026: the 3rd is a Friday, the 4th a Saturday.
    // Kabbalat Shabbat 6:00 PM CDT (UTC-5) == 23:00 UTC. Morning service 9:00 AM CDT == 14:00 UTC.
    const FRIDAY_KABBALAT = { id: 1, title: 'Kabbalat Shabbat', date: new Date('2026-07-03T23:00:00Z'), visibility: 'public', type: 'service', location: 'Sanctuary' };
    const SATURDAY_MORNING = { id: 2, title: 'Saturday Morning Service', date: new Date('2026-07-04T14:00:00Z'), visibility: 'public', type: 'service' };

    it('AE1: renders a date-grouped agenda with both services in chronological order', async () => {
        // Seed out of order to prove the agenda sorts ascending (R5).
        EventService.getEventsInRange.mockResolvedValue([SATURDAY_MORNING, FRIDAY_KABBALAT]);
        const res = await request(app).get('/calendar?month=2026-07');
        expect(res.status).toBe(200);

        const agenda = agendaSection(res.text);
        // Both services present in full within the agenda (R1, R7).
        expect(agenda).toContain('Kabbalat Shabbat');
        expect(agenda).toContain('Saturday Morning Service');
        // Grouped under their own day headings (R6).
        expect(agenda).toContain('Friday, July 3, 2026');
        expect(agenda).toContain('Saturday, July 4, 2026');
        // Chronological ascending: Friday's group before Saturday's (R5).
        expect(agenda.indexOf('Friday, July 3, 2026')).toBeLessThan(agenda.indexOf('Saturday, July 4, 2026'));
        expect(agenda.indexOf('Kabbalat Shabbat')).toBeLessThan(agenda.indexOf('Saturday Morning Service'));
        // Time + metadata carried on the agenda item (R7).
        expect(agenda).toContain('6:00 PM');
        expect(agenda).toContain('Sanctuary');
    });

    it('R8/R10: the same event yields one grid trigger and one agenda trigger (shared partial, no drift)', async () => {
        EventService.getEventsInRange.mockResolvedValue([FRIDAY_KABBALAT]);
        const res = await request(app).get('/calendar?month=2026-07');
        expect(res.status).toBe(200);
        // Exactly two triggers for one event: the grid cell and the agenda item.
        const triggers = (res.text.match(/class="calendar-event-trigger"/g) || []).length;
        expect(triggers).toBe(2);
        // The agenda trigger reuses the same popup mechanism (aria-haspopup=dialog).
        expect(agendaSection(res.text)).toContain('class="calendar-event-trigger"');
    });

    it('AE3: a 6:00 PM temple-local event renders "6:00 PM" in the agenda in CDT (summer)', async () => {
        EventService.getEventsInRange.mockResolvedValue([FRIDAY_KABBALAT]);
        const res = await request(app).get('/calendar?month=2026-07');
        const agenda = agendaSection(res.text);
        expect(agenda).toContain('6:00 PM');
        // No offset drift: not the bare-UTC 11:00 PM instant.
        expect(agenda).not.toContain('11:00 PM');
    });

    it('AE3: a 6:00 PM temple-local event renders "6:00 PM" in the agenda in CST (winter)', async () => {
        // 6:00 PM CST (UTC-6) on 2026-01-08 == 2026-01-09T00:00:00Z.
        const winterEvent = { id: 3, title: 'Winter Study', date: new Date('2026-01-09T00:00:00Z'), visibility: 'public' };
        EventService.getEventsInRange.mockResolvedValue([winterEvent]);
        const res = await request(app).get('/calendar?month=2026-01');
        const agenda = agendaSection(res.text);
        expect(agenda).toContain('6:00 PM');
        // No offset drift: not the bare-UTC 12:00 AM instant.
        expect(agenda).not.toContain('12:00 AM');
    });

    it('AE4: an empty month shows the agenda empty state, not a blank region', async () => {
        EventService.getEventsInRange.mockResolvedValue([]);
        const res = await request(app).get('/calendar?month=2026-09');
        expect(res.status).toBe(200);
        expect(res.text).toContain('class="calendar-agenda"');
        // Agenda-specific empty state (mirrors the grid's message).
        expect(res.text).toContain('no-events--agenda');
        expect(agendaSection(res.text)).toContain('No events scheduled this month');
    });
});

describe('Calendar agenda responsive switch (R1-R4, CSS)', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../public/css/calendar.css'), 'utf8');

    it('hides the agenda by default so the desktop grid is the sole rendering above the breakpoint', () => {
        const agenda = (css.match(/^\.calendar-agenda\s*\{[^}]*\}/m) || [''])[0];
        expect(agenda).toMatch(/display:\s*none/);
    });

    it('below the ~700px breakpoint hides the grid and shows the agenda (exactly one active)', () => {
        // Grab the small-screen media query block that drives the switch.
        const mq = (css.match(/@media[^{]*max-width:\s*700px[^{]*\{([\s\S]*?\}\s*)\}/m) || [''])[0];
        expect(mq).toMatch(/\.calendar-grid-wrap\s*\{[^}]*display:\s*none/);
        expect(mq).toMatch(/\.calendar-agenda\s*\{[^}]*display:\s*block/);
    });
});
