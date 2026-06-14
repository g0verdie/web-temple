/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

const { axe, toHaveNoViolations } = require('jest-axe');
expect.extend(toHaveNoViolations);

const render = (view, data) => {
    const tpl = fs.readFileSync(path.join(__dirname, `../../src/views/admin/announcements/${view}.ejs`), 'utf8');
    const body = ejs.render(tpl, data);
    return `<!doctype html><html lang="en"><head><title>Admin Announcements</title></head><body><main>${body}</main></body></html>`;
};

const axeOpts = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } };

const ACTIVE = [
    { id: 'a1', title: 'Shabbat', status: 'published', published_at: '2026-06-14T00:00:00Z', isFeatured: true },
    { id: 'a2', title: 'Picnic', status: 'published', published_at: '2026-06-13T00:00:00Z', isFeatured: false }
];
const ARCHIVED = [
    { id: 'a3', title: 'Old Notice', status: 'deleted', published_at: '2026-05-01T00:00:00Z', deleted_at: '2026-05-10T00:00:00Z', isFeatured: false }
];

describe('Admin announcements list accessibility (WCAG AA)', () => {
    it('renders published items, featured badge, and archive section', () => {
        const html = render('list', { active: ACTIVE, archived: ARCHIVED, csrfToken: 'tok' });
        expect(html).toContain('Shabbat');
        expect(html).toContain('Featured');
        expect(html).toContain('Archive (1)');
        expect(html).toContain('Old Notice');
    });

    it('has no violations with content', async () => {
        const html = render('list', { active: ACTIVE, archived: ARCHIVED, csrfToken: 'tok' });
        const results = await axe(html, axeOpts);
        expect(results).toHaveNoViolations();
    });

    it('has no violations in the empty state', async () => {
        const html = render('list', { active: [], archived: [], csrfToken: 'tok' });
        expect(html).toContain('No published announcements yet');
        const results = await axe(html, axeOpts);
        expect(results).toHaveNoViolations();
    });
});

describe('Admin announcements form accessibility (WCAG AA)', () => {
    it('renders labeled title, toolbar, and editable body for a new announcement', () => {
        const html = render('form', { announcement: null, csrfToken: 'tok' });
        expect(html).toContain('New Announcement');
        expect(html).toContain('aria-label="Formatting"');
        expect(html).toContain('contenteditable="true"');
    });

    it('has no violations for the new-announcement form', async () => {
        const results = await axe(render('form', { announcement: null, csrfToken: 'tok' }), axeOpts);
        expect(results).toHaveNoViolations();
    });

    it('has no violations for the edit form (prefilled)', async () => {
        const announcement = { id: 'a1', title: 'Edit me', body_html: '<p>Body</p>', isFeatured: false };
        const results = await axe(render('form', { announcement, csrfToken: 'tok' }), axeOpts);
        expect(results).toHaveNoViolations();
    });
});
