/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

const { axe, toHaveNoViolations } = require('jest-axe');
expect.extend(toHaveNoViolations);

// Renders the admin chat-moderation partial in isolation (wrapped in a minimal
// document so document-level axe rules don't false-positive on the fragment).
const renderModeration = (messages) => {
    const tpl = fs.readFileSync(
        path.join(__dirname, '../../src/views/admin/chat-moderation.ejs'),
        'utf8'
    );
    const body = ejs.render(tpl, { messages });
    return `<!doctype html><html lang="en"><head><title>Chat Moderation</title></head><body><main>${body}</main></body></html>`;
};

const SAMPLE = [
    { id: 1, stream_id: 10, user_id: null, display_name: 'Rabbi David', message_text: 'Hello everyone', created_at: '2026-06-14T12:00:00Z' },
    { id: 2, stream_id: 10, user_id: 'u-1', display_name: 'Member A', message_text: 'Shalom', created_at: '2026-06-14T12:01:00Z' },
];

describe('Chat moderation queue accessibility (WCAG AA)', () => {
    it('renders the queue and tags only the guest author', () => {
        const html = renderModeration(SAMPLE);
        expect(html).toContain('Pending Messages');
        // Exactly one Guest badge — row 1 (user_id null), not row 2.
        expect((html.match(/>Guest</g) || []).length).toBe(1);
    });

    it('has no WCAG AA violations', async () => {
        const html = renderModeration(SAMPLE);
        const results = await axe(html, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
        });
        expect(results).toHaveNoViolations();
    });

    it('renders the all-caught-up empty state with no violations', async () => {
        const html = renderModeration([]);
        expect(html).toContain('All caught up');
        const results = await axe(html, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
        });
        expect(results).toHaveNoViolations();
    });
});
