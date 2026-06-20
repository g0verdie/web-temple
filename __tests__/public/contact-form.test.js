/** @jest-environment jsdom */

// Client-side coverage for contact-form.js — guards the CSRF regression that
// took the contact form down in prod-like environments: the fetch() submit must
// carry the csrf-token meta as a CSRF-Token header, or csurf 403s every message.
// This gap shipped green because CSRF is disabled under NODE_ENV=test, so no
// server-side test could catch a missing client-side token. This test asserts the
// client behaviour directly.
//
// contact-form.js binds its submit handler inside a DOMContentLoaded listener (it
// does not bind at module-eval time like login.js), so after requiring the module
// we dispatch DOMContentLoaded to register the handler against the prepared DOM.

const CONTACT_DOM = `
    <meta name="csrf-token" content="test-csrf">
    <form id="contactForm">
        <input name="name" value="Ada Lovelace" />
        <input name="email" value="ada@example.com" />
        <input name="subject" value="Hello" />
        <textarea name="message">A message of at least ten characters.</textarea>
        <input name="h-captcha-response" value="captcha-pass" />
        <div id="formMessages"></div>
        <button type="submit">Send Message</button>
    </form>
`;

const loadAndBind = () => {
    jest.isolateModules(() => {
        require('../../public/js/contact-form.js');
    });
    // Fire DOMContentLoaded so the module's listener binds the submit handler.
    document.dispatchEvent(new Event('DOMContentLoaded'));
};

const submitForm = async () => {
    document.getElementById('contactForm').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
    );
    // Let the async submit handler's fetch().then() chain settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

describe('contact form CSRF token', () => {
    beforeEach(() => {
        jest.resetModules();
        document.head.innerHTML = '';
        document.body.innerHTML = CONTACT_DOM;
    });

    afterEach(() => {
        delete global.fetch;
    });

    it('sends the csrf-token meta as a CSRF-Token header on submit', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true })
        });

        loadAndBind();
        await submitForm();

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('/contact');
        expect(options.method).toBe('POST');
        expect(options.headers['CSRF-Token']).toBe('test-csrf');
    });
});
