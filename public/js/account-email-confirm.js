const getCsrfToken = () => {
    const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (metaToken) return metaToken;

    const inputToken = document.querySelector('input[name="_csrf"]')?.value;
    return inputToken || null;
};

document.addEventListener('DOMContentLoaded', async () => {
    const alertBox = document.getElementById('confirmAlert');
    const token = document.getElementById('emailChangeToken')?.value;

    if (!token) {
        alertBox.textContent = 'Missing email confirmation token.';
        alertBox.className = 'alert alert-error';
        return;
    }

    const headers = { 'Content-Type': 'application/json' };
    const csrfToken = getCsrfToken();
    if (csrfToken) headers['CSRF-Token'] = csrfToken;

    try {
        const response = await fetch('/api/account/email-change/confirm', {
            method: 'POST',
            headers,
            body: JSON.stringify({ token })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Confirmation failed');
        }

        alertBox.textContent = 'Email updated successfully. You can continue using your account.';
        alertBox.className = 'alert alert-success';
    } catch (error) {
        alertBox.textContent = error.message || 'Unable to confirm email.';
        alertBox.className = 'alert alert-error';
    }
});
