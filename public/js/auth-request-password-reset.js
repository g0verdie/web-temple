// auth-request-password-reset.js — CSP-safe external module for the password-reset
// request form. Reads CSRF from the page (meta tag / hidden input); no inline script.
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('resetRequestForm');
    const alertMessage = document.getElementById('alertMessage');
    const submitBtn = document.getElementById('submitBtn');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
        || document.querySelector('input[name="_csrf"]')?.value;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!form.checkValidity()) {
            e.stopPropagation();
            form.classList.add('was-validated');
            return;
        }

        const email = document.getElementById('email').value;

        // Disable button and show loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...';
        alertMessage.classList.add('d-none');

        try {
            const headers = {
                'Content-Type': 'application/json'
            };

            if (csrfToken) {
                headers['CSRF-Token'] = csrfToken;
            }

            const response = await fetch('/api/auth/password-reset-request', {
                method: 'POST',
                headers,
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.success) {
                alertMessage.className = 'alert alert-success';
                alertMessage.textContent = data.message;
                form.reset();
                form.classList.remove('was-validated');
            } else {
                alertMessage.className = 'alert alert-danger';
                alertMessage.textContent = data.message || 'An error occurred. Please try again.';
            }
        } catch (error) {
            console.error('Error:', error);
            alertMessage.className = 'alert alert-danger';
            alertMessage.textContent = 'An error occurred. Please check your connection and try again.';
        } finally {
            alertMessage.classList.remove('d-none');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Reset Link';
        }
    });
});
