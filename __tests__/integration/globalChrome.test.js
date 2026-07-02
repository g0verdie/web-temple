/**
 * Global chrome — two-tier top bar + full-width footer (I9).
 *
 * Exercises the server-rendered utility-strip live cue, service-times, the single
 * gold Give CTA, the desktop active-nav indicator, and the multi-column footer.
 * We hit a simple public page (/contact) so the StreamingService / EventService
 * mocks drive ONLY the global chrome middleware (the contact controller itself
 * touches neither service).
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    pool: { end: jest.fn(), connect: jest.fn() }
}));
jest.mock('../../src/services/StreamingService');
jest.mock('../../src/services/EventService');

const StreamingService = require('../../src/services/StreamingService');
const EventService = require('../../src/services/EventService');
const app = require('../../src/server');

// Scope assertions to a region of the chrome so a route linked once per breakpoint
// (strip on desktop, folded into the hamburger on mobile) reads as de-duplicated.
const utilStrip = (html) => (html.match(/<div class="chrome-util">[\s\S]*?<\/div>\s*<\/div>/) || [''])[0];
const navMenu = (html) => (html.match(/<ul class="nav-menu"[\s\S]*?<\/ul>/) || [''])[0];
// The primary nav = the hamburger menu minus the folded utility items (.nav-util),
// which only mirror the desktop utility strip on mobile.
const primaryNav = (html) => navMenu(html).replace(/<li class="nav-util">[\s\S]*?<\/li>/g, '');

const OFFLINE = { status: 'offline', embedUrl: null };

beforeEach(() => {
    jest.clearAllMocks();
    // Defaults: nothing live, no upcoming service. Individual tests override.
    StreamingService.getPublicEmbedMetadata.mockResolvedValue(OFFLINE);
    EventService.getNextService.mockResolvedValue(null);
});

describe('Two-tier top bar structure (R1)', () => {
    it('renders a utility strip (tier 1) and a main bar (tier 2)', async () => {
        const res = await request(app).get('/contact');
        expect(res.status).toBe(200);
        expect(res.text).toContain('chrome-util');
        expect(res.text).toContain('chrome-main');
    });

    it('renders exactly one gold Give button linking to /donations (R5)', async () => {
        const res = await request(app).get('/contact');
        expect(res.text).toContain('chrome-give');
        expect(res.text).toMatch(/href="\/donations"[^>]*class="chrome-give"|class="chrome-give"[^>]*href="\/donations"/);
        const matches = res.text.match(/class="chrome-give"/g) || [];
        expect(matches.length).toBe(1);
    });

    it('keeps the guest Login as a plain nav link, not a boxed CTA (R5)', async () => {
        const res = await request(app).get('/contact');
        expect(res.text).toContain('nav-login');
        expect(res.text).toContain('href="/login"');
    });
});

describe('Live-now cue (R2 / AE1, AE2)', () => {
    it('AE1: shows a live indicator linking to /watch when a stream is live', async () => {
        StreamingService.getPublicEmbedMetadata.mockResolvedValue({ status: 'live', statusLabel: 'LIVE NOW' });
        const res = await request(app).get('/contact');
        expect(res.text).toContain('chrome-util__live');
        expect(res.text).toContain('chrome-live-dot');
        expect(res.text).toMatch(/class="chrome-util__live"[^>]*href="\/watch"|href="\/watch"[^>]*class="chrome-util__live"/);
        expect(res.text).toContain('Watch Live');
        // The plain (non-live) Watch link is not rendered in the live branch.
        expect(res.text).not.toContain('chrome-util__watch');
    });

    it('AE2: shows a plain Watch link and no live indicator when offline', async () => {
        StreamingService.getPublicEmbedMetadata.mockResolvedValue(OFFLINE);
        const res = await request(app).get('/contact');
        expect(res.text).toContain('chrome-util__watch');
        expect(res.text).not.toContain('chrome-util__live');
        expect(res.text).not.toContain('chrome-live-dot');
    });

    it('AE2 (expiry): a non-"live" status renders no live indicator', async () => {
        // getPublicEmbedMetadata already filters an expired 'active' row down to a
        // non-live status; the chrome only lights up for status === 'live'.
        StreamingService.getPublicEmbedMetadata.mockResolvedValue({ status: 'upcoming' });
        const res = await request(app).get('/contact');
        expect(res.text).not.toContain('chrome-util__live');
    });

    it('degrades to a plain Watch link when the stream lookup rejects', async () => {
        StreamingService.getPublicEmbedMetadata.mockRejectedValue(new Error('db down'));
        const res = await request(app).get('/contact');
        expect(res.status).toBe(200);
        expect(res.text).toContain('chrome-util__watch');
        expect(res.text).not.toContain('chrome-util__live');
    });
});

describe('Service times (R3 / AE3)', () => {
    it('AE3: omits the times element entirely when no upcoming service resolves', async () => {
        EventService.getNextService.mockResolvedValue(null);
        const res = await request(app).get('/contact');
        expect(res.text).not.toContain('chrome-util__times');
    });

    it('renders the times element with the next service when one exists', async () => {
        EventService.getNextService.mockResolvedValue({
            id: 1,
            title: 'Kabbalat Shabbat',
            type: 'service',
            date: new Date('2026-07-03T23:00:00.000Z')
        });
        const res = await request(app).get('/contact');
        expect(res.text).toContain('chrome-util__times');
        expect(res.text).toContain('Kabbalat Shabbat');
    });

    it('omits the times element when the next service lookup rejects', async () => {
        EventService.getNextService.mockRejectedValue(new Error('db down'));
        const res = await request(app).get('/contact');
        expect(res.status).toBe(200);
        expect(res.text).not.toContain('chrome-util__times');
    });
});

describe('Active-nav indicator (R4)', () => {
    it('marks the current page nav item with aria-current="page"', async () => {
        const res = await request(app).get('/contact');
        expect(res.text).toMatch(/href="\/contact"[^>]*aria-current="page"/);
    });

    it('does not mark a non-current nav item', async () => {
        const res = await request(app).get('/contact');
        expect(res.text).not.toMatch(/href="\/"[^>]*aria-current="page"/);
    });
});

describe('Full-width multi-column footer (R6)', () => {
    it('renders a multi-column footer grid with the standard columns', async () => {
        const res = await request(app).get('/contact');
        expect(res.text).toContain('footer-grid');
        expect(res.text).toContain('footer-col');
        expect(res.text).toContain('501(c)(3)');
        expect(res.text).toContain('rights reserved');
    });
});

describe('Mobile: utility cues fold into the hamburger (R7 / Finding 1)', () => {
    // The tier-1 utility strip is hidden < 768px, so the live-now cue and service
    // time must ride inside the hamburger (the nav-menu markup) or a 390px visitor
    // never sees that an admin took a stream live.
    it('surfaces the live-now cue inside the hamburger menu when a stream is live', async () => {
        StreamingService.getPublicEmbedMetadata.mockResolvedValue({ status: 'live', statusLabel: 'LIVE NOW' });
        const res = await request(app).get('/contact');
        const menu = navMenu(res.text);
        expect(menu).toContain('chrome-live-dot');
        expect(menu).toContain('Watch Live');
        expect(menu).toMatch(/href="\/watch"/);
    });

    it('surfaces the next-service time inside the hamburger menu when one exists', async () => {
        EventService.getNextService.mockResolvedValue({
            id: 1, title: 'Kabbalat Shabbat', type: 'service', date: new Date('2026-07-03T23:00:00.000Z')
        });
        const res = await request(app).get('/contact');
        expect(navMenu(res.text)).toContain('Kabbalat Shabbat');
    });
});

describe('No duplicate destination links (Finding 4)', () => {
    it('does not link /login from the utility strip — auth lives in the main nav', async () => {
        const res = await request(app).get('/contact');
        expect(utilStrip(res.text)).not.toContain('href="/login"');
        // ...and the main nav still carries the guest Login link.
        expect(res.text).toContain('nav-login');
    });

    it('does not link /account/settings from the utility strip for a signed-in member', async () => {
        const token = jwt.sign(
            { user_id: 'member-1', role: 'member', email: 'm@x.com', token_version: 1 },
            process.env.JWT_SECRET || 'test-jwt-secret'
        );
        const res = await request(app).get('/contact').set('Cookie', [`auth_token=${token}`]);
        expect(utilStrip(res.text)).not.toContain('href="/account/settings"');
        // Account is still reachable exactly once, from the main nav.
        expect(res.text).toContain('href="/account/settings"');
    });

    it('does not repeat the Watch route in the primary nav (it lives in the utility strip)', async () => {
        const res = await request(app).get('/contact');
        expect(primaryNav(res.text)).not.toContain('href="/watch"');
        // The utility strip is the single home for the (live-aware) Watch link.
        expect(utilStrip(res.text)).toContain('href="/watch"');
    });
});

describe('Service-time label respects APP_TIMEZONE_OFFSET (Finding 3)', () => {
    const SERVICE = { id: 1, title: 'Kabbalat Shabbat', type: 'service', date: new Date('2026-07-03T23:00:00.000Z') };
    const originalOffset = process.env.APP_TIMEZONE_OFFSET;
    afterEach(() => {
        if (originalOffset === undefined) delete process.env.APP_TIMEZONE_OFFSET;
        else process.env.APP_TIMEZONE_OFFSET = originalOffset;
    });

    const timesLabel = async (offset) => {
        process.env.APP_TIMEZONE_OFFSET = offset;
        EventService.getNextService.mockResolvedValue(SERVICE);
        const res = await request(app).get('/contact');
        return (res.text.match(/class="chrome-util__times">([^<]*)</) || [null, ''])[1];
    };

    it('formats the time at the configured offset, not the server-local tz', async () => {
        // 2026-07-03T23:00Z is Sat 8:00 AM at +09:00 — never Fri 6PM (Chicago) or
        // Fri 11PM (UTC), which is what a server-local format would print.
        const label = await timesLabel('+09:00');
        expect(label).toContain('Sat');
        expect(label).toMatch(/8:00\s*AM/);
    });

    it('shifts the rendered time with the offset (proves it is offset-driven)', async () => {
        const west = await timesLabel('-05:00'); // Fri 6:00 PM
        const east = await timesLabel('+09:00'); // Sat 8:00 AM
        expect(west).not.toBe(east);
        expect(west).toMatch(/6:00\s*PM/);
    });
});

describe('Sticky footer shell (AE4 / Finding 2)', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../public/css/main.css'), 'utf8');

    it('makes the body a full-height flex column so the footer sits at the viewport bottom', () => {
        const body = (css.match(/^body\s*\{[^}]*\}/m) || [''])[0];
        expect(body).toMatch(/min-height:\s*100vh/);
        expect(body).toMatch(/display:\s*flex/);
        expect(body).toMatch(/flex-direction:\s*column/);
    });

    it('lets main grow to push the footer down on short pages', () => {
        const main = (css.match(/^main\s*\{[^}]*\}/m) || [''])[0];
        expect(main).toMatch(/flex:\s*1/);
    });
});
