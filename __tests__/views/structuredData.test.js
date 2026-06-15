/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.setImmediate = global.setImmediate || process.nextTick;

const request = require('supertest');
const { JSDOM } = require('jsdom');

jest.mock('../../src/config/redis', () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([])
}));
jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/EventService');
jest.mock('../../src/services/pastVideos/PastVideoService');

const db = require('../../src/config/db');
const EventService = require('../../src/services/EventService');
const PastVideoService = require('../../src/services/pastVideos/PastVideoService');
const app = require('../../src/server');

// Parse every <script type="application/ld+json"> on a page into JS objects.
const parseJsonLd = (html) => {
    const document = new JSDOM(html).window.document;
    return Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map((s) => JSON.parse(s.textContent));
};

describe('JSON-LD structured data (U6)', () => {
    beforeEach(() => {
        db.query.mockResolvedValue({ rows: [] });
    });
    afterEach(() => jest.clearAllMocks());

    test('every page emits exactly one sitewide PlaceOfWorship block', async () => {
        const res = await request(app).get('/contact');
        const blocks = parseJsonLd(res.text);
        const place = blocks.find((b) => b['@type'] === 'PlaceOfWorship');
        expect(place).toBeTruthy();
        expect(place.name).toBe("Temple B'nai Israel");
        expect(place.address['@type']).toBe('PostalAddress');
        expect(place.address.addressLocality).toBe('Florence');
        expect(place.address.addressRegion).toBe('AL');
    });

    test('a page without a jsonLd local renders ONLY the sitewide block', async () => {
        const res = await request(app).get('/contact');
        const blocks = parseJsonLd(res.text);
        expect(blocks).toHaveLength(1);
        expect(blocks[0]['@type']).toBe('PlaceOfWorship');
    });

    test('calendar renders the sitewide block + an Event ItemList', async () => {
        EventService.getEventsInRange.mockResolvedValue([
            { id: 1, title: 'Shabbat Service', date: new Date(Date.now() + 86400000), description: 'Weekly service', location: 'Main Sanctuary' }
        ]);
        const res = await request(app).get('/calendar');
        const blocks = parseJsonLd(res.text);
        expect(blocks.some((b) => b['@type'] === 'PlaceOfWorship')).toBe(true);

        const list = blocks.find((b) => b['@type'] === 'ItemList');
        expect(list).toBeTruthy();
        const event = list.itemListElement[0].item;
        expect(event['@type']).toBe('Event');
        expect(event.name).toBe('Shabbat Service');
        expect(event.location.name).toBe('Main Sanctuary');
    });

    test('watch renders the sitewide block + a VideoObject', async () => {
        PastVideoService.getVideos.mockResolvedValue({
            degraded: false,
            videos: [
                { embedUrl: 'https://www.facebook.com/plugins/video.php?href=a', title: 'Shabbat Service', date: '2026-02-14T18:00:00Z', thumbnailUrl: '/images/video-placeholder.svg' }
            ]
        });
        const res = await request(app).get('/watch');
        const blocks = parseJsonLd(res.text);
        expect(blocks.some((b) => b['@type'] === 'PlaceOfWorship')).toBe(true);

        const video = blocks.find((b) => b['@type'] === 'VideoObject');
        expect(video).toBeTruthy();
        expect(video.name).toBe('Shabbat Service');
        expect(video.embedUrl).toContain('facebook.com');
    });

    test('watch with no videos renders only the sitewide block (no empty VideoObject)', async () => {
        PastVideoService.getVideos.mockResolvedValue({ degraded: false, videos: [] });
        const res = await request(app).get('/watch');
        const blocks = parseJsonLd(res.text);
        expect(blocks).toHaveLength(1);
        expect(blocks[0]['@type']).toBe('PlaceOfWorship');
    });

    test('every JSON-LD block parses as valid JSON', async () => {
        EventService.getEventsInRange.mockResolvedValue([
            { id: 1, title: 'Shabbat Service', date: new Date(Date.now() + 86400000), description: 'svc', location: 'Sanctuary' }
        ]);
        const res = await request(app).get('/calendar');
        // parseJsonLd throws if any block is invalid JSON.
        expect(() => parseJsonLd(res.text)).not.toThrow();
    });
});
