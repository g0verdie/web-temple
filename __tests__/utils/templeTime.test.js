const {
    formatEventDateTime,
    formatEventTime,
    formatEventDay,
    templeDayKey,
    toTempleIso
} = require('../../src/utils/templeTime');

// The one temple-timezone formatter. Stored instants are absolute (TIMESTAMPTZ),
// so every function here only PROJECTS an instant into America/Chicago for display.
describe('templeTime formatter', () => {
    const origTz = process.env.TEMPLE_TIMEZONE;
    afterEach(() => {
        if (origTz === undefined) delete process.env.TEMPLE_TIMEZONE;
        else process.env.TEMPLE_TIMEZONE = origTz;
    });

    describe('formatEventTime (time-only variant)', () => {
        // AE3/AE1: the same instant yields one temple-local time, DST-aware.
        it('renders a summer (CDT) instant in Central time', () => {
            expect(formatEventTime(new Date('2026-07-04T19:00:00Z'))).toBe('2:00 PM');
        });

        it('renders a winter (CST) instant in Central time', () => {
            expect(formatEventTime(new Date('2026-01-15T19:00:00Z'))).toBe('1:00 PM');
        });

        it('accepts an ISO string as well as a Date', () => {
            expect(formatEventTime('2026-07-04T19:00:00Z')).toBe('2:00 PM');
        });

        it('returns empty string for missing or invalid input', () => {
            expect(formatEventTime(null)).toBe('');
            expect(formatEventTime(undefined)).toBe('');
            expect(formatEventTime('not-a-date')).toBe('');
        });
    });

    describe('formatEventDateTime (full variant)', () => {
        it('renders a full weekday/date/time string in Central time (summer)', () => {
            expect(formatEventDateTime(new Date('2026-07-04T19:00:00Z')))
                .toBe('Saturday, July 4, 2026 at 2:00 PM');
        });

        it('projects a winter instant to the correct Central date and time', () => {
            expect(formatEventDateTime(new Date('2026-01-15T19:00:00Z')))
                .toBe('Thursday, January 15, 2026 at 1:00 PM');
        });

        it('returns empty string for missing or invalid input', () => {
            expect(formatEventDateTime(null)).toBe('');
            expect(formatEventDateTime('')).toBe('');
            expect(formatEventDateTime('garbage')).toBe('');
        });
    });

    describe('formatEventDay (date-only variant, agenda headings)', () => {
        it('renders a weekday/date with no time in Central time', () => {
            expect(formatEventDay(new Date('2026-07-04T19:00:00Z'))).toBe('Saturday, July 4, 2026');
        });

        it('projects an instant to the temple-local calendar day (not the UTC day)', () => {
            // 02:00Z on 2026-07-05 == 9:00 PM CDT on July 4 — the temple-local day is the 4th.
            expect(formatEventDay(new Date('2026-07-05T02:00:00Z'))).toBe('Saturday, July 4, 2026');
        });

        it('returns empty string for missing or invalid input', () => {
            expect(formatEventDay(null)).toBe('');
            expect(formatEventDay('nope')).toBe('');
        });
    });

    describe('templeDayKey (temple-local YYYY-MM-DD grouping key)', () => {
        it('keys an instant by its temple-local calendar day', () => {
            expect(templeDayKey(new Date('2026-07-04T19:00:00Z'))).toBe('2026-07-04');
        });

        it('uses the temple-local day, not the UTC day, at the day boundary', () => {
            // 02:00Z July 5 is still July 4 in Central; key must match the heading's day.
            expect(templeDayKey(new Date('2026-07-05T02:00:00Z'))).toBe('2026-07-04');
        });

        it('returns empty string for missing or invalid input', () => {
            expect(templeDayKey(null)).toBe('');
            expect(templeDayKey('nope')).toBe('');
        });
    });

    describe('toTempleIso (offset-carrying ISO-8601)', () => {
        // AE4: startDate carries the temple-zone offset for the stored instant.
        it('emits a -05:00 (CDT) offset for a summer instant', () => {
            expect(toTempleIso(new Date('2026-07-04T19:00:00Z'))).toBe('2026-07-04T14:00:00-05:00');
        });

        it('emits a -06:00 (CST) offset for a winter instant', () => {
            expect(toTempleIso(new Date('2026-01-15T19:00:00Z'))).toBe('2026-01-15T13:00:00-06:00');
        });

        it('returns empty string for missing or invalid input', () => {
            expect(toTempleIso(null)).toBe('');
            expect(toTempleIso('nope')).toBe('');
        });

        // Midnight guard: on ICU builds using the h24 hour cycle (e.g. Node 18.6),
        // formatToParts emits hour '24' for a temple-local midnight and attaches it to
        // the day that is BEGINNING. So normalising '24'→'00' must KEEP that date —
        // decrementing (or leaving '24:00', which new Date() reads as the next day)
        // would shift the instant by a full day. These lock the correct behavior.
        it('normalises a midnight instant to 00:00 on the same temple-local date (CDT)', () => {
            // 05:00Z on 2026-07-05 == 00:00 CDT at the START of July 5.
            const out = toTempleIso(new Date('2026-07-05T05:00:00Z'));
            expect(out).toBe('2026-07-05T00:00:00-05:00');
            expect(new Date(out).toISOString()).toBe('2026-07-05T05:00:00.000Z');
        });

        it('normalises a midnight instant to 00:00 on the same temple-local date (CST)', () => {
            // 06:00Z on 2026-01-15 == 00:00 CST at the START of Jan 15.
            const out = toTempleIso(new Date('2026-01-15T06:00:00Z'));
            expect(out).toBe('2026-01-15T00:00:00-06:00');
            expect(new Date(out).toISOString()).toBe('2026-01-15T06:00:00.000Z');
        });
    });

    // R14: DST-aware across a spring-forward and a fall-back transition.
    describe('DST transitions (R14)', () => {
        it('spring forward 2026-03-08: CST before 2 AM, CDT after', () => {
            // 07:00Z = 1:00 AM CST (-06:00); 08:00Z = 3:00 AM CDT (-05:00)
            expect(toTempleIso(new Date('2026-03-08T07:00:00Z'))).toBe('2026-03-08T01:00:00-06:00');
            expect(toTempleIso(new Date('2026-03-08T08:00:00Z'))).toBe('2026-03-08T03:00:00-05:00');
        });

        it('fall back 2026-11-01: CDT before 2 AM, CST after', () => {
            // 06:00Z = 1:00 AM CDT (-05:00); 07:00Z = 1:00 AM CST (-06:00)
            expect(toTempleIso(new Date('2026-11-01T06:00:00Z'))).toBe('2026-11-01T01:00:00-05:00');
            expect(toTempleIso(new Date('2026-11-01T07:00:00Z'))).toBe('2026-11-01T01:00:00-06:00');
        });
    });

    // R5: configurable via TEMPLE_TIMEZONE, read at call time so tests can override.
    describe('TEMPLE_TIMEZONE configuration', () => {
        it('defaults to America/Chicago when unset', () => {
            delete process.env.TEMPLE_TIMEZONE;
            expect(formatEventTime(new Date('2026-07-04T19:00:00Z'))).toBe('2:00 PM');
        });

        it('honours an overridden IANA zone', () => {
            process.env.TEMPLE_TIMEZONE = 'America/New_York';
            expect(formatEventTime(new Date('2026-07-04T19:00:00Z'))).toBe('3:00 PM');
            expect(toTempleIso(new Date('2026-07-04T19:00:00Z'))).toBe('2026-07-04T15:00:00-04:00');
        });
    });
});
