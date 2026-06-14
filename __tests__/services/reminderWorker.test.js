const { runReminderScan, startReminderWorker } = require('../../src/workers/reminderWorker');

const makeEvent = (overrides = {}) => ({
    id: 1,
    title: 'Upcoming Service',
    description: 'desc',
    date: new Date('2099-01-01T18:00:00Z'),
    endsAt: null,
    location: 'Hall',
    zoomUrl: null,
    ...overrides
});

const silentLog = { info: jest.fn(), error: jest.fn() };

describe('reminderWorker.runReminderScan (U10)', () => {
    test('happy: due event enqueues per member and marks reminder sent', async () => {
        const eventService = {
            getEventsNeedingReminder: jest.fn().mockResolvedValue([makeEvent({ id: 5 })]),
            getOptedInMembers: jest.fn().mockResolvedValue([
                { id: 'm1', email: 'a@x.com', first_name: 'A' },
                { id: 'm2', email: 'b@x.com', first_name: 'B' }
            ]),
            markReminderSent: jest.fn().mockResolvedValue(undefined)
        };
        const enqueue = jest.fn().mockResolvedValue({});

        const result = await runReminderScan({ eventService, enqueue, log: silentLog });

        expect(enqueue).toHaveBeenCalledTimes(2);
        expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
            template: 'event-reminder',
            attachments: expect.any(Array)
        }));
        expect(eventService.markReminderSent).toHaveBeenCalledWith(5);
        expect(result).toEqual({ eventsProcessed: 1, emailsQueued: 2 });
    });

    test('edge: no due events → no enqueue, no markReminderSent', async () => {
        const eventService = {
            getEventsNeedingReminder: jest.fn().mockResolvedValue([]),
            getOptedInMembers: jest.fn(),
            markReminderSent: jest.fn()
        };
        const enqueue = jest.fn();
        const result = await runReminderScan({ eventService, enqueue, log: silentLog });
        expect(enqueue).not.toHaveBeenCalled();
        expect(eventService.markReminderSent).not.toHaveBeenCalled();
        expect(result.eventsProcessed).toBe(0);
    });

    test('error: a member enqueue failure does not abort the scan; reminder still marked', async () => {
        const eventService = {
            getEventsNeedingReminder: jest.fn().mockResolvedValue([makeEvent({ id: 8 })]),
            getOptedInMembers: jest.fn().mockResolvedValue([{ id: 'm1', email: 'a@x.com', first_name: 'A' }]),
            markReminderSent: jest.fn().mockResolvedValue(undefined)
        };
        const enqueue = jest.fn().mockRejectedValue(new Error('queue down'));

        await expect(runReminderScan({ eventService, enqueue, log: silentLog })).resolves.toBeTruthy();
        expect(eventService.markReminderSent).toHaveBeenCalledWith(8);
    });

    test('edge: opted-in members lookup failure aborts cleanly without throwing', async () => {
        const eventService = {
            getEventsNeedingReminder: jest.fn().mockResolvedValue([makeEvent()]),
            getOptedInMembers: jest.fn().mockRejectedValue(new Error('db down')),
            markReminderSent: jest.fn()
        };
        const enqueue = jest.fn();
        const result = await runReminderScan({ eventService, enqueue, log: silentLog });
        expect(result.eventsProcessed).toBe(0);
        expect(eventService.markReminderSent).not.toHaveBeenCalled();
    });
});

describe('reminderWorker.startReminderWorker (U10)', () => {
    test('integration: processor runs the scan against the injected queue shim', async () => {
        const eventService = {
            getEventsNeedingReminder: jest.fn().mockResolvedValue([makeEvent({ id: 3 })]),
            getOptedInMembers: jest.fn().mockResolvedValue([{ id: 'm1', email: 'a@x.com', first_name: 'A' }]),
            markReminderSent: jest.fn().mockResolvedValue(undefined)
        };
        const enqueue = jest.fn().mockResolvedValue({});

        let processor;
        const fakeQueue = {
            process: (fn) => { processor = fn; },
            on: () => {},
            add: jest.fn().mockResolvedValue({}),
            close: jest.fn().mockResolvedValue(true)
        };

        const worker = startReminderWorker({ queue: fakeQueue, eventService, enqueue, log: silentLog });
        const result = await processor({ id: 'j1' });

        expect(result).toEqual({ eventsProcessed: 1, emailsQueued: 1 });
        expect(eventService.markReminderSent).toHaveBeenCalledWith(3);

        await worker.stop();
        expect(fakeQueue.close).toHaveBeenCalled();
    });

    test('does not register a repeatable job under NODE_ENV=test', () => {
        const fakeQueue = { process: () => {}, on: () => {}, add: jest.fn(), close: jest.fn() };
        startReminderWorker({ queue: fakeQueue, log: silentLog });
        expect(fakeQueue.add).not.toHaveBeenCalled();
    });
});
