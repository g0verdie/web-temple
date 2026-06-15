const getCsrfToken = () => {
    const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (metaToken) return metaToken;

    const inputToken = document.querySelector('input[name="_csrf"]')?.value;
    return inputToken || null;
};

document.addEventListener('DOMContentLoaded', async () => {
    const alertBox = document.getElementById('unsubscribeAlert');
    const token = document.getElementById('unsubscribeToken')?.value;

    if (!token) {
        alertBox.textContent = 'Missing unsubscribe token.';
        alertBox.className = 'alert alert-error';
        return;
    }

    const headers = { 'Content-Type': 'application/json' };
    const csrfToken = getCsrfToken();
    if (csrfToken) headers['CSRF-Token'] = csrfToken;

    try {
        const response = await fetch('/api/unsubscribe/confirm', {
            method: 'POST',
            headers,
            body: JSON.stringify({ token })
        });

        const data = await response.json();
        if (!response.ok || !data.ok) {
            throw new Error('Unsubscribe failed');
        }

        alertBox.textContent = 'You have been unsubscribed from all email notifications.';
        alertBox.className = 'alert alert-success';
    } catch (error) {
        alertBox.textContent = 'Unable to process your unsubscribe request. The link may be invalid or expired.';
        alertBox.className = 'alert alert-error';
    }
});
