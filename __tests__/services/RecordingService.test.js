const db = require('../../src/config/db');
const CacheService = require('../../src/services/CacheService');
const emailQueueService = require('../../src/services/emailQueueService');
const emailTemplateService = require('../../src/services/emailTemplateService');
const auditService = require('../../src/services/auditService');
const { verifyUnsubscribeToken } = require('../../src/utils/unsubscribeToken');

jest.mock('../../src/config/db');
jest.mock('../../src/services/CacheService');
jest.mock('../../src/services/emailQueueService');
jest.mock('../../src/services/emailTemplateService');
jest.mock('../../src/services/auditService');

describe('RecordingService', () => {
    let RecordingService;
    let client;

    beforeAll(() => {
        // Set audit actions before require
        auditService.AUDIT_ACTIONS = {
            RECORDING_PUBLISHED: 'RECORDING_PUBLISHED'
        };
        // Require the service once after all mocks are configured
        RecordingService = require('../../src/services/RecordingService');
    });

    beforeEach(() => {
        jest.clearAllMocks();

        client = {
            query: jest.fn(),
            release: jest.fn()
        };

        // Reset mocks with working defaults
        db.query.mockResolvedValue({ rows: [] });
        db.pool.connect.mockResolvedValue(client);
        
        emailTemplateService.renderTemplate.mockReturnValue({
            subject: 'New recording available',
            html: '<p>new recording</p>',
            text: 'new recording'
        });
        emailQueueService.enqueueEmail.mockResolvedValue({ id: 'job-1' });
        auditService.logAudit.mockResolvedValue(true);
        CacheService.invalidatePattern.mockResolvedValue(true);
    });

    it('lists recent unpublished provider recordings merged with saved drafts', async () => {
        process.env.FACEBOOK_RECENT_RECORDINGS = JSON.stringify([
            {
                providerRecordingId: 'fb-1',
                title: 'Friday Night Service',
                providerVideoUrl: 'https://www.facebook.com/temple/videos/fb-1',
                previewUrl: 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Ftemple%2Fvideos%2Ffb-1',
                recordedAt: '2026-03-22T23:00:00.000Z',
                durationSeconds: 3600
            }
        ]);

        db.query.mockResolvedValueOnce({
            rows: [
                {
                    providerName: 'facebook',
                    providerRecordingId: 'fb-1',
                    title: 'Friday Night Service',
                    serviceDate: '2026-03-22T23:00:00.000Z',
                    torahPortion: 'Vayikra',
                    durationSeconds: 3600,
                    publishState: 'unpublished',
                    description: 'Draft description'
                }
            ]
        });

        const recordings = await RecordingService.listPendingRecordings();

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM recordings'), expect.any(Array));
        expect(recordings).toHaveLength(1);
        expect(recordings[0]).toMatchObject({
            providerRecordingId: 'fb-1',
            providerName: 'facebook',
            title: 'Friday Night Service',
            torahPortion: 'Vayikra',
            publishState: 'unpublished'
        });
    });

    it('saves an unpublished draft with provider metadata and user edits', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 'recording-1',
                provider_name: 'facebook',
                provider_recording_id: 'fb-1',
                title: 'Shabbat Morning Service',
                publish_state: 'unpublished',
                service_date: '2026-03-22T15:00:00.000Z',
                torah_portion: 'Tzav',
                duration_seconds: 4200,
                description: 'Weekly service'
            }]
        });

        const result = await RecordingService.saveDraft({
            providerName: 'facebook',
            providerRecordingId: 'fb-1',
            providerVideoUrl: 'https://www.facebook.com/temple/videos/fb-1',
            previewUrl: 'https://www.facebook.com/plugins/video.php?href=fb-1',
            title: 'Shabbat Morning Service',
            serviceDate: '2026-03-22T15:00:00.000Z',
            torahPortion: 'Tzav',
            durationSeconds: 4200,
            description: 'Weekly service'
        }, 'rabbi-1');

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO recordings'), expect.any(Array));
        expect(result.publishState).toBe('unpublished');
        expect(result.providerRecordingId).toBe('fb-1');
    });

    it('publishes a recording, invalidates archive cache, writes audit data, and queues emails only for enabled users', async () => {
        client.query
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({
                rows: [{
                    id: 'recording-1',
                    provider_name: 'facebook',
                    provider_recording_id: 'fb-1',
                    provider_video_url: 'https://www.facebook.com/temple/videos/fb-1',
                    preview_url: 'https://www.facebook.com/plugins/video.php?href=fb-1',
                    title: 'Shabbat Service',
                    service_date: '2026-03-22T15:00:00.000Z',
                    torah_portion: 'Tzav',
                    duration_seconds: 3600,
                    description: 'Weekly service',
                    publish_state: 'published',
                    published_at: '2026-03-23T12:00:00.000Z'
                }]
            })
            .mockResolvedValueOnce({
                rows: [
                    { id: 'member-1', email: 'member1@example.com', first_name: 'Ari' },
                    { id: 'member-2', email: 'member2@example.com', first_name: 'Noa' }
                ]
            })
            .mockResolvedValueOnce({});

        const published = await RecordingService.publishRecording({
            providerName: 'facebook',
            providerRecordingId: 'fb-1',
            providerVideoUrl: 'https://www.facebook.com/temple/videos/fb-1',
            previewUrl: 'https://www.facebook.com/plugins/video.php?href=fb-1',
            title: 'Shabbat Service',
            serviceDate: '2026-03-22T15:00:00.000Z',
            durationSeconds: 3600,
            torahPortion: 'Tzav',
            description: 'Weekly service'
        }, {
            userId: 'rabbi-1',
            ipAddress: '127.0.0.1'
        });

        expect(client.query).toHaveBeenCalledWith('BEGIN');
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO recordings'), expect.any(Array));
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining('SELECT id, email, first_name'));
        expect(client.query).toHaveBeenCalledWith('COMMIT');
        expect(auditService.logAudit).toHaveBeenCalledWith(expect.objectContaining({
            user_id: 'rabbi-1',
            action: 'RECORDING_PUBLISHED',
            entity_type: 'recording',
            entity_id: 'recording-1'
        }));
        expect(CacheService.invalidatePattern).toHaveBeenCalledWith('recording:*');
        expect(emailTemplateService.renderTemplate).toHaveBeenCalledWith('new-recording-available', expect.objectContaining({
            title: 'Shabbat Service'
        }));
        // Each rendered recording email now carries a signed unsubscribe token
        // (previously absent) that verifies back to the recipient's id.
        const m1Render = emailTemplateService.renderTemplate.mock.calls
            .find(c => c[1] && c[1].memberName === 'Ari')[1];
        expect(m1Render.unsubscribeToken).toBeTruthy();
        expect(verifyUnsubscribeToken(m1Render.unsubscribeToken)).toBe('member-1');
        expect(emailQueueService.enqueueEmail).toHaveBeenCalledTimes(2);
        expect(published.publishState).toBe('published');
        expect(client.release).toHaveBeenCalled();
    });

    it('rolls back publish changes when persistence fails', async () => {
        client.query
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(new Error('insert failed'))
            .mockResolvedValueOnce({});

        await expect(RecordingService.publishRecording({
            providerName: 'facebook',
            providerRecordingId: 'fb-2',
            providerVideoUrl: 'https://www.facebook.com/temple/videos/fb-2',
            title: 'Saturday Service',
            serviceDate: '2026-03-22T15:00:00.000Z',
            durationSeconds: 3600
        }, {
            userId: 'rabbi-1',
            ipAddress: '127.0.0.1'
        })).rejects.toThrow('insert failed');

        expect(client.query).toHaveBeenCalledWith('ROLLBACK');
        expect(client.release).toHaveBeenCalled();
    });

    it('rejects publish when required metadata is missing', async () => {
        await expect(RecordingService.publishRecording({
            providerName: 'facebook',
            providerRecordingId: 'fb-3',
            providerVideoUrl: 'https://www.facebook.com/temple/videos/fb-3',
            title: 'Service without duration',
            serviceDate: '2026-03-22T15:00:00.000Z'
        }, {
            userId: 'rabbi-1',
            ipAddress: '127.0.0.1'
        })).rejects.toThrow('Service date and duration are required');
    });
    describe('getArchiveRecordings', () => {
        it('should correctly query with no filters applying 52-week default', async () => {
            client.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            client.query.mockResolvedValueOnce({ rows: [{ id: 'test-1' }] });

            const result = await RecordingService.getArchiveRecordings({}, 1, 20);

            expect(client.query).toHaveBeenCalledTimes(2);
            // Verify count query bounds
            const countCall = client.query.mock.calls[0];
            expect(countCall[0]).toContain("publish_state = 'published'");
            expect(countCall[0]).toContain("service_date >= NOW() - INTERVAL '52 weeks'");
            
            expect(result.totalCount).toBe(1);
            expect(result.recordings.length).toBe(1);
        });

        it('should correctly query with explicit startDate', async () => {
            client.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            client.query.mockResolvedValueOnce({ rows: [{ id: 'test-1' }] });

            await RecordingService.getArchiveRecordings({ startDate: '2023-01-01' }, 1, 20);

            const countCall = client.query.mock.calls[0];
            expect(countCall[0]).toContain("service_date >= $");
            // should not contain the 52 weeks fallback
            expect(countCall[0]).not.toContain("52 weeks");
            expect(countCall[1]).toContain('2023-01-01');
        });

        it('should include serviceType in where clause', async () => {
            client.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            client.query.mockResolvedValueOnce({ rows: [{ id: 'test-1' }] });

            await RecordingService.getArchiveRecordings({ serviceType: 'Holiday' }, 1, 20);

            const countCall = client.query.mock.calls[0];
            expect(countCall[0]).toContain("service_type = $");
            expect(countCall[1]).toContain('Holiday');
        });
    });

    describe('getPublishedRecordingById (Story 3.5)', () => {
        const VALID_ID = '11111111-1111-4111-8111-111111111111';

        it('returns the recording when found and published', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{
                    id: VALID_ID,
                    title: 'Service',
                    publish_state: 'published',
                    caption_format: 'webvtt'
                }]
            });

            const result = await RecordingService.getPublishedRecordingById(VALID_ID);

            expect(result).not.toBeNull();
            expect(result.id).toBe(VALID_ID);
            // Must filter by publish_state at the SQL level, not in JS.
            const sql = db.query.mock.calls[db.query.mock.calls.length - 1][0];
            expect(sql).toContain("publish_state = 'published'");
            expect(sql).toContain('LIMIT 1');
        });

        it('returns null when no row matches (treats unpublished and missing the same)', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            const result = await RecordingService.getPublishedRecordingById(VALID_ID);
            expect(result).toBeNull();
        });

        it('returns null for malformed UUID without hitting the database', async () => {
            const before = db.query.mock.calls.length;
            const result = await RecordingService.getPublishedRecordingById('not-a-uuid');
            expect(result).toBeNull();
            expect(db.query.mock.calls.length).toBe(before);
        });

        it('returns null for empty / non-string id without hitting the database', async () => {
            const before = db.query.mock.calls.length;
            expect(await RecordingService.getPublishedRecordingById('')).toBeNull();
            expect(await RecordingService.getPublishedRecordingById(null)).toBeNull();
            expect(await RecordingService.getPublishedRecordingById(undefined)).toBeNull();
            expect(await RecordingService.getPublishedRecordingById(123)).toBeNull();
            expect(db.query.mock.calls.length).toBe(before);
        });

        it('propagates unexpected database errors so the caller can render 500', async () => {
            db.query.mockRejectedValueOnce(new Error('db down'));
            await expect(RecordingService.getPublishedRecordingById(VALID_ID))
                .rejects.toThrow('db down');
        });
    });
});