/**
 * WG-A regression tests for the "genuinely live" definition (items 1 & 2).
 *
 * The homepage "LIVE NOW" banner and the live-chat panel are both gated on
 * StreamingService.getPublicEmbedMetadata() returning status:'live' with an id.
 * Before this change, status:'live' fired for ANY status='active' row with a
 * syntactically-valid Facebook URL — so a forgotten/dead "active" stream showed
 * LIVE NOW with an open chat indefinitely. The fix requires the row to also have
 * live_started_at within STREAM_MAX_LIVE_HOURS (auto-expiry safety net), and
 * activateScheduledStream stamps live_started_at = NOW().
 *
 * These tests mock the DB (the env-var path is covered by StreamingService.test.js).
 */

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../../src/services/CacheService', () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../src/services/auditService', () => ({
    log: jest.fn().mockResolvedValue(undefined),
    AUDIT_ACTIONS: { STREAM_ACTIVATED: 'STREAM_ACTIVATED', STREAM_COMPLETED: 'STREAM_COMPLETED' }
}));

const db = require('../../src/config/db');
const StreamingService = require('../../src/services/StreamingService');

const VALID_URL = 'https://www.facebook.com/temple/videos/123';

beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.STREAM_MAX_LIVE_HOURS;
    delete process.env.FACEBOOK_LIVE_IS_ACTIVE;
    delete process.env.STREAM_PROVIDER_UNAVAILABLE;
});

describe('getPublicEmbedMetadata live window (items 1 & 2)', () => {
    it('returns live for an active stream the DB window query returns, and asks for that window', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{ id: 7, status: 'active', facebook_live_url: VALID_URL, title: 'Shabbat', live_started_at: new Date() }]
        });

        const meta = await StreamingService.getPublicEmbedMetadata();

        expect(meta.status).toBe('live');
        expect(meta.statusLabel).toBe('LIVE NOW');
        expect(meta.id).toBe(7);
        expect(meta.embedUrl).toContain('facebook.com');

        // The active-stream query MUST carry the live_started_at window + hours param,
        // or the auto-expiry safety net is gone and the reported bug returns.
        const [sql, params] = db.query.mock.calls[0];
        expect(sql).toMatch(/live_started_at IS NOT NULL/);
        expect(sql).toMatch(/live_started_at > NOW\(\)/);
        expect(params).toEqual([4]); // default STREAM_MAX_LIVE_HOURS
    });

    it('is offline when the window query returns no row (stale/expired active stream filtered out)', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [] })  // active+in-window query: nothing
            .mockResolvedValueOnce({ rows: [] }); // upcoming query: nothing

        const meta = await StreamingService.getPublicEmbedMetadata();

        expect(meta.status).toBe('offline');
        expect(meta.embedUrl).toBeNull();
    });

    it('honors STREAM_MAX_LIVE_HOURS as the window size', async () => {
        process.env.STREAM_MAX_LIVE_HOURS = '2';
        db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

        await StreamingService.getPublicEmbedMetadata();

        expect(db.query.mock.calls[0][1]).toEqual([2]);
    });
});

describe('activateScheduledStream stamps the go-live time', () => {
    it("sets live_started_at = NOW() when an admin takes a stream live", async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 9, status: 'scheduled', facebook_live_url: VALID_URL, title: 'X' }] }) // getScheduledStreamById
            .mockResolvedValueOnce({ rows: [] })  // SELECT other active streams to auto-complete
            .mockResolvedValueOnce({ rows: [{ id: 9, status: 'active', facebook_live_url: VALID_URL, title: 'X' }] }); // UPDATE ... RETURNING

        await StreamingService.activateScheduledStream(9, 1, '127.0.0.1');

        const updateCall = db.query.mock.calls.find(([sql]) => /UPDATE scheduled_streams/.test(sql) && /status = 'active'/.test(sql));
        expect(updateCall).toBeDefined();
        expect(updateCall[0]).toMatch(/live_started_at = NOW\(\)/);
    });
});
