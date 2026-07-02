/** @jest-environment jsdom */

// Client-side coverage for login.js focus management on authentication failure.
// login.js binds a submit handler at module-eval time and reads #login-form and
// the message divs then, so each test sets up the DOM, then requires the module
// fresh (jest.resetModules()).

const LOGIN_DOM = `
    <meta name="csrf-token" content="test-csrf">
    <form id="login-form">
        <input id="email" type="email" />
        <input id="password" type="password" />
        <div id="error-message" class="error-message" role="alert" aria-live="polite"></div>
        <div id="success-message" role="status" aria-live="polite"></div>
        <button type="submit">Log in</button>
    </form>
`;

const loadModule = () => {
    jest.isolateModules(() => {
        require('../../public/js/login.js');
    });
};

const submitForm = async () => {
    document.getElementById('login-form').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
    );
    // Let the async submit handler's fetch().then() chain settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

describe('login client focus management', () => {
    beforeEach(() => {
        jest.resetModules();
        document.body.innerHTML = LOGIN_DOM;
        document.getElementById('email').value = 'user@example.com';
        document.getElementById('password').value = 'secret123';
    });

    afterEach(() => {
        delete global.fetch;
    });

    it('moves focus to the error live region on an authentication failure', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            json: async () => ({ success: false, message: 'Invalid credentials.' })
        });

        loadModule();
        await submitForm();

        const errorDiv = document.getElementById('error-message');
        expect(errorDiv.textContent).toBe('Invalid credentials.');
        expect(errorDiv.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(errorDiv);
    });

    it('moves focus to the error live region on a network error', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('boom'));

        loadModule();
        await submitForm();

        const errorDiv = document.getElementById('error-message');
        expect(errorDiv.textContent).toBe('Network error. Please try again.');
        expect(errorDiv.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(errorDiv);
    });
});

// Post-login redirect handling. login.js reads ?redirect from the login page URL
// (set by requireAuth) and, on a successful login, navigates the member to that
// value only when it is a same-origin relative path; otherwise it falls back to
// /directory. window.location is replaced with a plain object so we can capture
// the navigation target without jsdom's unimplemented navigation.
describe('login post-login redirect', () => {
    let originalLocation;

    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();
        document.body.innerHTML = LOGIN_DOM;
        document.getElementById('email').value = 'user@example.com';
        document.getElementById('password').value = 'secret123';

        originalLocation = window.location;
        delete window.location;
        // Mirror a real Location: resolveLandingPath validates the redirect
        // against window.location.origin, so the mock must expose one.
        window.location = { origin: 'https://temple.example', search: '', href: '' };

        global.fetch = jest.fn().mockResolvedValue({
            json: async () => ({ success: true })
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        window.location = originalLocation;
        delete global.fetch;
    });

    const loginAndLand = async (search) => {
        window.location.search = search;
        loadModule();
        await submitForm();
        jest.runAllTimers();
        return window.location.href;
    };

    // AE1 (R2, R5)
    it('lands on the deep-link target when redirect is a same-origin relative path', async () => {
        const dest = await loginAndLand('?redirect=%2Fdirectory%2F42');
        expect(dest).toBe('/directory/42');
    });

    // AE2 (R6)
    it('falls back to /directory when redirect is an absolute URL', async () => {
        const dest = await loginAndLand(
            '?redirect=' + encodeURIComponent('https://evil.example/phish')
        );
        expect(dest).toBe('/directory');
    });

    // AE3 (R7)
    it('falls back to /directory when redirect is protocol-relative', async () => {
        const dest = await loginAndLand(
            '?redirect=' + encodeURIComponent('//evil.example')
        );
        expect(dest).toBe('/directory');
    });

    // AE4 (R3)
    it('lands on /directory when no redirect parameter is present', async () => {
        const dest = await loginAndLand('');
        expect(dest).toBe('/directory');
    });

    // R8 — whitespace-only value is not a path
    it('falls back to /directory when redirect is whitespace-only', async () => {
        const dest = await loginAndLand('?redirect=' + encodeURIComponent('   '));
        expect(dest).toBe('/directory');
    });

    // Hardening — a leading slash followed by a backslash resolves to an external
    // host in browsers, so it must fail closed like a protocol-relative value.
    it('falls back to /directory when redirect uses a backslash host trick', async () => {
        const dest = await loginAndLand(
            '?redirect=' + encodeURIComponent('/\\evil.example')
        );
        expect(dest).toBe('/directory');
    });

    // Hardening — browsers strip ASCII tab/LF/CR from a URL before navigating, so
    // "/<TAB>/evil.example" is re-read as "//evil.example" (a protocol-relative
    // external host). A per-character allowlist on the raw string would let these
    // through, so the parser must reject any control character up front.
    it('falls back to /directory when redirect hides a slash-TAB-slash host', async () => {
        const dest = await loginAndLand('?redirect=%2F%09%2Fevil.example');
        expect(dest).toBe('/directory');
    });

    it('falls back to /directory when redirect hides a slash-LF-slash host', async () => {
        const dest = await loginAndLand('?redirect=%2F%0A%2Fevil.example');
        expect(dest).toBe('/directory');
    });

    it('falls back to /directory when redirect hides a slash-CR-slash host', async () => {
        const dest = await loginAndLand('?redirect=%2F%0D%2Fevil.example');
        expect(dest).toBe('/directory');
    });

    it('falls back to /directory when redirect hides a slash-TAB-backslash host', async () => {
        const dest = await loginAndLand('?redirect=%2F%09%5Cevil.example');
        expect(dest).toBe('/directory');
    });

    // A same-origin path that carries its own query string is preserved verbatim.
    it('preserves a same-origin path with its own query string', async () => {
        const dest = await loginAndLand(
            '?redirect=' + encodeURIComponent('/directory/42?tab=notes')
        );
        expect(dest).toBe('/directory/42?tab=notes');
    });
});
