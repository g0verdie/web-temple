/**
 * workers/reminderWorker.js
 * Hourly bull repeatable job that sends one-shot 24h reminders for upcoming events
 * to opted-in members (Story 6.6, KTD8). Mirrors emailQueueWorker's structure and
 * gating. Startup is gated in server.js exactly like startEmailQueueWorker.
 */

const logger = require('../utils/logger');
const EventService = require('../services/EventService');
const { enqueueEmail } = require('../services/emailQueueService');
const { buildEventIcs } = require('../services/icalService');

const REMINDER_QUEUE_NAME = 'reminder-scan';
const REPEAT_EVERY_MS = 3600000; // hourly

const createTestQueue = () => {
    let processor = null;
    return {
        add: async () => ({ id: 'test-job' }),
        process: (fn) => { processor = fn; },
        on: () => {},
        close: async () => true,
        // test helper so reminderWorker.test.js can drive the processor
        __run: async (job = {}) => (processor ? processor(job) : undefined)
    };
};

const createQueue = () => {
    if (process.env.NODE_ENV === 'test') {
        return createTestQueue();
    }
    const Queue = require('bull');
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    return new Queue(REMINDER_QUEUE_NAME, redisUrl);
};

/**
 * Process a single reminder scan: find due events, fan out reminder emails to
 * opted-in members, then mark each event reminded (one-shot guard set immediately
 * after enqueue so an overlapping scan cannot double-fire).
 * @param {Object} deps - injectable dependencies for testing
 */
const runReminderScan = async ({
    eventService = EventService,
    enqueue = enqueueEmail,
    buildIcs = buildEventIcs,
    log = logger
} = {}) => {
    const events = await eventService.getEventsNeedingReminder();
    if (!events.length) {
        return { eventsProcessed: 0, emailsQueued: 0 };
    }

    let members;
    try {
        members = await eventService.getOptedInMembers();
    } catch (error) {
        log.error('Reminder scan failed to load opted-in members', { error: error.message });
        return { eventsProcessed: 0, emailsQueued: 0 };
    }

    let emailsQueued = 0;

    let eventsProcessed = 0;

    for (const event of events) {
        // Claim-then-send: atomically flip reminder_sent_at NULL → NOW() BEFORE the
        // fan-out. If we don't win the claim (an overlapping scan or a job retry got
        // here first), skip — so the whole membership is never reminded twice.
        let claimed = false;
        try {
            claimed = await eventService.markReminderSent(event.id);
        } catch (error) {
            log.error('Reminder scan failed to claim reminder', { error: error.message, eventId: event.id });
        }
        if (!claimed) continue;
        eventsProcessed++;

        let icsAttachment = null;
        try {
            const ics = buildIcs(event);
            icsAttachment = { filename: ics.filename, content: ics.content, contentType: ics.contentType };
        } catch (error) {
            log.error('Reminder scan failed to build iCal attachment', { error: error.message, eventId: event.id });
        }

        for (const member of members) {
            await enqueue({
                to: member.email,
                template: 'event-reminder',
                data: {
                    memberName: member.first_name || 'Member',
                    eventId: event.id,
                    title: event.title,
                    description: event.description,
                    date: event.date,
                    location: event.location,
                    zoomUrl: event.zoomUrl,
                    calendarUrl: process.env.APP_BASE_URL
                        ? `${process.env.APP_BASE_URL}/calendar`
                        : 'http://localhost:3000/calendar',
                    unsubscribeToken: member.id
                },
                attachments: icsAttachment ? [icsAttachment] : undefined,
                priority: 2
            }).then(() => { emailsQueued++; })
                .catch(error => log.error('Reminder scan failed to queue email', {
                    error: error.message,
                    eventId: event.id
                }));
        }
    }

    return { eventsProcessed, emailsQueued };
};

const startReminderWorker = ({
    queue,
    eventService = EventService,
    enqueue = enqueueEmail,
    buildIcs = buildEventIcs,
    log = logger
} = {}) => {
    const workQueue = queue || createQueue();

    workQueue.process(async () => {
        try {
            const result = await runReminderScan({ eventService, enqueue, buildIcs, log });
            log.info('Reminder scan completed', result);
            return result;
        } catch (error) {
            log.error('Reminder scan errored', { error: error.message });
            throw error;
        }
    });

    workQueue.on('failed', (failedJob, error) => {
        log.error(`Reminder scan job ${failedJob?.id} failed`, { error: error?.message });
    });

    // Register the hourly repeatable job (skipped for the test shim).
    if (process.env.NODE_ENV !== 'test') {
        workQueue.add({}, { repeat: { every: REPEAT_EVERY_MS }, removeOnComplete: true, removeOnFail: false })
            .catch(error => log.error('Failed to register reminder repeatable job', { error: error.message }));
    }

    const stop = async () => {
        if (workQueue.close) {
            await workQueue.close();
        }
    };

    return { stop, queue: workQueue };
};

module.exports = {
    startReminderWorker,
    runReminderScan,
    REMINDER_QUEUE_NAME,
    REPEAT_EVERY_MS
};
