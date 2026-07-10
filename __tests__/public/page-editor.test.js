/** @jest-environment jsdom */

// Client-side coverage for page-editor.js — guards the same CSRF regression that
// took the contact form down: every fetch() write (save / publish / unpublish /
// restore) must carry the csrf-token meta as a CSRF-Token header, or the global
// csurf middleware 403s the request and the admin page editor is effectively
// read-only. This gap ships green because CSRF is disabled under NODE_ENV=test,
// so no server-side test can catch a missing client-side token.
//
// Also pins the Quill init config (PR #7 review): the toolbar must not expose
// controls the sanitizer destroys on save, and the `formats` whitelist — the
// mechanism that actually governs paste, which the toolbar trim alone does not —
// must match the sanitizer-safe set.
//
// page-editor.js binds its handlers inside a DOMContentLoaded listener, so after
// requiring the module we dispatch DOMContentLoaded to register them. Quill is a
// vendored global at runtime; we stub it here.

const EDITOR_DOM = `
    <meta name="csrf-token" content="test-csrf">
    <form id="page-edit-form" data-slug="about">
        <input id="page-title" value="About the Temple" />
        <input type="hidden" id="page-content" />
        <textarea id="page-content-source" hidden></textarea>
        <div id="editor"></div>
        <button id="btn-save">Save</button>
        <button id="btn-preview">Preview</button>
        <button id="btn-cancel">Cancel</button>
        <button id="btn-publish">Publish</button>
        <button id="btn-unpublish">Unpublish</button>
        <button class="restore-version-btn" data-version="2">Restore</button>
    </form>
`;

const fire = async (el) => {
    el.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    // Let the async click handler's fetch().then() chain settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

describe('page editor', () => {
    // Require once: the module registers a single DOMContentLoaded listener on the
    // (shared) jsdom document. Requiring per-test would stack listeners and fire the
    // bind logic N times. We re-dispatch DOMContentLoaded each test to (re)bind the
    // handlers to that test's freshly-rebuilt DOM.
    beforeAll(() => {
        require('../../public/js/page-editor.js');
    });

    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = EDITOR_DOM;
        global.Quill = jest.fn(() => ({ root: { innerHTML: '<p>x</p>' }, on: jest.fn() }));
        global.alert = jest.fn();
        global.confirm = jest.fn(() => true);
        // Resolve to {success:false} so no success-path location.reload() is attempted;
        // the CSRF header is set on the request regardless of the response.
        global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ success: false }) });
        document.dispatchEvent(new Event('DOMContentLoaded'));
    });

    afterEach(() => {
        delete global.fetch;
        delete global.Quill;
        delete global.alert;
        delete global.confirm;
    });

    it('Save sends the csrf-token meta as a CSRF-Token header', async () => {
        await fire(document.getElementById('btn-save'));

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('/admin/pages/about');
        expect(options.method).toBe('POST');
        expect(options.headers['CSRF-Token']).toBe('test-csrf');
    });

    it('Publish sends the csrf-token meta as a CSRF-Token header', async () => {
        await fire(document.getElementById('btn-publish'));

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('/admin/pages/about/publish');
        expect(JSON.parse(options.body)).toEqual({ published: true });
        expect(options.headers['CSRF-Token']).toBe('test-csrf');
    });

    it('Unpublish sends the csrf-token meta as a CSRF-Token header', async () => {
        await fire(document.getElementById('btn-unpublish'));

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('/admin/pages/about/publish');
        expect(JSON.parse(options.body)).toEqual({ published: false });
        expect(options.headers['CSRF-Token']).toBe('test-csrf');
    });

    it('Restore version sends the csrf-token meta as a CSRF-Token header', async () => {
        await fire(document.querySelector('.restore-version-btn'));

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('/admin/pages/about/restore/2');
        expect(options.headers['CSRF-Token']).toBe('test-csrf');
    });

    it('trims sanitizer-destroyed controls from the toolbar', () => {
        const options = global.Quill.mock.calls[0][1];
        const controls = options.modules.toolbar
            .flat()
            .map((entry) => (typeof entry === 'string' ? entry : Object.keys(entry)[0]));
        expect(controls).not.toContain('image');
        expect(controls).not.toContain('blockquote');
        expect(controls).not.toContain('code-block');
    });

    it('whitelists formats so paste cannot introduce sanitizer-destroyed content', () => {
        const options = global.Quill.mock.calls[0][1];
        expect(options.formats).toEqual(['bold', 'italic', 'underline', 'link', 'header', 'list', 'image']);
    });
});
