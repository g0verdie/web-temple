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
