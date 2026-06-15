/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.setImmediate = global.setImmediate || process.nextTick;

const request = require('supertest');
const { JSDOM } = require('jsdom');
const { axe, toHaveNoViolations } = require('jest-axe');

jest.mock('../../src/config/redis', () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([])
}));
jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/pastVideos/PastVideoService');

const app = require('../../src/server');
const PastVideoService = require('../../src/services/pastVideos/PastVideoService');

expect.extend(toHaveNoViolations);
const AXE = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } };

describe('Watch / Past Services page accessibility (WCAG AA)', () => {
    afterEach(() => jest.clearAllMocks());

    test('populated state (player + grid) has no violations', async () => {
        PastVideoService.getVideos.mockResolvedValue({
            degraded: false,
            videos: [
                { embedUrl: 'https://www.facebook.com/plugins/video.php?href=a', title: 'Shabbat Service', date: '2026-02-14T18:00:00Z', thumbnailUrl: '/images/video-placeholder.svg' },
                { embedUrl: 'https://www.facebook.com/plugins/video.php?href=b', title: 'Holiday Service', date: '2026-01-01T18:00:00Z', thumbnailUrl: '' }
            ]
        });
        const res = await request(app).get('/watch');
        expect(res.status).toBe(200);
        expect(await axe(res.text, AXE)).toHaveNoViolations();
    }, 15000);

    test('degraded state (fallback notice) has no violations', async () => {
        PastVideoService.getVideos.mockResolvedValue({
            degraded: true,
            videos: [
                { embedUrl: 'https://www.facebook.com/plugins/video.php?href=c', title: 'Archived Service', date: '2025-12-01T18:00:00Z', thumbnailUrl: '' }
            ]
        });
        const res = await request(app).get('/watch');
        expect(res.status).toBe(200);
        expect(await axe(res.text, AXE)).toHaveNoViolations();
    }, 15000);

    test('empty state (no videos) has no violations', async () => {
        PastVideoService.getVideos.mockResolvedValue({ degraded: false, videos: [] });
        const res = await request(app).get('/watch');
        expect(res.status).toBe(200);
        expect(await axe(res.text, AXE)).toHaveNoViolations();
    }, 15000);

    test('populated state exposes a main landmark, skip link and labelled video region', async () => {
        PastVideoService.getVideos.mockResolvedValue({
            degraded: false,
            videos: [
                { embedUrl: 'https://www.facebook.com/plugins/video.php?href=a', title: 'Shabbat Service', date: '2026-02-14T18:00:00Z', thumbnailUrl: '/images/video-placeholder.svg' }
            ]
        });
        const res = await request(app).get('/watch');
        const document = new JSDOM(res.text).window.document;

        expect(document.querySelector('main')).toBeTruthy();
        expect(document.querySelector('a[href="#main-content"]')).toBeTruthy();

        const player = document.getElementById('watch-player');
        expect(player).toBeTruthy();
        expect(player.getAttribute('aria-label')).toBeTruthy();

        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const levels = headings.map(h => parseInt(h.tagName.charAt(1), 10));
        expect(levels.filter(l => l === 1).length).toBeGreaterThanOrEqual(1);
        for (let i = 1; i < levels.length; i++) {
            expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
        }
    }, 15000);
});
