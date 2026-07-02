/**
 * utils/templeTime.js
 *
 * The single source of truth for rendering a stored instant as a user-facing
 * event or stream time. Event/stream columns are TIMESTAMPTZ, so the pg driver
 * hands us absolute-instant Date objects; this module only PROJECTS an instant
 * into the configured temple timezone for display — it never reinterprets naive
 * input (input-side parsing stays in EventService/StreamingService).
 *
 * The zone is an IANA name (not a fixed offset) so CST/CDT is DST-correct via
 * Intl. Read at call time so TEMPLE_TIMEZONE can be overridden per environment.
 */

// Default to the temple's IANA zone; distinct from the fixed-offset
// APP_TIMEZONE_OFFSET used for input parsing.
const templeTimezone = () => process.env.TEMPLE_TIMEZONE || 'America/Chicago';

// Coerce accepted inputs (Date | ISO string | epoch ms) to a valid Date, or null.
const coerceDate = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

// Intl on Node ≥18 can separate time from AM/PM with a narrow no-break space
// (U+202F) depending on the bundled ICU; normalise to a plain space so output is
// stable across ICU versions and clean in HTML/email bodies.
const normalizeSpaces = (str) => str.replace(/[\u202f\u2009\u00a0]/g, ' ');

const format = (value, options) => {
    const d = coerceDate(value);
    if (!d) return '';
    return normalizeSpaces(
        new Intl.DateTimeFormat('en-US', { timeZone: templeTimezone(), ...options }).format(d)
    );
};

/**
 * Full variant: weekday, long date, and time in the temple zone.
 * e.g. "Saturday, July 4, 2026 at 2:00 PM". Returns '' for missing/invalid input.
 */
const formatEventDateTime = (value) => format(value, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
});

/**
 * Time-only variant in the temple zone. e.g. "2:00 PM".
 * Returns '' for missing/invalid input.
 */
const formatEventTime = (value) => format(value, { hour: 'numeric', minute: '2-digit' });

/**
 * ISO-8601 string carrying the temple-zone offset for the stored instant, e.g.
 * "2026-07-04T14:00:00-05:00". Same instant as the input, expressed in temple
 * wall-clock time with the correct DST offset. Returns '' for missing/invalid input.
 */
const toTempleIso = (value) => {
    const d = coerceDate(value);
    if (!d) return '';
    const zone = templeTimezone();

    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(d).reduce((acc, p) => {
        acc[p.type] = p.value;
        return acc;
    }, {});

    // hour12:false uses the h24 cycle on some ICU builds (e.g. Node 18.6), which emits
    // '24' for a temple-local midnight and attaches it to the day that is BEGINNING.
    // Normalise '24'→'00' but KEEP parts.day: that date already names the correct day,
    // so decrementing it (or leaving '24:00', which new Date() reads as the next day)
    // would shift the instant by a full day. See toTempleIso midnight tests.
    const hour = parts.hour === '24' ? '00' : parts.hour;

    // Derive the numeric offset from the same instant/zone ("GMT-05:00" → "-05:00";
    // bare "GMT" for UTC-equivalent zones → "+00:00").
    const gmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
        .formatToParts(d)
        .find((p) => p.type === 'timeZoneName').value;
    const offset = gmt === 'GMT' ? '+00:00' : gmt.replace('GMT', '');

    return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}${offset}`;
};

module.exports = { formatEventDateTime, formatEventTime, toTempleIso };
