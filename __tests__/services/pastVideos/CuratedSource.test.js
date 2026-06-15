jest.mock('../../../src/services/pastVideos/curatedVideos', () => ([
    { url: 'https://www.facebook.com/watch/?v=111', title: 'Older', date: '2026-05-01T19:00:00.000Z', description: 'older' },
    { url: 'https://www.facebook.com/watch/?v=222', title: 'Newer', date: '2026-05-29T19:00:00.000Z', description: 'newer' },
    { url: 'https://evil.example.com/video', title: 'Bad host', date: '2026-05-15T19:00:00.000Z' },
    { title: 'No url', date: '2026-05-10T19:00:00.000Z' }
]));

const CuratedSource = require('../../../src/services/pastVideos/CuratedSource');

describe('CuratedSource', () => {
    const source = new CuratedSource();

    it('normalizes entries newest-first into the shared shape', async () => {
        const videos = await source.listVideos();
        // Two valid facebook.com entries survive; bad-host and url-less are skipped.
        expect(videos).toHaveLength(2);
        expect(videos[0].title).toBe('Newer'); // newest first
        expect(videos[1].title).toBe('Older');
        expect(videos[0]).toMatchObject({
            id: 'https://www.facebook.com/watch/?v=222',
            date: '2026-05-29T19:00:00.000Z',
            description: 'newer',
            thumbnailUrl: null
        });
    });

    it('builds a plugins/video.php embed url for each entry', async () => {
        const videos = await source.listVideos();
        expect(videos[0].embedUrl).toBe(
            'https://www.facebook.com/plugins/video.php?href='
            + encodeURIComponent('https://www.facebook.com/watch/?v=222')
            + '&show_text=false'
        );
    });

    it('skips non-facebook.com and url-less entries (S3) without throwing', async () => {
        const videos = await source.listVideos();
        const titles = videos.map(v => v.title);
        expect(titles).not.toContain('Bad host');
        expect(titles).not.toContain('No url');
    });
});

describe('CuratedSource with an empty list', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.doMock('../../../src/services/pastVideos/curatedVideos', () => ([]));
    });

    afterEach(() => {
        jest.dontMock('../../../src/services/pastVideos/curatedVideos');
    });

    it('returns [] without throwing', async () => {
        const EmptyCuratedSource = require('../../../src/services/pastVideos/CuratedSource');
        const videos = await new EmptyCuratedSource().listVideos();
        expect(videos).toEqual([]);
    });
});

describe('shipped curated seed', () => {
    it('is non-empty so the page never ships blank (P2 demo guard)', () => {
        const seed = jest.requireActual('../../../src/services/pastVideos/curatedVideos');
        expect(Array.isArray(seed)).toBe(true);
        expect(seed.length).toBeGreaterThan(0);
    });
});
