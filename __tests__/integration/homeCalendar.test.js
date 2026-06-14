const request = require('supertest');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/EventService');
jest.mock('../../src/services/StreamingService');

const EventService = require('../../src/services/EventService');
const StreamingService = require('../../src/services/StreamingService');
const app = require('../../src/server');

describe('Homepage reflects DB-backed events (U2)', () => {
    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        StreamingService.getPublicEmbedMetadata.mockResolvedValue({ status: 'offline', archiveCta: true, message: 'offline' });
    });

    it('renders real (mocked DB) events, not the old static array', async () => {
        const future = new Date(Date.now() + 86400000);
        EventService.getNextService.mockResolvedValue(null);
        EventService.getUpcomingEvents.mockResolvedValue([
            { id: 1, title: 'DB Backed Picnic', date: future, description: 'From the database', type: 'event', location: 'Park' }
        ]);

        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.text).toContain('DB Backed Picnic');
        // The legacy hardcoded array is gone.
        expect(res.text).not.toContain('Tu B\'Shvat Celebration');
        expect(EventService.getUpcomingEvents).toHaveBeenCalledWith(3);
    });

    it('has a live /calendar nav link (no longer a disabled placeholder)', async () => {
        EventService.getNextService.mockResolvedValue(null);
        EventService.getUpcomingEvents.mockResolvedValue([]);
        const res = await request(app).get('/');
        expect(res.text).toContain('href="/calendar"');
        expect(res.text).not.toContain('nav-link disabled');
    });

    it('shows the empty state when there are no future events', async () => {
        EventService.getNextService.mockResolvedValue(null);
        EventService.getUpcomingEvents.mockResolvedValue([]);
        const res = await request(app).get('/');
        expect(res.text).toContain('No upcoming events');
    });
});
