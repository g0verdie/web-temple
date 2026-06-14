// auth-reset-password.js — CSP-safe external module for the set-new-password form.
// Reads CSRF from the page and the reset token from the URL; no inline script.
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('resetPasswordForm');
    const alertMessage = document.getElementById('alertMessage');
    const submitBtn = document.getElementById('submitBtn');
    const tokenInput = document.getElementById('token');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
        || document.querySelector('input[name="_csrf"]')?.value;

    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        alertMessage.className = 'alert alert-danger';
        alertMessage.textContent = 'Invalid or missing reset token. Please request a new link.';
        alertMessage.classList.remove('d-none');
        form.style.display = 'none';
    } else {
        tokenInput.value = token;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const password = document.getElementById('new_password').value;
        const confirm = document.getElementById('confirm_password').value;

        if (password !== confirm) {
            document.getElementById('confirm_password').setCustomValidity('Passwords do not match');
        } else {
            document.getElementById('confirm_password').setCustomValidity('');
        }

        if (!form.checkValidity()) {
            e.stopPropagation();
            form.classList.add('was-validated');
            return;
        }

        // Disable button and show loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Resetting...';
        alertMessage.classList.add('d-none');

        try {
            const headers = {
                'Content-Type': 'application/json'
            };

            if (csrfToken) {
                headers['CSRF-Token'] = csrfToken;
            }

            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    token: tokenInput.value,
                    new_password: password
                })
            });

            const data = await response.json();

            if (data.success) {
                alertMessage.className = 'alert alert-success';
                alertMessage.innerHTML = 'Password reset successfully! <a href="/login">Login now</a>';
                form.reset();
                form.style.display = 'none';
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
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Reset Password';
            }
        }
    });
});
