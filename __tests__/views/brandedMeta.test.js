/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.setImmediate = global.setImmediate || process.nextTick;

const request = require('supertest');
const { JSDOM } = require('jsdom');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));

const db = require('../../src/config/db');
const app = require('../../src/server');

const SITE_NAME = "Temple B'nai Israel";

describe('Branded titles + OG share image (U5)', () => {
    beforeAll(() => {
        db.query.mockResolvedValue({ rows: [] });
    });

    it('appends the site name to a page whose title lacks it (register)', async () => {
        // /register's title is the bare brand suffix already — use a page that does not include it.
        // The login page title already contains the brand, so test branding via a page without it.
        const res = await request(app).get('/contact');
        const document = new JSDOM(res.text).window.document;
        const title = document.querySelector('title').textContent.trim();
        expect(title).toContain(SITE_NAME);
        expect(title).toContain('·');
    });

    it('does not double-append the site name when the title already contains it', async () => {
        const res = await request(app).get('/login');
        const document = new JSDOM(res.text).window.document;
        const title = document.querySelector('title').textContent.trim();
        // Brand appears exactly once.
        const occurrences = title.split(SITE_NAME).length - 1;
        expect(occurrences).toBe(1);
    });

    it('points og:image / twitter:image at the absolute og-share.jpg URL', async () => {
        const res = await request(app).get('/contact');
        const document = new JSDOM(res.text).window.document;
        const ogImage = document.querySelector('meta[property="og:image"]').getAttribute('content');
        const twitterImage = document.querySelector('meta[name="twitter:image"]').getAttribute('content');
        expect(ogImage).toMatch(/\/images\/og-share\.jpg$/);
        expect(twitterImage).toMatch(/\/images\/og-share\.jpg$/);
        // Absolute URL (host + path), since baseUrl is derived from the request.
        expect(ogImage).toMatch(/^https?:\/\//);
    });

    it('brands og:title / twitter:title to match the document title', async () => {
        const res = await request(app).get('/contact');
        const document = new JSDOM(res.text).window.document;
        const ogTitle = document.querySelector('meta[property="og:title"]').getAttribute('content');
        const twitterTitle = document.querySelector('meta[name="twitter:title"]').getAttribute('content');
        expect(ogTitle).toContain(SITE_NAME);
        expect(twitterTitle).toContain(SITE_NAME);
    });
});
