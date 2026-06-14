jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/CacheService', () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../src/services/StreamingService', () => ({
    getScheduledStreams: jest.fn().mockResolvedValue([])
}));
jest.mock('../../src/services/auditService', () => ({
    log: jest.fn().mockResolvedValue(undefined),
    AUDIT_ACTIONS: {
        CALENDAR_EVENT_CREATED: 'CALENDAR_EVENT_CREATED',
        CALENDAR_EVENT_UPDATED: 'CALENDAR_EVENT_UPDATED',
        CALENDAR_EVENT_DELETED: 'CALENDAR_EVENT_DELETED'
    }
}));
jest.mock('../../src/services/emailQueueService', () => ({ enqueueEmail: jest.fn().mockResolvedValue({}) }));

const db = require('../../src/config/db');
const CacheService = require('../../src/services/CacheService');
const StreamingService = require('../../src/services/StreamingService');
const auditService = require('../../src/services/auditService');
const { enqueueEmail } = require('../../src/services/emailQueueService');
const EventService = require('../../src/services/EventService');

const row = (overrides = {}) => ({
    id: 1,
    title: 'Test Event',
    description: 'desc',
    starts_at: new Date('2099-01-01T18:00:00Z'),
    ends_at: null,
    visibility: 'public',
    event_type: 'event',
    location: 'Hall',
    zoom_url: null,
    created_by: 'user-1',
    reminder_sent_at: null,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
});

beforeEach(() => {
    jest.clearAllMocks();
    CacheService.get.mockResolvedValue(null);
    StreamingService.getScheduledStreams.mockResolvedValue([]);
    enqueueEmail.mockResolvedValue({});
});

describe('EventService reads (U1)', () => {
    test('happy: getEventById returns mapped shape with Date and type', async () => {
        db.query.mockResolvedValueOnce({ rows: [row({ event_type: 'service' })] });
        const ev = await EventService.getEventById(1);
        expect(ev.id).toBe(1);
        expect(ev.date).toBeInstanceOf(Date);
        expect(ev.type).toBe('service');
        expect(ev.zoomUrl).toBeNull();
    });

    test('happy: getEvents returns mapped events and caches them', async () => {
        db.query.mockResolvedValueOnce({ rows: [row()] });
        const events = await EventService.getEvents(false);
        expect(events).toHaveLength(1);
        expect(events[0].date).toBeInstanceOf(Date);
        expect(CacheService.set).toHaveBeenCalledWith('event:all:public', expect.any(Array), 300);
    });

    test('edge: public read excludes members-only via SQL predicate', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await EventService.getEvents(false);
        const sql = db.query.mock.calls[0][0];
        expect(sql).toContain("visibility = 'public'");
    });

    test('edge: member read includes members-only (no visibility predicate)', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await EventService.getEvents(true);
        const sql = db.query.mock.calls[0][0];
        expect(sql).not.toContain("visibility = 'public'");
        expect(CacheService.set).toHaveBeenCalledWith('event:all:members', expect.any(Array), 300);
    });

    test('happy: getUpcomingEvents filters future and limits', async () => {
        db.query.mockResolvedValueOnce({
            rows: [
                row({ id: 1, starts_at: new Date('2000-01-01T00:00:00Z') }),
                row({ id: 2, starts_at: new Date('2099-01-01T00:00:00Z') }),
                row({ id: 3, starts_at: new Date('2099-02-01T00:00:00Z') })
            ]
        });
        const upcoming = await EventService.getUpcomingEvents(3);
        expect(upcoming.every(e => e.date > new Date())).toBe(true);
        expect(upcoming.map(e => e.id)).toEqual([2, 3]);
    });

    test('integration: getEvents merges a scheduled stream not linked to a DB event', async () => {
        db.query.mockResolvedValueOnce({ rows: [row()] });
        StreamingService.getScheduledStreams.mockResolvedValueOnce([
            { id: 9, title: 'Live Stream', scheduled_start: new Date('2099-03-01T00:00:00Z'), status: 'scheduled', event_id: null, facebook_live_url: 'https://fb.com/x' }
        ]);
        const events = await EventService.getEvents(false);
        const synth = events.find(e => e.id === 'stream-9');
        expect(synth).toBeTruthy();
        expect(synth.hasLiveStream).toBe(true);
    });

    test('integration: getEvents flags a DB event linked to a stream', async () => {
        db.query.mockResolvedValueOnce({ rows: [row({ id: 5 })] });
        StreamingService.getScheduledStreams.mockResolvedValueOnce([
            { id: 9, title: 'Live', scheduled_start: new Date(), status: 'active', event_id: 5, facebook_live_url: 'https://fb.com/x' }
        ]);
        const events = await EventService.getEvents(false);
        const linked = events.find(e => e.id === 5);
        expect(linked.hasLiveStream).toBe(true);
        expect(linked.facebookLiveUrl).toBe('https://fb.com/x');
    });

    test('edge: getArchivedEvents queries soft-deleted rows', async () => {
        db.query.mockResolvedValueOnce({ rows: [row({ deleted_at: new Date() })] });
        const archived = await EventService.getArchivedEvents();
        expect(archived).toHaveLength(1);
        expect(db.query.mock.calls[0][0]).toContain('deleted_at IS NOT NULL');
    });

    test('edge: getEventsNeedingReminder filters within 24h and not reminded', async () => {
        db.query.mockResolvedValueOnce({ rows: [row()] });
        await EventService.getEventsNeedingReminder();
        const sql = db.query.mock.calls[0][0];
        expect(sql).toContain('reminder_sent_at IS NULL');
        expect(sql).toContain("INTERVAL '24 hours'");
    });
});

describe('EventService writes (U1)', () => {
    test('happy: create inserts, audits, invalidates both cache scopes', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [row({ id: 7 })] }) // INSERT
            .mockResolvedValueOnce({ rows: [] }); // getOptedInMembers
        const created = await EventService.create(
            { title: 'New', starts_at: '2099-01-01T18:00', visibility: 'public', event_type: 'event' },
            'user-1', '127.0.0.1'
        );
        expect(created.id).toBe(7);
        expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CALENDAR_EVENT_CREATED' }));
        expect(CacheService.del).toHaveBeenCalledWith('event:all:public');
        expect(CacheService.del).toHaveBeenCalledWith('event:all:members');
    });

    test('error: create with missing title throws', async () => {
        await expect(EventService.create({ starts_at: '2099-01-01T18:00' })).rejects.toThrow('Title is required');
    });

    test('error: create with bad visibility throws', async () => {
        await expect(EventService.create({ title: 'x', starts_at: '2099-01-01T18:00', visibility: 'secret' }))
            .rejects.toThrow('Invalid visibility');
    });

    test('error: create with ends_at before starts_at throws', async () => {
        await expect(EventService.create({ title: 'x', starts_at: '2099-01-02T18:00', ends_at: '2099-01-01T18:00' }))
            .rejects.toThrow('End date must be after start date');
    });

    test('happy: update captures before/after audit', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [row({ id: 3, title: 'Old' })] }) // SELECT existing
            .mockResolvedValueOnce({ rows: [row({ id: 3, title: 'New' })] }) // UPDATE
            .mockResolvedValueOnce({ rows: [] }); // members
        const updated = await EventService.update(3, { title: 'New', starts_at: '2099-01-01T18:00' }, 'user-1');
        expect(updated.title).toBe('New');
        expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
            action: 'CALENDAR_EVENT_UPDATED',
            before_state: expect.objectContaining({ title: 'Old' })
        }));
    });

    test('error: update missing id throws Event not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await expect(EventService.update(999, { title: 'x', starts_at: '2099-01-01T18:00' })).rejects.toThrow('Event not found');
    });

    test('happy: delete soft-deletes and audits', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [row({ id: 4 })] }) // SELECT existing
            .mockResolvedValueOnce({ rows: [row({ id: 4, deleted_at: new Date() })] }) // UPDATE
            .mockResolvedValueOnce({ rows: [] }); // members
        const result = await EventService.delete(4, 'user-1');
        expect(result).toBe(true);
        expect(db.query.mock.calls[1][0]).toContain('deleted_at = NOW()');
        expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CALENDAR_EVENT_DELETED' }));
    });

    test('error: delete missing id throws Event not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await expect(EventService.delete(999)).rejects.toThrow('Event not found');
    });

    test('happy: restore nulls deleted_at', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [row({ id: 6, deleted_at: new Date() })] }) // SELECT deleted
            .mockResolvedValueOnce({ rows: [row({ id: 6, deleted_at: null })] }); // UPDATE
        const restored = await EventService.restore(6, 'user-1');
        expect(restored.deletedAt).toBeNull();
        expect(db.query.mock.calls[1][0]).toContain('deleted_at = NULL');
    });
});

describe('EventService notifications (U6)', () => {
    test('happy: create enqueues one email per opted-in member', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [row({ id: 1 })] }) // INSERT
            .mockResolvedValueOnce({ rows: [
                { id: 'm1', email: 'a@x.com', first_name: 'A' },
                { id: 'm2', email: 'b@x.com', first_name: 'B' }
            ] }); // members
        await EventService.create({ title: 'New', starts_at: '2099-01-01T18:00' }, 'user-1');
        expect(enqueueEmail).toHaveBeenCalledTimes(2);
        expect(enqueueEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'a@x.com',
            template: 'new-event',
            data: expect.objectContaining({ unsubscribeToken: 'm1' }),
            attachments: expect.any(Array)
        }));
    });

    test('edge: zero opted-in members → no enqueue, no error', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [row({ id: 1 })] })
            .mockResolvedValueOnce({ rows: [] });
        await EventService.create({ title: 'New', starts_at: '2099-01-01T18:00' }, 'user-1');
        expect(enqueueEmail).not.toHaveBeenCalled();
    });

    test('error: enqueue rejection is caught and does not fail the create', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [row({ id: 1 })] })
            .mockResolvedValueOnce({ rows: [{ id: 'm1', email: 'a@x.com', first_name: 'A' }] });
        enqueueEmail.mockRejectedValueOnce(new Error('queue down'));
        await expect(EventService.create({ title: 'New', starts_at: '2099-01-01T18:00' }, 'user-1')).resolves.toBeTruthy();
    });

    test('delete enqueues event-canceled template', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [row({ id: 4 })] })
            .mockResolvedValueOnce({ rows: [row({ id: 4, deleted_at: new Date() })] })
            .mockResolvedValueOnce({ rows: [{ id: 'm1', email: 'a@x.com', first_name: 'A' }] });
        await EventService.delete(4, 'user-1');
        expect(enqueueEmail).toHaveBeenCalledWith(expect.objectContaining({ template: 'event-canceled' }));
    });

    test('getOptedInMembers uses canonical calendar_events key', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await EventService.getOptedInMembers();
        expect(db.query.mock.calls[0][0]).toContain("notification_preferences->>'calendar_events'");
    });
});
