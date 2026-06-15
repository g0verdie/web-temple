jest.mock('../../../src/services/CacheService', () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    acquireLock: jest.fn()
}));
jest.mock('../../../src/services/emailService', () => ({ sendEmail: jest.fn() }));
jest.mock('../../../src/utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));
jest.mock('../../../src/services/pastVideos/index', () => ({ getSource: jest.fn() }));
jest.mock('../../../src/services/pastVideos/CuratedSource');

const CacheService = require('../../../src/services/CacheService');
const emailService = require('../../../src/services/emailService');
const { getSource } = require('../../../src/services/pastVideos/index');
const CuratedSource = require('../../../src/services/pastVideos/CuratedSource');
const PastVideoService = require('../../../src/services/pastVideos/PastVideoService');
const { LIST_KEY, FALLBACK_KEY, LASTGOOD_KEY, ALERTED_KEY } = PastVideoService.CACHE_KEYS;

describe('PastVideoService.getVideos', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env.PAST_VIDEO_SOURCE;
        process.env.ADMIN_EMAIL = 'ops@example.com';
        CacheService.get.mockResolvedValue(null);
        CacheService.set.mockResolvedValue(true);
        CacheService.del.mockResolvedValue(true);
        CacheService.acquireLock.mockResolvedValue(true);
        emailService.sendEmail.mockResolvedValue();
        CuratedSource.mockImplementation(() => ({ listVideos: jest.fn().mockResolvedValue([]) }));
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('(a) returns the cached list and does not call the source on a fresh cache hit', async () => {
        const cached = { videos: [{ id: '1' }], degraded: false };
        CacheService.get.mockImplementation(async (key) => (key === LIST_KEY ? cached : null));
        const fakeSource = { listVideos: jest.fn() };
        getSource.mockReturnValue(fakeSource);

        const result = await PastVideoService.getVideos();

        expect(result).toEqual(cached);
        expect(fakeSource.listVideos).not.toHaveBeenCalled();
    });

    it('(b) on a miss, fetches the source and caches the success + lastgood', async () => {
        const videos = [{ id: '1' }];
        getSource.mockReturnValue({ listVideos: jest.fn().mockResolvedValue(videos) });

        const result = await PastVideoService.getVideos();

        expect(result).toEqual({ videos, degraded: false });
        expect(CacheService.set).toHaveBeenCalledWith(LIST_KEY, { videos, degraded: false }, expect.any(Number));
        expect(CacheService.set).toHaveBeenCalledWith(LASTGOOD_KEY, videos, expect.any(Number));
    });

    it('(c) graph token failure + empty curated → degraded empty, alert sent once, no token in body', async () => {
        process.env.PAST_VIDEO_SOURCE = 'graph';
        const err = Object.assign(new Error('secret-token-leak'), { tokenInvalid: true });
        getSource.mockReturnValue({ listVideos: jest.fn().mockRejectedValue(err) });

        const result = await PastVideoService.getVideos();

        expect(result).toEqual({ videos: [], degraded: true });
        expect(CacheService.set).toHaveBeenCalledWith(FALLBACK_KEY, { videos: [], degraded: true }, expect.any(Number));
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
        expect(emailService.sendEmail.mock.calls[0][0].text).not.toContain('secret-token-leak');
    });

    it('(c2) suppresses the alert when the dedupe key is already set', async () => {
        process.env.PAST_VIDEO_SOURCE = 'graph';
        getSource.mockReturnValue({ listVideos: jest.fn().mockRejectedValue(Object.assign(new Error('x'), { tokenInvalid: true })) });
        CacheService.acquireLock.mockImplementation(async (key) => key !== ALERTED_KEY); // win lock, lose alert guard

        const result = await PastVideoService.getVideos();

        expect(result.degraded).toBe(true);
        expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('(d) graph failure but curated has entries → serves curated, degraded, caches fallback', async () => {
        process.env.PAST_VIDEO_SOURCE = 'graph';
        getSource.mockReturnValue({ listVideos: jest.fn().mockRejectedValue(Object.assign(new Error('x'), { tokenInvalid: true })) });
        const curated = [{ id: 'c1' }];
        CuratedSource.mockImplementation(() => ({ listVideos: jest.fn().mockResolvedValue(curated) }));

        const result = await PastVideoService.getVideos();

        expect(result).toEqual({ videos: curated, degraded: true });
        expect(CacheService.set).toHaveBeenCalledWith(FALLBACK_KEY, { videos: curated, degraded: true }, expect.any(Number));
    });

    it('(e) when the refresh lock is held, serves last-good and does not call the source', async () => {
        CacheService.acquireLock.mockResolvedValue(false);
        CacheService.get.mockImplementation(async (key) => (key === LASTGOOD_KEY ? [{ id: 'lg' }] : null));
        const fakeSource = { listVideos: jest.fn() };
        getSource.mockReturnValue(fakeSource);

        const result = await PastVideoService.getVideos();

        expect(result).toEqual({ videos: [{ id: 'lg' }], degraded: false });
        expect(fakeSource.listVideos).not.toHaveBeenCalled();
    });

    it('(f) with the cache backend unavailable, still returns videos by fetching and never throws', async () => {
        const videos = [{ id: '1' }];
        CacheService.get.mockResolvedValue(null);
        CacheService.set.mockResolvedValue(false); // CacheService swallows backend errors → false
        getSource.mockReturnValue({ listVideos: jest.fn().mockResolvedValue(videos) });

        await expect(PastVideoService.getVideos()).resolves.toEqual({ videos, degraded: false });
    });
});
