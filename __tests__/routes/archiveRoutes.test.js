const request = require('supertest');
const app = require('../../src/server');
const db = require('../../src/config/db');
const RecordingService = require('../../src/services/RecordingService');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({
    query: jest.fn()
}));
jest.mock('../../src/services/RecordingService');

describe('Archive Routes', () => {
    let authToken;

    beforeAll(async () => {
        // We simulate a logged in user
        authToken = jwt.sign({
            user_id: 'member-123',
            role: 'member',
            email: 'member@example.com',
            token_version: 1
        }, process.env.JWT_SECRET || 'test-jwt-secret');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    beforeEach(() => {
        // Mock requireAuth checking token_version
        db.query.mockResolvedValue({
            rows: [{ id: 'member-123', token_version: 1, role: 'member', email: 'member@example.com' }]
        });
    });

    describe('GET /archive', () => {
        it('should redirect to login if not authenticated', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            const res = await request(app).get('/archive');
            process.env.NODE_ENV = originalEnv;
            expect(res.status).toBe(302);
            expect(res.header.location).toBe('/login?redirect=%2Farchive');
        });

        it('should return 200 and call getArchiveList for authenticated member', async () => {
            RecordingService.getArchiveRecordings.mockResolvedValue({
                recordings: [],
                totalCount: 0,
                totalPages: 1,
                currentPage: 1
            });

            const res = await request(app)
                .get('/archive')
                .set('Cookie', [`auth_token=${authToken}`]);
            
            expect(res.status).toBe(200);
            expect(RecordingService.getArchiveRecordings).toHaveBeenCalled();
        });

        it('should pass query parameters to RecordingService.getArchiveRecordings', async () => {
            RecordingService.getArchiveRecordings.mockResolvedValue({
                recordings: [],
                totalCount: 0,
                totalPages: 1,
                currentPage: 1
            });

            const res = await request(app)
                .get('/archive?search=Hanukkah&serviceType=Holiday&torahPortion=Bereshit&page=2')
                .set('Cookie', [`auth_token=${authToken}`]);
            
            expect(res.status).toBe(200);
            expect(RecordingService.getArchiveRecordings).toHaveBeenCalledWith(
                expect.objectContaining({
                    search: 'Hanukkah',
                    serviceType: 'Holiday',
                    torahPortion: 'Bereshit'
                }),
                2,
                20 // default limit
            );
        });

        it('should default to page 1 when page is omitted', async () => {
            RecordingService.getArchiveRecordings.mockResolvedValue({
                recordings: [],
                totalCount: 0,
                totalPages: 1,
                currentPage: 1
            });

            const res = await request(app)
                .get('/archive')
                .set('Cookie', [`auth_token=${authToken}`]);

            expect(res.status).toBe(200);
            expect(RecordingService.getArchiveRecordings).toHaveBeenCalledWith(
                expect.objectContaining({
                    search: '',
                    serviceType: '',
                    torahPortion: '',
                    startDate: '',
                    endDate: ''
                }),
                1,
                20
            );
        });

        it('should return 400 for invalid page value', async () => {
            const res = await request(app)
                .get('/archive?page=0')
                .set('Cookie', [`auth_token=${authToken}`]);

            expect(res.status).toBe(400);
            expect(RecordingService.getArchiveRecordings).not.toHaveBeenCalled();
        });

        it('should return 400 for page value over maximum', async () => {
            const res = await request(app)
                .get('/archive?page=1001')
                .set('Cookie', [`auth_token=${authToken}`]);

            expect(res.status).toBe(400);
            expect(RecordingService.getArchiveRecordings).not.toHaveBeenCalled();
        });

        it('should return 400 for malformed page value with trailing characters', async () => {
            const res = await request(app)
                .get('/archive?page=2abc')
                .set('Cookie', [`auth_token=${authToken}`]);

            expect(res.status).toBe(400);
            expect(RecordingService.getArchiveRecordings).not.toHaveBeenCalled();
        });

        it('should return 400 for duplicate page query parameters', async () => {
            const res = await request(app)
                .get('/archive?page=2&page=3')
                .set('Cookie', [`auth_token=${authToken}`]);

            expect(res.status).toBe(400);
            expect(RecordingService.getArchiveRecordings).not.toHaveBeenCalled();
        });

        it('should return 400 for invalid calendar date', async () => {
            const res = await request(app)
                .get('/archive?startDate=2025-02-30')
                .set('Cookie', [`auth_token=${authToken}`]);

            expect(res.status).toBe(400);
            expect(RecordingService.getArchiveRecordings).not.toHaveBeenCalled();
        });

        it('should return 400 when startDate is after endDate', async () => {
            const res = await request(app)
                .get('/archive?startDate=2025-12-01&endDate=2025-01-01')
                .set('Cookie', [`auth_token=${authToken}`]);

            expect(res.status).toBe(400);
            expect(RecordingService.getArchiveRecordings).not.toHaveBeenCalled();
        });

        it('should ignore non-string query values and still return 200', async () => {
            RecordingService.getArchiveRecordings.mockResolvedValue({
                recordings: [],
                totalCount: 0,
                totalPages: 1,
                currentPage: 1
            });

            const res = await request(app)
                .get('/archive?search=test&search=again&serviceType=Holiday&serviceType=Shabbat')
                .set('Cookie', [`auth_token=${authToken}`]);

            expect(res.status).toBe(200);
            expect(RecordingService.getArchiveRecordings).toHaveBeenCalledWith(
                expect.objectContaining({
                    search: '',
                    serviceType: '',
                    torahPortion: '',
                    startDate: '',
                    endDate: ''
                }),
                1,
                20
            );
        });
    });

    // Story 3.5 honors Story 3.4 deferred items:
    // AC5 (keyboard) and AC7 (responsive) of Story 3.5 depend on the archive
    // surface being keyboard-accessible and responsive, not only the playback
    // page. These tests guard against regressions on the archive index view.
    describe('Archive surface keyboard accessibility (deferred from Story 3.4)', () => {
        const buildRecording = () => ({
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Shabbat Service',
            description: 'desc',
            preview_url: 'https://media.example.com/x.jpg',
            service_date: '2026-01-10T18:00:00Z',
            torah_portion: 'Bereshit',
            service_type: 'Shabbat',
            duration_seconds: 3600,
            first_name: 'Avi',
            last_name: 'Cohen'
        });

        it('renders filter inputs with accessible labels (keyboard + screen reader navigable)', async () => {
            RecordingService.getArchiveRecordings.mockResolvedValue({
                recordings: [],
                totalCount: 0,
                totalPages: 1,
                currentPage: 1
            });

            const res = await request(app)
                .get('/archive')
                .set('Cookie', [`auth_token=${authToken}`]);

            expect(res.status).toBe(200);
            // Native form controls with aria-label are reachable via Tab and announced by AT.
            expect(res.text).toMatch(/<input[^>]*name="search"[^>]*aria-label="Search keywords"/);
            expect(res.text).toMatch(/<select[^>]*name="serviceType"[^>]*aria-label="Service Type"/);
            expect(res.text).toMatch(/<input[^>]*name="torahPortion"[^>]*aria-label="Torah Portion"/);
            expect(res.text).toMatch(/<input[^>]*name="startDate"[^>]*aria-label="Start Date"/);
            expect(res.text).toMatch(/<input[^>]*name="endDate"[^>]*aria-label="End Date"/);
            expect(res.text).toMatch(/<button[^>]*type="submit"[^>]*>\s*Filter\s*<\/button>/);
        });

        it('renders each recording card as a real <a> link (keyboard activatable, no role="button" hacks)', async () => {
            RecordingService.getArchiveRecordings.mockResolvedValue({
                recordings: [buildRecording()],
                totalCount: 1,
                totalPages: 1,
                currentPage: 1
            });

            const res = await request(app)
                .get('/archive')
                .set('Cookie', [`auth_token=${authToken}`]);

            expect(res.status).toBe(200);
            // <a href> is keyboard-activatable by Enter without extra JS or tabindex.
            expect(res.text).toMatch(/<a[^>]*class="recording-card-link"[^>]*href="\/archive\/[^"]+"[^>]*aria-label="Play recording: Shabbat Service"/);
            // Cards must NOT use ad-hoc clickable divs that break keyboard support.
            expect(res.text).not.toMatch(/<div[^>]*onclick=/i);
            expect(res.text).not.toMatch(/<li[^>]*onclick=/i);
        });

        it('loads the responsive recordings stylesheet so layout adapts on small screens', async () => {
            RecordingService.getArchiveRecordings.mockResolvedValue({
                recordings: [],
                totalCount: 0,
                totalPages: 1,
                currentPage: 1
            });

            const res = await request(app)
                .get('/archive')
                .set('Cookie', [`auth_token=${authToken}`]);

            expect(res.status).toBe(200);
            // recordings.css ships the @media (max-width: 600px) rules.
            expect(res.text).toMatch(/<link[^>]+href="\/css\/recordings\.css"/);
            // Viewport meta enables responsive scaling on mobile.
            expect(res.text).toMatch(/<meta[^>]+name="viewport"[^>]+content="[^"]*width=device-width/);
        });
    });
});
