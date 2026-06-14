const getCsrfToken = () => {
    const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (metaToken) return metaToken;
    const inputToken = document.querySelector('input[name="_csrf"]')?.value;
    return inputToken || null;
};

const requestJson = async (url, method, body) => {
    const headers = { 'Content-Type': 'application/json' };
    const csrfToken = getCsrfToken();
    if (csrfToken) headers['CSRF-Token'] = csrfToken;

    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.message || 'Request failed');
        error.status = response.status;
        throw error;
    }
    return data;
};

const showMessage = (element, message, type) => {
    element.textContent = message;
    element.className = `form-message ${type}`;
};

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('directoryForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = document.getElementById('directoryMessage');

        const listed = form.elements.listed.checked;
        const showHousehold = form.elements.show_household.checked;
        const householdConsent = form.elements.household_consent.checked;
        const wasListed = form.dataset.initialListed === 'true';

        // Gate: can't reveal household without acknowledging consent.
        if (showHousehold && !householdConsent) {
            showMessage(message, 'Please confirm the household acknowledgement before showing your household.', 'error');
            return;
        }

        // R10: enabling the listing is publicly consequential — confirm before it goes live.
        if (listed && !wasListed) {
            const ok = window.confirm(
                'Listing yourself makes your selected profile details visible to all logged-in members. Continue?'
            );
            if (!ok) return;
        }

        const body = {
            phone: form.elements.phone.value.trim(),
            household: form.elements.household.value.trim(),
            bio: form.elements.bio.value.trim(),
            interests: form.elements.interests.value.trim(),
            listed,
            show_phone: form.elements.show_phone.checked,
            show_email: form.elements.show_email.checked,
            show_household: showHousehold,
            household_consent: householdConsent
        };

        try {
            await requestJson('/api/account/directory', 'PUT', body);
            form.dataset.initialListed = String(listed);
            showMessage(message, listed ? 'Saved — you are listed in the directory.' : 'Saved — you are not listed.', 'success');
        } catch (error) {
            showMessage(message, error.message || 'Unable to save your listing.', 'error');
        }
    });
});
