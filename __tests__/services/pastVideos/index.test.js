const CuratedSource = require('../../../src/services/pastVideos/CuratedSource');
const GraphApiSource = require('../../../src/services/pastVideos/GraphApiSource');
const { getSource, _reset } = require('../../../src/services/pastVideos');

describe('pastVideos source selector', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.PAST_VIDEO_SOURCE;
        _reset();
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('defaults to the curated source when PAST_VIDEO_SOURCE is unset', () => {
        expect(getSource()).toBeInstanceOf(CuratedSource);
    });

    it('returns the graph source when PAST_VIDEO_SOURCE=graph', () => {
        process.env.PAST_VIDEO_SOURCE = 'graph';
        expect(getSource()).toBeInstanceOf(GraphApiSource);
    });

    it('falls back to the curated source for an unknown value', () => {
        process.env.PAST_VIDEO_SOURCE = 'banana';
        expect(getSource()).toBeInstanceOf(CuratedSource);
    });

    it('memoizes the selected source instance', () => {
        const first = getSource();
        const second = getSource();
        expect(second).toBe(first);
    });

    it('_reset clears the memoized source', () => {
        const first = getSource();
        _reset();
        expect(getSource()).not.toBe(first);
    });
});
