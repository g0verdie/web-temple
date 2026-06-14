const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/RecordingService', () => ({ listPendingRecordings: jest.fn() }));
jest.mock('../../src/services/StreamingService', () => ({ getScheduledStreams: jest.fn() }));

const app = require('../../src/server');
const db = require('../../src/config/db');
const RecordingService = require('../../src/services/RecordingService');
const StreamingService = require('../../src/services/StreamingService');

const adminToken = jwt.sign(
    { user_id: 'admin-1', role: 'admin', email: 'admin-1@x.com', token_version: 1 },
    process.env.JWT_SECRET || 'test-jwt-secret'
);
const cookie = [`auth_token=${adminToken}`];

describe('Admin inline event handlers are externalized (U4)', () => {
    beforeEach(() => {
        db.query.mockResolvedValue({ rows: [{ id: 'admin-1', token_version: 1, role: 'admin', email: 'admin-1@x.com' }] });
    });
    afterEach(() => jest.clearAllMocks());

    test('recordings list: no inline onclick; payload via data-recording + external script', async () => {
        RecordingService.listPendingRecordings.mockResolvedValue([{
            providerName: 'mock', providerRecordingId: 'r1', providerVideoUrl: 'https://v/x',
            previewUrl: '', title: 'Service', serviceDate: new Date('2026-06-01T10:00:00Z'),
            torahPortion: 'Vayikra', durationSeconds: 3600, publishState: 'unpublished', description: ''
        }]);

        const res = await request(app).get('/admin/recordings').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.text).toContain('/js/admin-recordings.js');
        expect(res.text).toContain('js-edit-recording');
        expect(res.text).toContain('data-recording=');
        expect(res.text).not.toContain('onclick=');
    });

    test('streaming index: no inline onsubmit; confirm via data-confirm + external script', async () => {
        StreamingService.getScheduledStreams.mockResolvedValue([{
            id: 1, status: 'scheduled', title: 'Shabbat', facebook_live_url: 'https://facebook.com/x',
            scheduled_start: new Date('2099-01-01T18:00:00Z')
        }]);

        const res = await request(app).get('/admin/streaming').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.text).toContain('/js/admin-streaming.js');
        expect(res.text).toContain('data-confirm=');
        expect(res.text).not.toContain('onsubmit=');
    });
});
