/**
 * Logout handler. Intercepts the header "Logout" link, POSTs to the logout
 * endpoint with the CSRF token from the page <meta>, then redirects home.
 * The link's href="/login" is the no-JS fallback.
 */
(function () {
    const getCsrfToken = () => {
        const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (metaToken) return metaToken;
        return document.querySelector('input[name="_csrf"]')?.value || null;
    };

    document.addEventListener('DOMContentLoaded', () => {
        const link = document.getElementById('logout-link');
        if (!link) return;

        link.addEventListener('click', async (event) => {
            event.preventDefault();

            const headers = { 'Content-Type': 'application/json' };
            const csrfToken = getCsrfToken();
            if (csrfToken) headers['CSRF-Token'] = csrfToken;

            try {
                await fetch('/api/auth/logout', { method: 'POST', headers });
            } catch (e) {
                // Even if the request fails, fall through to redirect so the
                // user lands on a public page rather than a stuck state.
            }
            window.location.href = '/';
        });
    });
})();
