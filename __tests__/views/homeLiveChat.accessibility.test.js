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
jest.mock('../../src/services/EventService');
jest.mock('../../src/services/StreamingService');
jest.mock('../../src/services/AnnouncementService');

const app = require('../../src/server');
const EventService = require('../../src/services/EventService');
const StreamingService = require('../../src/services/StreamingService');
const AnnouncementService = require('../../src/services/AnnouncementService');

expect.extend(toHaveNoViolations);
const AXE = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } };

// The public homepage in its LIVE state renders the stream player + the live-chat
// panel (chat is enabled only when the stream has a DB id). The existing
// home.accessibility.test.js only covers the default/fallback state, so this
// exercises the otherwise-untested live-stream-with-chat variant.
describe('Home live-stream + chat accessibility (WCAG AA)', () => {
    beforeEach(() => {
        EventService.getNextService.mockResolvedValue(null);
        EventService.getUpcomingEvents.mockResolvedValue([]);
        AnnouncementService.getHomepageAnnouncements.mockResolvedValue([]);
        StreamingService.getPublicEmbedMetadata.mockResolvedValue({
            id: 42,
            status: 'live',
            statusLabel: 'Live now',
            title: 'Shabbat Evening Service',
            embedUrl: 'https://www.facebook.com/plugins/video.php?href=live',
            watchUrl: 'https://www.facebook.com/share/abc/',
            message: 'We are streaming live.'
        });
    });

    afterEach(() => jest.clearAllMocks());

    test('live homepage with chat panel has no violations', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(await axe(res.text, AXE)).toHaveNoViolations();
    }, 15000);

    test('renders an aria-titled stream player and the live-chat panel', async () => {
        const res = await request(app).get('/');
        const document = new JSDOM(res.text).window.document;

        const iframe = document.querySelector('.stream-player-frame iframe');
        expect(iframe).toBeTruthy();
        expect(iframe.getAttribute('title')).toBeTruthy();

        const chatPanel = document.getElementById('live-chat-panel');
        expect(chatPanel).toBeTruthy();
        expect(chatPanel.getAttribute('data-stream-id')).toBe('42');

        expect(document.querySelector('main')).toBeTruthy();
        expect(document.querySelector('a[href="#main-content"]')).toBeTruthy();
    }, 15000);
});
