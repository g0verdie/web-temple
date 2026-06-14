const { buildEventIcs, formatUtc, escapeText } = require('../../src/services/icalService');

describe('icalService.buildEventIcs', () => {
    const baseEvent = {
        id: 42,
        title: 'Kabbalat Shabbat',
        description: 'Welcoming Shabbat service',
        date: new Date('2026-07-10T19:00:00Z'),
        endsAt: new Date('2026-07-10T20:30:00Z'),
        location: 'Main Sanctuary',
        zoomUrl: 'https://zoom.us/j/123'
    };

    test('happy: produces a valid VCALENDAR/VEVENT with mapped fields', () => {
        const ics = buildEventIcs(baseEvent);
        expect(ics.filename).toBe('event-42.ics');
        expect(ics.contentType).toBe('text/calendar');
        expect(ics.content).toContain('BEGIN:VCALENDAR');
        expect(ics.content).toContain('END:VCALENDAR');
        expect(ics.content).toContain('BEGIN:VEVENT');
        expect(ics.content).toContain('SUMMARY:Kabbalat Shabbat');
        expect(ics.content).toContain('DTSTART:20260710T190000Z');
        expect(ics.content).toContain('DTEND:20260710T203000Z');
        expect(ics.content).toContain('LOCATION:Main Sanctuary');
        expect(ics.content).toContain('UID:event-42@');
    });

    test('edge: no ends_at defaults DTEND to start + 1 hour', () => {
        const ics = buildEventIcs({ ...baseEvent, endsAt: null });
        expect(ics.content).toContain('DTSTART:20260710T190000Z');
        expect(ics.content).toContain('DTEND:20260710T200000Z');
    });

    test('edge: escapes commas, semicolons, and newlines in SUMMARY', () => {
        const ics = buildEventIcs({
            ...baseEvent,
            title: 'Dinner, dance; and a\nfeast'
        });
        expect(ics.content).toContain('SUMMARY:Dinner\\, dance\\; and a\\nfeast');
    });

    test('edge: falls back to zoom_url for LOCATION when no physical location', () => {
        const ics = buildEventIcs({ ...baseEvent, location: null });
        expect(ics.content).toContain('LOCATION:https://zoom.us/j/123');
    });

    test('error: missing start date throws', () => {
        expect(() => buildEventIcs({ id: 1, title: 'x', date: null })).toThrow();
        expect(() => buildEventIcs({ id: 1, title: 'x', date: new Date('nope') })).toThrow();
    });

    test('formatUtc strips separators to YYYYMMDDTHHMMSSZ', () => {
        expect(formatUtc(new Date('2026-01-02T03:04:05Z'))).toBe('20260102T030405Z');
    });

    test('escapeText handles all RFC 5545 special chars', () => {
        expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
        expect(escapeText(null)).toBe('');
    });
});
