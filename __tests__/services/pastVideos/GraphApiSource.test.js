const GraphApiSource = require('../../../src/services/pastVideos/GraphApiSource');
const logger = require('../../../src/utils/logger');

describe('GraphApiSource', () => {
    const originalEnv = process.env;
    let source;

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.FACEBOOK_PAGE_ID = '123456789';
        process.env.FACEBOOK_PAGE_ACCESS_TOKEN = 'test-page-token';
        process.env.FACEBOOK_GRAPH_API_VERSION = 'v21.0';
        source = new GraphApiSource();
        global.fetch = jest.fn();
    });

    afterEach(() => {
        delete global.fetch;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    const okResponse = (data) => ({
        ok: true,
        status: 200,
        json: async () => ({ data })
    });

    it('maps a videos payload to the normalized shape, newest-first, with a plugins/video.php embed built from the id', async () => {
        global.fetch.mockResolvedValue(okResponse([
            { id: '111', description: 'Older service', created_time: '2026-05-01T19:00:00+0000', picture: 'https://thumb/1.jpg', status: { video_status: 'ready' } },
            { id: '222', description: 'Newer service', created_time: '2026-05-29T19:00:00+0000', picture: 'https://thumb/2.jpg', status: { video_status: 'ready' } }
        ]));

        const videos = await source.listVideos();

        expect(videos).toHaveLength(2);
        expect(videos[0].id).toBe('222'); // newest first
        expect(videos[1].id).toBe('111');
        expect(videos[0].title).toBe('Newer service');
        expect(videos[0].thumbnailUrl).toBe('https://thumb/2.jpg');
        expect(videos[0].embedUrl).toBe(
            'https://www.facebook.com/plugins/video.php?href='
            + encodeURIComponent('https://www.facebook.com/123456789/videos/222/')
            + '&show_text=false'
        );
    });

    it('drops videos whose status is not ready (R9)', async () => {
        global.fetch.mockResolvedValue(okResponse([
            { id: '111', created_time: '2026-05-01T19:00:00+0000', status: { video_status: 'ready' } },
            { id: '222', created_time: '2026-05-02T19:00:00+0000', status: { video_status: 'processing' } }
        ]));

        const videos = await source.listVideos();
        expect(videos.map(v => v.id)).toEqual(['111']);
    });

    it('drops a non-numeric video id', async () => {
        global.fetch.mockResolvedValue(okResponse([
            { id: 'abc../evil', created_time: '2026-05-01T19:00:00+0000', status: { video_status: 'ready' } },
            { id: '333', created_time: '2026-05-02T19:00:00+0000', status: { video_status: 'ready' } }
        ]));

        const videos = await source.listVideos();
        expect(videos.map(v => v.id)).toEqual(['333']);
    });

    it('derives a date-based default title when the description is empty', async () => {
        global.fetch.mockResolvedValue(okResponse([
            { id: '444', description: '', created_time: '2026-05-29T19:00:00+0000', status: { video_status: 'ready' } }
        ]));

        const videos = await source.listVideos();
        expect(videos[0].title).toMatch(/^Service — /);
        expect(videos[0].title).not.toBe('');
    });

    it('throws with tokenInvalid on Graph error code 190', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: { code: 190, message: 'Error validating access token' } })
        });

        await expect(source.listVideos()).rejects.toMatchObject({ tokenInvalid: true });
    });

    it('throws (not silent empty) on a network failure', async () => {
        global.fetch.mockRejectedValue(new Error('ECONNRESET'));
        await expect(source.listVideos()).rejects.toThrow();
    });

    it('throws WITHOUT tokenInvalid on a non-190 Graph error (so the alert is a generic failure)', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ error: { code: 1, message: 'server error' } })
        });
        let err;
        try { await source.listVideos(); } catch (e) { err = e; }
        expect(err).toBeInstanceOf(Error);
        expect(err.tokenInvalid).toBeFalsy();
    });

    it('truncates a long first-line description for the card title', async () => {
        global.fetch.mockResolvedValue(okResponse([
            { id: '555', description: 'A'.repeat(120), created_time: '2026-05-29T19:00:00+0000', status: { video_status: 'ready' } }
        ]));
        const videos = await source.listVideos();
        expect(videos[0].title.length).toBeLessThanOrEqual(80);
        expect(videos[0].title.endsWith('…')).toBe(true);
    });

    it('sends the token in the Authorization header, not the URL, and pins the API version', async () => {
        global.fetch.mockResolvedValue(okResponse([]));
        await source.listVideos();

        const [calledUrl, options] = global.fetch.mock.calls[0];
        expect(calledUrl).toContain('/v21.0/');
        expect(calledUrl).not.toContain('access_token');
        expect(options.headers.Authorization).toBe('Bearer test-page-token');
    });

    it('throws tokenInvalid when env credentials are missing', async () => {
        delete process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
        await expect(source.listVideos()).rejects.toMatchObject({ tokenInvalid: true });
    });

    it('warns (but does not throw) when FACEBOOK_PAGE_ID is not numeric — the vanity-slug silent-failure guard', async () => {
        process.env.FACEBOOK_PAGE_ID = 'florencetemple'; // a vanity name, not the numeric Page ID
        global.fetch.mockResolvedValue(okResponse([]));
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
        try {
            await source.listVideos();
            expect(warn.mock.calls.some(([msg]) => String(msg).includes('FACEBOOK_PAGE_ID is not numeric'))).toBe(true);
        } finally {
            warn.mockRestore();
        }
    });

    it('does not warn about the Page ID when it is numeric', async () => {
        // process.env.FACEBOOK_PAGE_ID is the numeric '123456789' from beforeEach
        global.fetch.mockResolvedValue(okResponse([]));
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
        try {
            await source.listVideos();
            expect(warn.mock.calls.some(([msg]) => String(msg).includes('FACEBOOK_PAGE_ID is not numeric'))).toBe(false);
        } finally {
            warn.mockRestore();
        }
    });
});
