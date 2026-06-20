/**
 * controllers/calendarController.js
 * Admin calendar CRUD (gated by MANAGE_CALENDAR) + public/members calendar page.
 * Audit + member notification happen inside EventService (StreamingService convention).
 */

const EventService = require('../services/EventService');
const logger = require('../utils/logger');

const ALLOWED_FLASH_MAX_LENGTH = 200;
const sanitizeFlashMessage = (msg) => {
    if (!msg || typeof msg !== 'string') return null;
    return msg.replace(/<[^>]*>/g, '').slice(0, ALLOWED_FLASH_MAX_LENGTH) || null;
};

const CALENDAR_STYLESHEETS = ['/css/calendar.css'];

// ── Admin handlers ────────────────────────────────────────────────────────────

exports.listEvents = async (req, res) => {
    try {
        const events = await EventService.getEvents(true);
        const activeEvents = events.filter(e => typeof e.id === 'number');
        res.render('layout', {
            title: 'Manage Calendar',
            bodyView: 'admin/calendar/list',
            stylesheets: CALENDAR_STYLESHEETS,
            viewData: {
                events: activeEvents,
                success: sanitizeFlashMessage(req.query.success),
                error: sanitizeFlashMessage(req.query.error)
            }
        });
    } catch (error) {
        logger.error('Error listing calendar events:', error);
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load calendar events.' });
    }
};

exports.renderCreateForm = (req, res) => {
    res.render('layout', {
        title: 'New Event',
        bodyView: 'admin/calendar/new',
        stylesheets: CALENDAR_STYLESHEETS,
        viewData: { errors: null, data: {} }
    });
};

exports.createEvent = async (req, res) => {
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.ip;
    try {
        await EventService.create(req.body, userId, ipAddress);
        res.redirect('/admin/calendar?success=Event+created+successfully');
    } catch (validationError) {
        logger.warn('Calendar event creation rejected', { error: validationError.message });
        res.status(400).render('layout', {
            title: 'New Event',
            bodyView: 'admin/calendar/new',
            stylesheets: CALENDAR_STYLESHEETS,
            viewData: { errors: { general: validationError.message }, data: req.body }
        });
    }
};

exports.renderEditForm = async (req, res) => {
    try {
        const event = await EventService.getEventById(req.params.id);
        if (!event) {
            return res.status(404).render('404', { title: '404 - Event Not Found' });
        }
        res.render('layout', {
            title: 'Edit Event',
            bodyView: 'admin/calendar/edit',
            stylesheets: CALENDAR_STYLESHEETS,
            viewData: { errors: null, event, data: event }
        });
    } catch (error) {
        logger.error('Error rendering edit form:', error);
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load the edit form.' });
    }
};

exports.updateEvent = async (req, res) => {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.ip;
    try {
        await EventService.update(id, req.body, userId, ipAddress);
        res.redirect('/admin/calendar?success=Event+updated+successfully');
    } catch (error) {
        if (error.message === 'Event not found') {
            return res.status(404).render('404', { title: '404 - Event Not Found' });
        }
        logger.warn('Calendar event update rejected', { error: error.message });
        const event = await EventService.getEventById(id).catch(() => null);
        res.status(400).render('layout', {
            title: 'Edit Event',
            bodyView: 'admin/calendar/edit',
            stylesheets: CALENDAR_STYLESHEETS,
            viewData: { errors: { general: error.message }, event, data: { ...req.body, id } }
        });
    }
};

exports.deleteEvent = async (req, res) => {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.ip;
    try {
        await EventService.delete(id, userId, ipAddress);
        res.redirect('/admin/calendar?success=Event+deleted+successfully');
    } catch (error) {
        logger.error('Error deleting calendar event:', error);
        const userMessage = error.message === 'Event not found'
            ? error.message
            : 'An unexpected error occurred. Please try again.';
        res.redirect(`/admin/calendar?error=${encodeURIComponent(userMessage)}`);
    }
};

exports.renderArchive = async (req, res) => {
    try {
        const events = await EventService.getArchivedEvents();
        res.render('layout', {
            title: 'Archived Events',
            bodyView: 'admin/calendar/archive',
            stylesheets: CALENDAR_STYLESHEETS,
            viewData: {
                events,
                success: sanitizeFlashMessage(req.query.success),
                error: sanitizeFlashMessage(req.query.error)
            }
        });
    } catch (error) {
        logger.error('Error listing archived events:', error);
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load archived events.' });
    }
};

exports.restoreEvent = async (req, res) => {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.ip;
    try {
        await EventService.restore(id, userId, ipAddress);
        res.redirect('/admin/calendar/archive?success=Event+restored+successfully');
    } catch (error) {
        logger.error('Error restoring calendar event:', error);
        const userMessage = error.message === 'Event not found'
            ? error.message
            : 'An unexpected error occurred. Please try again.';
        res.redirect(`/admin/calendar/archive?error=${encodeURIComponent(userMessage)}`);
    }
};

// ── Public / members handler (U5) ───────────────────────────────────────────────

// Validate a ?month=YYYY-MM param and return { year, month } (1-based month) or null.
const parseMonthParam = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return null;
    const [year, month] = value.split('-').map(Number);
    if (month < 1 || month > 12) return null;
    // Clamp to a sane range to avoid pathological queries.
    if (year < 2000 || year > 2100) return null;
    return { year, month };
};

exports.getCalendarPage = async (req, res) => {
    try {
        // Reject malformed month params explicitly (mirrors recordingController validation).
        if (req.query.month !== undefined) {
            if (Array.isArray(req.query.month) || parseMonthParam(req.query.month) === null) {
                return res.status(400).render('error', {
                    title: '400 - Invalid Request',
                    message: 'Invalid month (use YYYY-MM)'
                });
            }
        }

        const includeMembersOnly = !!req.user;

        const now = new Date();
        const parsed = parseMonthParam(req.query.month);
        // Anchor on the FIRST of the month (UTC) so the ±month window math below
        // can't overflow on day 29-31 (setUTCMonth rolls overflow days forward).
        const anchor = parsed
            ? new Date(Date.UTC(parsed.year, parsed.month - 1, 1))
            : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

        // Scope the fetched window to the viewed month so prev/next navigation shows
        // that month's events. (The window must track the anchor — a fixed range that
        // ignores the anchor makes every month render the same now-relative slice.)
        const monthStart = new Date(anchor.getTime());
        const monthEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1) - 1); // last ms of the month

        const events = await EventService.getEventsInRange(monthStart, monthEnd, includeMembersOnly);

        // Within the month, split by real "now": an event that already happened is Past,
        // one still to come is Upcoming — correct for whichever month is being viewed
        // (a future month is all-Upcoming, a past month all-Past, this month splits at now).
        const upcoming = events.filter(e => e.date >= now);

        // Build the month grid (weeks × 7 days) for the calendar table view
        // (backlog item 5). UTC throughout, matching the UTC month windowing and
        // month label, so the cells line up with the fetched range.
        const gridYear = anchor.getUTCFullYear();
        const gridMonth = anchor.getUTCMonth();
        const firstWeekday = new Date(Date.UTC(gridYear, gridMonth, 1)).getUTCDay();
        const daysInMonth = new Date(Date.UTC(gridYear, gridMonth + 1, 0)).getUTCDate();
        const eventsByDay = {};
        for (const ev of events) {
            if (!ev.date) continue;
            const day = ev.date.getUTCDate();
            (eventsByDay[day] = eventsByDay[day] || []).push(ev);
        }
        const todayIsThisMonth = now.getUTCFullYear() === gridYear && now.getUTCMonth() === gridMonth;
        const weeks = [];
        let week = new Array(firstWeekday).fill(null);
        for (let day = 1; day <= daysInMonth; day++) {
            week.push({ day, events: eventsByDay[day] || [], isToday: todayIsThisMonth && day === now.getUTCDate() });
            if (week.length === 7) { weeks.push(week); week = []; }
        }
        if (week.length) {
            while (week.length < 7) week.push(null);
            weeks.push(week);
        }
        const weekdays = [
            { short: 'Sun', full: 'Sunday' }, { short: 'Mon', full: 'Monday' },
            { short: 'Tue', full: 'Tuesday' }, { short: 'Wed', full: 'Wednesday' },
            { short: 'Thu', full: 'Thursday' }, { short: 'Fri', full: 'Friday' },
            { short: 'Sat', full: 'Saturday' }
        ];

        // Prev/next month nav targets.
        const prevAnchor = new Date(anchor.getTime());
        prevAnchor.setUTCMonth(prevAnchor.getUTCMonth() - 1);
        const nextAnchor = new Date(anchor.getTime());
        nextAnchor.setUTCMonth(nextAnchor.getUTCMonth() + 1);
        const monthStr = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

        // Event structured data (schema.org) for the upcoming events in view. Passed
        // as a top-level layout render local (U6) — viewData keys never reach <head>.
        const jsonLd = upcoming.length ? {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: upcoming.map((e, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                item: {
                    '@type': 'Event',
                    name: e.title,
                    startDate: e.date instanceof Date ? e.date.toISOString() : undefined,
                    description: e.description || undefined,
                    location: e.location ? { '@type': 'Place', name: e.location } : undefined
                }
            }))
        } : undefined;

        res.render('layout', {
            title: 'Calendar',
            description: 'Upcoming services, holidays, and events at Temple B\'nai Israel in Florence, AL. See what\'s happening in our community.',
            jsonLd,
            bodyView: 'calendar/index',
            stylesheets: CALENDAR_STYLESHEETS,
            viewData: {
                weeks,
                weekdays,
                monthHasEvents: events.length > 0,
                isMember: includeMembersOnly,
                currentMonthLabel: anchor.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
                prevMonth: monthStr(prevAnchor),
                nextMonth: monthStr(nextAnchor)
            }
        });
    } catch (error) {
        logger.error('Error loading calendar page:', error);
        res.status(500).render('error', {
            title: '500 - Server Error',
            message: 'Unable to load the calendar.'
        });
    }
};
