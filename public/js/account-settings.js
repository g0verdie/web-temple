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
    const profileForm = document.getElementById('profileForm');
    const preferencesForm = document.getElementById('preferencesForm');
    const passwordForm = document.getElementById('passwordForm');

    if (profileForm) {
        profileForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const firstName = document.getElementById('first_name').value.trim();
            const lastName = document.getElementById('last_name').value.trim();
            const emailInput = document.getElementById('email');
            const newEmail = emailInput.value.trim();
            const currentEmail = emailInput.dataset.currentEmail;
            const profileMessage = document.getElementById('profileMessage');

            let profileUpdated = false;

            try {
                if (firstName || lastName) {
                    await requestJson('/api/account/profile', 'PUT', {
                        first_name: firstName || null,
                        last_name: lastName || null
                    });
                    profileUpdated = true;
                }
            } catch (error) {
                showMessage(profileMessage, error.message || 'Unable to update profile.', 'error');
                return;
            }

            const pendingEmail = emailInput.dataset.pendingEmail;
            const emailChanged = newEmail && currentEmail && newEmail.toLowerCase() !== currentEmail.toLowerCase();
            const resendPending = newEmail && pendingEmail && newEmail.toLowerCase() === pendingEmail.toLowerCase();

            if (emailChanged || resendPending) {
                try {
                    await requestJson('/api/account/email-change', 'POST', { new_email: newEmail });
                    emailInput.dataset.pendingEmail = newEmail;
                    showMessage(profileMessage, 'Confirmation email sent to your new address.', 'success');
                } catch (error) {
                    const fallbackMessage = profileUpdated
                        ? 'Profile updated. Email change could not be requested.'
                        : 'Unable to update profile.';
                    showMessage(profileMessage, error.message || fallbackMessage, 'error');
                }
                return;
            }

            if (profileUpdated) {
                showMessage(profileMessage, 'Profile updated successfully.', 'success');
            } else {
                showMessage(profileMessage, 'No changes to save.', 'error');
            }
        });
    }

    if (preferencesForm) {
        preferencesForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const preferencesMessage = document.getElementById('preferencesMessage');

            const preferences = {
                announcements: preferencesForm.elements.announcements.checked,
                calendar_events: preferencesForm.elements.calendar_events.checked,
                messages: preferencesForm.elements.messages.checked,
                recordings: preferencesForm.elements.recordings.checked
            };

            try {
                await requestJson('/api/account/preferences', 'PUT', {
                    notification_preferences: preferences
                });
                showMessage(preferencesMessage, 'Preferences updated.', 'success');
            } catch (error) {
                showMessage(preferencesMessage, error.message || 'Unable to update preferences.', 'error');
            }
        });
    }

    if (passwordForm) {
        passwordForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const currentPassword = document.getElementById('current_password').value;
            const newPassword = document.getElementById('new_password').value;
            const confirmPassword = document.getElementById('confirm_password').value;
            const passwordMessage = document.getElementById('passwordMessage');

            if (newPassword !== confirmPassword) {
                showMessage(passwordMessage, 'Passwords do not match.', 'error');
                return;
            }

            try {
                await requestJson('/api/account/password', 'POST', {
                    current_password: currentPassword,
                    new_password: newPassword
                });
                passwordForm.reset();
                showMessage(passwordMessage, 'Password updated.', 'success');
            } catch (error) {
                showMessage(passwordMessage, error.message || 'Unable to update password.', 'error');
            }
        });
    }
});
