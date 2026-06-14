/**
 * services/icalService.js
 * Hand-rolled RFC 5545 VCALENDAR/VEVENT builder (no external dependency).
 * Produces an "Add to Calendar" .ics attachment for a single event.
 */

const PRODID = '-//Temple Bnai Israel//Web Temple Calendar//EN';

/**
 * Format a Date as a UTC iCal timestamp: YYYYMMDDTHHMMSSZ.
 */
const formatUtc = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
};

/**
 * Escape a text value per RFC 5545 (commas, semicolons, backslashes, newlines).
 */
const escapeText = (value) => {
    if (value == null) return '';
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n|\n|\r/g, '\\n');
};

/**
 * Fold a content line to <=75 octets per RFC 5545 (continuation lines start with
 * a single space). Folding on character count is sufficient for our ASCII content.
 */
const foldLine = (line) => {
    if (line.length <= 75) return line;
    const parts = [];
    let remaining = line;
    parts.push(remaining.slice(0, 75));
    remaining = remaining.slice(75);
    while (remaining.length > 74) {
        parts.push(' ' + remaining.slice(0, 74));
        remaining = remaining.slice(74);
    }
    if (remaining.length) parts.push(' ' + remaining);
    return parts.join('\r\n');
};

/**
 * Build an .ics attachment payload for an event.
 * @param {Object} event - mapped event ({ id, title, date (Date), endsAt, description, location, zoomUrl })
 * @returns {{ filename: string, content: string, contentType: string }}
 */
const buildEventIcs = (event) => {
    if (!event || !event.date || isNaN(new Date(event.date).getTime())) {
        throw new Error('Event start date is required to build iCal');
    }

    const start = new Date(event.date);
    // DTEND: explicit end, else default to start + 1 hour (Open Question 3 decision).
    const end = (event.endsAt && !isNaN(new Date(event.endsAt).getTime()))
        ? new Date(event.endsAt)
        : new Date(start.getTime() + 60 * 60 * 1000);

    const host = (() => {
        try {
            if (process.env.APP_BASE_URL) return new URL(process.env.APP_BASE_URL).hostname;
        } catch (e) { /* ignore */ }
        return 'templebnaiisrael.org';
    })();

    const uid = `event-${event.id != null ? event.id : 'new'}@${host}`;
    const location = event.location || event.zoomUrl || '';

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        `PRODID:${PRODID}`,
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatUtc(new Date())}`,
        `DTSTART:${formatUtc(start)}`,
        `DTEND:${formatUtc(end)}`,
        `SUMMARY:${escapeText(event.title)}`
    ];

    if (event.description) {
        lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    if (location) {
        lines.push(`LOCATION:${escapeText(location)}`);
    }
    if (event.zoomUrl) {
        lines.push(`URL:${escapeText(event.zoomUrl)}`);
    }

    lines.push('END:VEVENT', 'END:VCALENDAR');

    const content = lines.map(foldLine).join('\r\n') + '\r\n';

    return {
        filename: `event-${event.id != null ? event.id : 'event'}.ics`,
        content,
        contentType: 'text/calendar'
    };
};

module.exports = {
    buildEventIcs,
    formatUtc,
    escapeText
};
