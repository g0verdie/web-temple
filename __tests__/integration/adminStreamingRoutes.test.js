const request = require('supertest');
const { Roles } = require('../../src/config/roles-permissions');

// Mock Redis to prevent real connections
jest.mock('../../src/config/redis', () => ({
    get: jest.fn().mockResolvedValue(Date.now().toString()),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([])
}));

// Mock Database config
jest.mock('../../src/config/db', () => ({
    query: jest.fn().mockResolvedValue({ rows: [] })
}));

// Mock Services
jest.mock('../../src/services/StreamingService', () => ({
    getScheduledStreams: jest.fn(),
    getScheduledStreamById: jest.fn(),
    createScheduledStream: jest.fn(),
    updateScheduledStream: jest.fn(),
    cancelScheduledStream: jest.fn(),
    activateScheduledStream: jest.fn(),
    completeScheduledStream: jest.fn()
}));

jest.mock('../../src/services/EventService', () => ({
    getEvents: jest.fn().mockResolvedValue([])
}));

// Mock requireAuth to default to admin
jest.mock('../../src/middleware/requireAuth', () => jest.fn((req, res, next) => {
    req.user = { id: 'admin-123', role: 'admin' };
    next();
}));

// Mock sessionTimeout middleware to let tests pass without session logic issues
jest.mock('../../src/middleware/sessionTimeout', () => {
    return jest.fn(() => (req, res, next) => next());
});

const StreamingService = require('../../src/services/StreamingService');
const EventService = require('../../src/services/EventService');
const app = require('../../src/server');

describe('Admin Streaming Routes Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        StreamingService.getScheduledStreams.mockResolvedValue([]);
        EventService.getEvents.mockResolvedValue([]);
    });

    describe('RBAC Protection', () => {
        it('allows access to GET /admin/streaming for Admin role', async () => {
            const res = await request(app).get('/admin/streaming');
            expect(res.statusCode).toBe(200);
            expect(StreamingService.getScheduledStreams).toHaveBeenCalled();
        });

        it('allows access to GET /admin/streaming for Rabbi role', async () => {
            const requireAuth = require('../../src/middleware/requireAuth');
            requireAuth.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'rabbi-1', role: Roles.RABBI };
                next();
            });

            const res = await request(app).get('/admin/streaming');
            expect(res.statusCode).toBe(200);
        });

        it('blocks access to GET /admin/streaming for Social Chair role', async () => {
            const requireAuth = require('../../src/middleware/requireAuth');
            requireAuth.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'social-1', role: Roles.SOCIAL_CHAIR };
                next();
            });

            const res = await request(app).get('/admin/streaming');
            expect(res.statusCode).toBe(403);
        });

        it('blocks access to GET /admin/streaming for Member role', async () => {
            const requireAuth = require('../../src/middleware/requireAuth');
            requireAuth.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'member-1', role: Roles.MEMBER };
                next();
            });

            const res = await request(app).get('/admin/streaming');
            expect(res.statusCode).toBe(403);
        });
    });

    describe('error page payload (Item 10)', () => {
        it('renders a usable 500 page with a real message when the service throws', async () => {
            StreamingService.getScheduledStreams.mockRejectedValueOnce(new Error('db down'));

            const res = await request(app).get('/admin/streaming');

            expect(res.statusCode).toBe(500);
            expect(res.text).toContain('Unable to load livestreams.');
        });
    });

    describe('GET /admin/streaming/new', () => {
        it('renders the creation form with calendar events', async () => {
            const mockEvents = [{ id: 1, title: 'Event 1', date: new Date().toISOString() }];
            EventService.getEvents.mockResolvedValueOnce(mockEvents);

            const res = await request(app).get('/admin/streaming/new');

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Schedule New Live Stream');
            expect(res.text).toContain('Event 1');
            expect(EventService.getEvents).toHaveBeenCalled();
        });
    });

    describe('POST /admin/streaming', () => {
        it('schedules a new stream and redirects to list dashboard on success', async () => {
            StreamingService.createScheduledStream.mockResolvedValueOnce({ id: 1 });

            const res = await request(app)
                .post('/admin/streaming')
                .send({
                    title: 'New Shabbat Service',
                    scheduled_start: '2026-06-01T19:00',
                    facebook_live_url: 'https://www.facebook.com/watch/?v=123',
                    event_id: '1'
                });

            expect(res.statusCode).toBe(302);
            expect(res.headers.location).toContain('/admin/streaming?success=');
            expect(StreamingService.createScheduledStream).toHaveBeenCalledWith({
                title: 'New Shabbat Service',
                scheduled_start: '2026-06-01T19:00',
                facebook_live_url: 'https://www.facebook.com/watch/?v=123',
                event_id: '1'
            }, 'admin-123', expect.any(String));
        });

        it('renders the creation form with errors on service validation failure', async () => {
            StreamingService.createScheduledStream.mockRejectedValueOnce(new Error('Title is required'));
            EventService.getEvents.mockResolvedValueOnce([]);

            const res = await request(app)
                .post('/admin/streaming')
                .send({ title: '' });

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Title is required');
            expect(EventService.getEvents).toHaveBeenCalled();
        });
    });

    describe('GET /admin/streaming/:id/edit', () => {
        it('renders the edit form for an existing stream', async () => {
            const mockStream = {
                id: 45,
                title: 'Existing Stream',
                scheduled_start: new Date().toISOString(),
                facebook_live_url: 'https://www.facebook.com/watch/?v=45',
                event_id: null
            };
            StreamingService.getScheduledStreamById.mockResolvedValueOnce(mockStream);

            const res = await request(app).get('/admin/streaming/45/edit');

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Edit Live Stream Schedule');
            expect(res.text).toContain('Existing Stream');
            expect(StreamingService.getScheduledStreamById).toHaveBeenCalledWith('45');
        });

        it('returns 404 if the stream is not found', async () => {
            StreamingService.getScheduledStreamById.mockResolvedValueOnce(null);

            const res = await request(app).get('/admin/streaming/999/edit');

            expect(res.statusCode).toBe(404);
        });
    });

    describe('POST /admin/streaming/:id', () => {
        it('updates a stream and redirects to list dashboard on success', async () => {
            StreamingService.updateScheduledStream.mockResolvedValueOnce({ id: 45 });

            const res = await request(app)
                .post('/admin/streaming/45')
                .send({
                    title: 'Updated Stream Title',
                    scheduled_start: '2026-06-02T19:00',
                    facebook_live_url: 'https://www.facebook.com/watch/?v=45',
                    event_id: ''
                });

            expect(res.statusCode).toBe(302);
            expect(res.headers.location).toContain('/admin/streaming?success=');
            expect(StreamingService.updateScheduledStream).toHaveBeenCalledWith('45', {
                title: 'Updated Stream Title',
                scheduled_start: '2026-06-02T19:00',
                facebook_live_url: 'https://www.facebook.com/watch/?v=45',
                event_id: ''
            }, 'admin-123', expect.any(String));
        });

        it('renders the edit form with errors on service validation failure', async () => {
            StreamingService.getScheduledStreamById.mockResolvedValueOnce({ id: 45, title: 'Old Title' });
            StreamingService.updateScheduledStream.mockRejectedValueOnce(new Error('Title is required'));

            const res = await request(app)
                .post('/admin/streaming/45')
                .send({ title: '' });

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Title is required');
            expect(StreamingService.getScheduledStreamById).toHaveBeenCalledWith('45');
        });
    });

    describe('POST /admin/streaming/:id/cancel', () => {
        it('cancels the stream and redirects to dashboard', async () => {
            const res = await request(app).post('/admin/streaming/45/cancel');

            expect(res.statusCode).toBe(302);
            expect(res.headers.location).toContain('/admin/streaming?success=');
            expect(StreamingService.cancelScheduledStream).toHaveBeenCalledWith('45', 'admin-123', expect.any(String));
        });
    });

    describe('POST /admin/streaming/:id/start', () => {
        it('starts the stream and redirects to dashboard', async () => {
            const res = await request(app).post('/admin/streaming/45/start');

            expect(res.statusCode).toBe(302);
            expect(res.headers.location).toContain('/admin/streaming?success=');
            expect(StreamingService.activateScheduledStream).toHaveBeenCalledWith('45', 'admin-123', expect.any(String));
        });
    });

    describe('POST /admin/streaming/:id/stop', () => {
        it('completes the stream and redirects to dashboard', async () => {
            const res = await request(app).post('/admin/streaming/45/stop');

            expect(res.statusCode).toBe(302);
            expect(res.headers.location).toContain('/admin/streaming?success=');
            expect(StreamingService.completeScheduledStream).toHaveBeenCalledWith('45', 'admin-123', expect.any(String));
        });
    });
});
