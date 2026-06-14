/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

const { axe, toHaveNoViolations } = require('jest-axe');
expect.extend(toHaveNoViolations);

const formatEventDate = (date) => new Date(date).toDateString();

// Minimal but complete viewData so home.ejs renders standalone. The focus is the
// announcements section; the rest is benign fixture data.
const baseViewData = {
    mission: { headline: 'Welcome', statement: 'A community.', cta: { text: 'Learn', link: '/about' } },
    nextService: null,
    countdown: null,
    events: [],
    stream: { status: 'offline', message: 'No stream', statusLabel: null },
    formatEventDate
};

const renderHome = (announcements) => {
    const tpl = fs.readFileSync(path.join(__dirname, '../../src/views/home.ejs'), 'utf8');
    const body = ejs.render(tpl, { ...baseViewData, announcements });
    return `<!doctype html><html lang="en"><head><title>Home</title></head><body><main>${body}</main></body></html>`;
};

const SAMPLE = [
    {
        id: 'a1',
        title: 'Shabbat Service',
        body_html: '<p>Join us Friday. <a href="https://temple.example.com/info">Details</a></p>',
        published_at: '2026-06-14T00:00:00Z',
        updated_at: '2026-06-15T00:00:00Z',
        isFeatured: true,
        wasEdited: true
    },
    {
        id: 'a2',
        title: 'Volunteer Drive',
        body_html: '<p>We need help. <img src="https://temple.example.com/p.png" alt="Volunteers smiling"></p>',
        published_at: '2026-06-13T00:00:00Z',
        updated_at: '2026-06-13T00:00:00Z',
        isFeatured: false,
        wasEdited: false
    }
];

const axeOpts = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } };

describe('Homepage announcements accessibility (WCAG AA)', () => {
    it('renders featured badge, Updated indicator, and expand control', () => {
        const html = renderHome(SAMPLE);
        expect(html).toContain('Announcements');
        expect(html).toContain('Featured');
        expect(html).toContain('Updated:');
        expect(html).toContain('<summary>Read announcement</summary>');
    });

    it('has no WCAG AA violations with announcements present', async () => {
        const results = await axe(renderHome(SAMPLE), axeOpts);
        expect(results).toHaveNoViolations();
    });

    it('renders the empty state with no violations', async () => {
        const html = renderHome([]);
        expect(html).toContain('No announcements at this time');
        const results = await axe(html, axeOpts);
        expect(results).toHaveNoViolations();
    });
});
