const db = require('../../src/config/db');
const CacheService = require('../../src/services/CacheService');
const auditService = require('../../src/services/auditService');

jest.mock('../../src/config/db');
jest.mock('../../src/services/CacheService');
jest.mock('../../src/services/auditService');

describe('StreamingService - Scheduling Logic', () => {
    let StreamingService;

    beforeAll(() => {
        auditService.AUDIT_ACTIONS = {
            STREAM_SCHEDULED: 'STREAM_SCHEDULED',
            STREAM_UPDATED: 'STREAM_UPDATED',
            STREAM_CANCELLED: 'STREAM_CANCELLED',
            STREAM_ACTIVATED: 'STREAM_ACTIVATED',
            STREAM_COMPLETED: 'STREAM_COMPLETED'
        };
        StreamingService = require('../../src/services/StreamingService');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        CacheService.del.mockResolvedValue(true);
        CacheService.get.mockResolvedValue(null);
        CacheService.set.mockResolvedValue(true);
    });

    describe('getScheduledStreams', () => {
        it('fetches scheduled streams from database', async () => {
            const mockStreams = [
                { id: 1, title: 'Friday Shabbat', status: 'scheduled', scheduled_start: new Date() }
            ];
            db.query.mockResolvedValueOnce({ rows: mockStreams });

            const result = await StreamingService.getScheduledStreams();

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM scheduled_streams'), expect.any(Array));
            expect(result).toEqual(mockStreams);
        });

        it('applies filters to query when provided', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            await StreamingService.getScheduledStreams({ status: 'active', futureOnly: true });

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('status = $1 AND scheduled_start >= NOW()'),
                ['active']
            );
        });
    });

    describe('getScheduledStreamById', () => {
        it('returns stream when found', async () => {
            const mockStream = { id: 123, title: 'Shabbat' };
            db.query.mockResolvedValueOnce({ rows: [mockStream] });

            const result = await StreamingService.getScheduledStreamById(123);

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), [123]);
            expect(result).toEqual(mockStream);
        });

        it('returns null when stream not found', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const result = await StreamingService.getScheduledStreamById(999);

            expect(result).toBeNull();
        });
    });

    describe('createScheduledStream', () => {
        it('successfully schedules a new stream and logs audit event', async () => {
            const futureDate = new Date(Date.now() + 86400000); // 1 day in the future
            const mockCreated = {
                id: 1,
                title: ' Shabbat Morning Service ',
                scheduled_start: futureDate,
                facebook_live_url: 'https://www.facebook.com/watch/?v=12345',
                event_id: 12,
                status: 'scheduled'
            };
            db.query.mockResolvedValueOnce({ rows: [mockCreated] });

            const result = await StreamingService.createScheduledStream({
                title: ' Shabbat Morning Service ',
                scheduled_start: futureDate.toISOString(),
                facebook_live_url: 'https://www.facebook.com/watch/?v=12345',
                event_id: '12'
            }, 'user-123', '127.0.0.1');

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO scheduled_streams'),
                ['Shabbat Morning Service', expect.any(Date), 'https://www.facebook.com/watch/?v=12345', 12]
            );
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                user_id: 'user-123',
                action: 'STREAM_SCHEDULED',
                entity_type: 'scheduled_stream',
                entity_id: '1',
                ip_address: '127.0.0.1'
            }));
            expect(CacheService.del).toHaveBeenCalledWith('stream:public-embed');
            expect(CacheService.del).toHaveBeenCalledWith('event:all');
            expect(result).toEqual(mockCreated);
        });

        it('throws error if title is empty or missing', async () => {
            await expect(StreamingService.createScheduledStream({
                title: '',
                scheduled_start: new Date(Date.now() + 86400000).toISOString()
            })).rejects.toThrow('Title is required');

            await expect(StreamingService.createScheduledStream({
                scheduled_start: new Date(Date.now() + 86400000).toISOString()
            })).rejects.toThrow('Title is required');
        });

        it('throws error if title exceeds 255 characters', async () => {
            const longTitle = 'a'.repeat(256);
            await expect(StreamingService.createScheduledStream({
                title: longTitle,
                scheduled_start: new Date(Date.now() + 86400000).toISOString()
            })).rejects.toThrow('Title cannot exceed 255 characters');
        });

        it('throws error if date is invalid', async () => {
            await expect(StreamingService.createScheduledStream({
                title: 'Test Stream',
                scheduled_start: 'not-a-date'
            })).rejects.toThrow('Invalid scheduled start date');
        });

        it('throws error if date is in the past', async () => {
            const pastDate = new Date(Date.now() - 86400000).toISOString();
            await expect(StreamingService.createScheduledStream({
                title: 'Test Stream',
                scheduled_start: pastDate
            })).rejects.toThrow('Scheduled start date must be in the future');
        });

        it('throws error if Facebook Live URL is invalid', async () => {
            await expect(StreamingService.createScheduledStream({
                title: 'Test Stream',
                scheduled_start: new Date(Date.now() + 86400000).toISOString(),
                facebook_live_url: 'https://evilsite.com/video'
            })).rejects.toThrow('Invalid Facebook Live URL');
        });

        it('throws error if event ID is invalid', async () => {
            await expect(StreamingService.createScheduledStream({
                title: 'Test Stream',
                scheduled_start: new Date(Date.now() + 86400000).toISOString(),
                event_id: 'abc'
            })).rejects.toThrow('Invalid event ID');
        });
    });

    describe('updateScheduledStream', () => {
        const futureDate = new Date(Date.now() + 86400000);

        it('successfully updates a scheduled stream', async () => {
            const existingStream = { id: 1, title: 'Old Title', status: 'scheduled', scheduled_start: futureDate };
            const updatedStream = { id: 1, title: 'New Title', status: 'scheduled', scheduled_start: futureDate };

            db.query
                .mockResolvedValueOnce({ rows: [existingStream] }) // getScheduledStreamById
                .mockResolvedValueOnce({ rows: [updatedStream] }); // UPDATE query

            const result = await StreamingService.updateScheduledStream(1, {
                title: 'New Title',
                scheduled_start: futureDate.toISOString()
            }, 'user-1', '127.0.0.1');

            expect(db.query.mock.calls[1][0]).toContain('UPDATE scheduled_streams');
            expect(db.query.mock.calls[1][0]).toContain('SET title = $1');
            expect(db.query.mock.calls[1][1]).toEqual(['New Title', expect.any(Date), null, null, 1]);
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                user_id: 'user-1',
                action: 'STREAM_UPDATED',
                entity_id: '1'
            }));
            expect(result).toEqual(updatedStream);
        });

        it('throws error if stream is completed or canceled', async () => {
            const completedStream = { id: 1, title: 'Old Title', status: 'completed', scheduled_start: futureDate };
            db.query.mockResolvedValueOnce({ rows: [completedStream] });

            await expect(StreamingService.updateScheduledStream(1, {
                title: 'New Title',
                scheduled_start: futureDate.toISOString()
            })).rejects.toThrow('Cannot update a completed stream');
        });
    });

    describe('cancelScheduledStream', () => {
        it('cancels scheduled stream', async () => {
            const existingStream = { id: 1, title: 'Shabbat', status: 'scheduled' };
            const updatedStream = { id: 1, title: 'Shabbat', status: 'canceled' };

            db.query
                .mockResolvedValueOnce({ rows: [existingStream] })
                .mockResolvedValueOnce({ rows: [updatedStream] });

            const result = await StreamingService.cancelScheduledStream(1, 'user-1', '127.0.0.1');

            expect(result.status).toBe('canceled');
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'STREAM_CANCELLED'
            }));
        });

        it('throws error if stream is not scheduled', async () => {
            const activeStream = { id: 1, title: 'Shabbat', status: 'active' };
            db.query.mockResolvedValueOnce({ rows: [activeStream] });

            await expect(StreamingService.cancelScheduledStream(1))
                .rejects.toThrow('Cannot cancel a stream that is active');
        });
    });

    describe('activateScheduledStream', () => {
        it('starts the live stream and stops any currently active stream', async () => {
            const existingStream = { id: 1, title: 'Shabbat', status: 'scheduled', facebook_live_url: 'https://facebook.com/watch/?v=1' };
            const updatedStream = { id: 1, title: 'Shabbat', status: 'active', facebook_live_url: 'https://facebook.com/watch/?v=1' };
            const otherActiveStream = { id: 2, title: 'Old Stream', status: 'active' };

            db.query
                .mockResolvedValueOnce({ rows: [existingStream] }) // getScheduledStreamById
                .mockResolvedValueOnce({ rows: [otherActiveStream] }) // SELECT other active streams
                .mockResolvedValueOnce({ rows: [] }) // UPDATE other active to completed
                .mockResolvedValueOnce({ rows: [updatedStream] }); // UPDATE this stream to active

            const result = await StreamingService.activateScheduledStream(1, 'user-1', '127.0.0.1');

            // The third db.query call should be the UPDATE for other active streams
            expect(db.query.mock.calls[2][0]).toContain("status = 'completed'");
            expect(db.query.mock.calls[2][0]).toContain("WHERE status = 'active'");
            expect(result.status).toBe('active');
            
            // Should log completion of old stream AND activation of new stream
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'STREAM_COMPLETED'
            }));
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'STREAM_ACTIVATED'
            }));
        });

        it('throws error if stream is missing Facebook Live URL', async () => {
            const existingStream = { id: 1, title: 'Shabbat', status: 'scheduled', facebook_live_url: null };
            db.query.mockResolvedValueOnce({ rows: [existingStream] });

            await expect(StreamingService.activateScheduledStream(1))
                .rejects.toThrow('Cannot start a stream without a Facebook Live URL');
        });
    });

    describe('completeScheduledStream', () => {
        it('marks stream as completed', async () => {
            const existingStream = { id: 1, title: 'Shabbat', status: 'active' };
            const updatedStream = { id: 1, title: 'Shabbat', status: 'completed' };

            db.query
                .mockResolvedValueOnce({ rows: [existingStream] })
                .mockResolvedValueOnce({ rows: [updatedStream] });

            const result = await StreamingService.completeScheduledStream(1, 'user-1', '127.0.0.1');

            expect(result.status).toBe('completed');
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'STREAM_COMPLETED'
            }));
        });

        it('throws error if stream is not active', async () => {
            const existingStream = { id: 1, title: 'Shabbat', status: 'scheduled' };
            db.query.mockResolvedValueOnce({ rows: [existingStream] });

            await expect(StreamingService.completeScheduledStream(1))
                .rejects.toThrow('Cannot stop a stream that is scheduled');
        });
    });
});
