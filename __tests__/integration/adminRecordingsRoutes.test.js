const jwt = require('jsonwebtoken');
const request = require('supertest');

jest.mock('pg', () => {
    const mPool = {
        query: jest.fn(),
        connect: jest.fn(),
        on: jest.fn(),
        end: jest.fn()
    };
    return { Pool: jest.fn(() => mPool) };
});

jest.mock('../../src/config/redis', () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([])
}));

jest.mock('../../src/services/RecordingService', () => ({
    listPendingRecordings: jest.fn(),
    saveDraft: jest.fn(),
    publishRecording: jest.fn()
}));

const { Pool } = require('pg');
const RecordingService = require('../../src/services/RecordingService');
const app = require('../../src/server');

describe('Admin Recordings Routes', () => {
    const pool = new Pool();

    beforeEach(() => {
        jest.clearAllMocks();
        pool.query.mockReset();
        RecordingService.listPendingRecordings.mockResolvedValue([]);
        RecordingService.saveDraft.mockResolvedValue({
            id: 'recording-1',
            providerRecordingId: 'fb-1',
            publishState: 'unpublished'
        });
        RecordingService.publishRecording.mockResolvedValue({
            id: 'recording-1',
            providerRecordingId: 'fb-1',
            publishState: 'published'
        });
    });

    it('renders the admin recordings page for admin users', async () => {
        RecordingService.listPendingRecordings.mockResolvedValue([
            {
                providerName: 'facebook',
                providerRecordingId: 'fb-1',
                title: 'Friday Night Service',
                providerVideoUrl: 'https://www.facebook.com/temple/videos/fb-1',
                previewUrl: 'https://www.facebook.com/plugins/video.php?href=fb-1',
                publishState: 'unpublished'
            }
        ]);

        const response = await request(app).get('/admin/recordings');

        expect(response.statusCode).toBe(200);
        expect(response.text).toContain('Recordings');
        expect(response.text).toContain('Friday Night Service');
        expect(RecordingService.listPendingRecordings).toHaveBeenCalled();
    });

    it('blocks members from the admin recordings page', async () => {
        const token = jwt.sign({ user_id: 'member-1', role: 'member', token_version: 1 }, 'test-jwt-secret');
        pool.query.mockResolvedValueOnce({ rows: [{ token_version: 1, role: 'member', email: 'member@example.com' }] });

        const response = await request(app)
            .get('/admin/recordings')
            .set('Cookie', [`auth_token=${token}`])
            .set('Accept', 'application/json');

        expect(response.statusCode).toBe(403);
    });

    it('saves a draft from the admin workflow', async () => {
        const response = await request(app)
            .post('/admin/recordings/drafts')
            .send({
                providerName: 'facebook',
                providerRecordingId: 'fb-1',
                providerVideoUrl: 'https://www.facebook.com/temple/videos/fb-1',
                title: 'Friday Night Service',
                serviceDate: '2026-03-22T23:00:00.000Z',
                durationSeconds: 3600,
                torahPortion: 'Tzav'
            });

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(RecordingService.saveDraft).toHaveBeenCalledWith(expect.objectContaining({
            providerRecordingId: 'fb-1'
        }), 'admin-001');
    });

    it('rejects invalid draft payloads', async () => {
        const response = await request(app)
            .post('/admin/recordings/drafts')
            .send({
                providerName: 'facebook'
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('providerRecordingId');
    });

    it('publishes a recording and returns success confirmation', async () => {
        const response = await request(app)
            .post('/admin/recordings/facebook/fb-1/publish')
            .send({
                providerVideoUrl: 'https://www.facebook.com/temple/videos/fb-1',
                previewUrl: 'https://www.facebook.com/plugins/video.php?href=fb-1',
                title: 'Friday Night Service',
                serviceDate: '2026-03-22T23:00:00.000Z',
                durationSeconds: 3600,
                torahPortion: 'Tzav'
            });

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('published successfully');
        expect(RecordingService.publishRecording).toHaveBeenCalledWith(expect.objectContaining({
            providerName: 'facebook',
            providerRecordingId: 'fb-1'
        }), expect.objectContaining({
            userId: 'admin-001'
        }));
    });

    it('returns a validation error when publish metadata is incomplete', async () => {
        RecordingService.publishRecording.mockRejectedValueOnce(new Error('Service date and duration are required'));

        const response = await request(app)
            .post('/admin/recordings/facebook/fb-1/publish')
            .send({
                providerVideoUrl: 'https://www.facebook.com/temple/videos/fb-1',
                title: 'Friday Night Service'
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Service date and duration are required');
    });
});