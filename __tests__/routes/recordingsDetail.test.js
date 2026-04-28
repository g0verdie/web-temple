const request = require('supertest');
const app = require('../../src/server');
const db = require('../../src/config/db');
const RecordingService = require('../../src/services/RecordingService');
const jwt = require('jsonwebtoken');
const logger = require('../../src/utils/logger');

jest.mock('../../src/config/db', () => ({
    query: jest.fn()
}));
jest.mock('../../src/services/RecordingService');

describe('Recording detail route GET /archive/:id (Story 3.5)', () => {
    let authToken;
    const VALID_ID = '11111111-1111-4111-8111-111111111111';
    const OTHER_ID = '22222222-2222-4222-8222-222222222222';

    beforeAll(() => {
        authToken = jwt.sign({
            user_id: 'member-123',
            role: 'member',
            email: 'member@example.com',
            token_version: 1
        }, process.env.JWT_SECRET || 'test-jwt-secret');
    });

    beforeEach(() => {
        db.query.mockResolvedValue({
            rows: [{ id: 'member-123', token_version: 1, role: 'member', email: 'member@example.com' }]
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('redirects unauthenticated users to login', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const res = await request(app).get(`/archive/${VALID_ID}`);
        process.env.NODE_ENV = originalEnv;

        expect(res.status).toBe(302);
        expect(res.header.location).toMatch(/^\/login\?redirect=/);
    });

    it('returns 200 and renders the playback view for a published recording', async () => {
        RecordingService.getPublishedRecordingById.mockResolvedValue({
            id: VALID_ID,
            title: 'Shabbat Service',
            description: 'A meaningful service',
            provider_video_url: 'https://media.example.com/recordings/shabbat.mp4',
            preview_url: 'https://media.example.com/recordings/shabbat.jpg',
            service_date: '2026-01-10T18:00:00Z',
            torah_portion: 'Bereshit',
            service_type: 'Shabbat',
            duration_seconds: 3600,
            publish_state: 'published',
            caption_url: 'https://media.example.com/recordings/shabbat.vtt',
            caption_format: 'webvtt',
            first_name: 'Avi',
            last_name: 'Cohen'
        });

        const res = await request(app)
            .get(`/archive/${VALID_ID}`)
            .set('Cookie', [`auth_token=${authToken}`]);

        expect(res.status).toBe(200);
        expect(RecordingService.getPublishedRecordingById).toHaveBeenCalledWith(VALID_ID);
        expect(res.text).toContain('Shabbat Service');
        // AC1: <video> element rendered
        expect(res.text).toMatch(/<video[\s\S]*controls/);
        expect(res.text).toContain('https://media.example.com/recordings/shabbat.mp4');
        // AC2/AC3: WebVTT track + caption toggle
        expect(res.text).toMatch(/<track[\s\S]*kind="captions"/);
        expect(res.text).toContain('data-captions-toggle');
        // AC4: Playback speed controls present
        expect(res.text).toContain('value="0.5"');
        expect(res.text).toContain('value="1"');
        expect(res.text).toContain('value="1.5"');
        expect(res.text).toContain('value="2"');
        // AC5: Keyboard help block
        expect(res.text).toMatch(/<kbd>Space<\/kbd>/);
        // AC6: ARIA label on player
        expect(res.text).toContain('aria-label="Service recording player"');
    });

    it('renders burned-in caption affordance instead of toggle when caption_format is burned-in', async () => {
        RecordingService.getPublishedRecordingById.mockResolvedValue({
            id: VALID_ID,
            title: 'Holiday Service',
            provider_video_url: 'https://media.example.com/recordings/holiday.mp4',
            duration_seconds: 1800,
            publish_state: 'published',
            caption_format: 'burned-in',
            caption_url: null
        });

        const res = await request(app)
            .get(`/archive/${VALID_ID}`)
            .set('Cookie', [`auth_token=${authToken}`]);

        expect(res.status).toBe(200);
        expect(res.text).not.toMatch(/<track[\s\S]*kind="captions"/);
        expect(res.text).not.toContain('data-captions-toggle');
        expect(res.text).toContain('Captions are burned into the video');
    });

    it('returns 404 (not 403) for an unpublished recording id', async () => {
        // Service treats not-published as not-found to avoid leaking draft existence.
        RecordingService.getPublishedRecordingById.mockResolvedValue(null);

        const res = await request(app)
            .get(`/archive/${OTHER_ID}`)
            .set('Cookie', [`auth_token=${authToken}`]);

        expect(res.status).toBe(404);
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(200);
    });

    it('returns 404 for a non-existent recording id', async () => {
        RecordingService.getPublishedRecordingById.mockResolvedValue(null);

        const res = await request(app)
            .get(`/archive/${OTHER_ID}`)
            .set('Cookie', [`auth_token=${authToken}`]);

        expect(res.status).toBe(404);
    });

    it('renders a graceful unavailable state when provider_video_url is missing', async () => {
        RecordingService.getPublishedRecordingById.mockResolvedValue({
            id: VALID_ID,
            title: 'Service Without Source',
            provider_video_url: null,
            duration_seconds: 0,
            publish_state: 'published',
            caption_format: 'burned-in'
        });

        const res = await request(app)
            .get(`/archive/${VALID_ID}`)
            .set('Cookie', [`auth_token=${authToken}`]);

        expect(res.status).toBe(200);
        expect(res.text).toContain('Playback unavailable');
        expect(res.text).not.toMatch(/<video/);
    });

    it('returns 500 when the service throws an unexpected error', async () => {
        jest.spyOn(logger, 'error').mockImplementation(() => {});
        RecordingService.getPublishedRecordingById.mockRejectedValue(new Error('boom'));

        const res = await request(app)
            .get(`/archive/${VALID_ID}`)
            .set('Cookie', [`auth_token=${authToken}`]);

        expect(res.status).toBe(500);
    });

    it('CSP header on the playback route allows https media and connect sources', async () => {
        RecordingService.getPublishedRecordingById.mockResolvedValue({
            id: VALID_ID,
            title: 'CSP Check',
            provider_video_url: 'https://media.example.com/x.mp4',
            duration_seconds: 600,
            publish_state: 'published',
            caption_format: 'burned-in'
        });

        const res = await request(app)
            .get(`/archive/${VALID_ID}`)
            .set('Cookie', [`auth_token=${authToken}`]);

        const csp = res.headers['content-security-policy'] || '';
        expect(csp).toContain("media-src 'self' https:");
        expect(csp).toMatch(/connect-src[^;]*https:/);
        // Sanity: frame-src still scoped to known origins (no broad wildcard like https: alone).
        expect(csp).toMatch(/frame-src[^;]*https:\/\/www\.facebook\.com/);
        expect(csp).not.toMatch(/frame-src[^;]*\bhttps:(?!\/\/)/);
    });
});
