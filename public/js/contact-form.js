/**
 * Contact Form Handler
 * Handles form submission with validation and error handling
 */
document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;

    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Get CAPTCHA token specifically
        const hcaptchaResponse = form.querySelector('[name="h-captcha-response"]');
        if (hcaptchaResponse) {
            data.captchaToken = hcaptchaResponse.value;
        }

        const msgDiv = document.getElementById('formMessages');
        const btn = form.querySelector('button[type="submit"]');

        // Reset previous error states
        form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));

        // Basic client-side validation check
        if (!data.captchaToken) {
            msgDiv.innerHTML = '<div class="alert alert-error">Please complete the CAPTCHA.</div>';
            msgDiv.focus();
            return;
        }

        // Disable button
        btn.disabled = true;
        btn.textContent = 'Sending...';

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
            const response = await fetch('/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                msgDiv.innerHTML = '<div class="alert alert-success">Message sent successfully! We will be in touch.</div>';
                form.reset();
                if (window.hcaptcha) hcaptcha.reset();
            } else {
                const errorMsg = result.errors ? result.errors.map(e => e.msg).join('<br>') : (result.error || 'Failed to send message.');
                msgDiv.innerHTML = `<div class="alert alert-error">${errorMsg}</div>`;
                if (result.errors && result.errors.length) {
                    const firstError = result.errors[0];
                    const field = form.querySelector(`[name="${firstError.param}"]`);
                    if (field) {
                        field.setAttribute('aria-invalid', 'true');
                        field.focus();
                    } else {
                        msgDiv.focus();
                    }
                } else {
                    msgDiv.focus();
                }
            }
        } catch (err) {
            msgDiv.innerHTML = '<div class="alert alert-error">An unexpected error occurred. Please try again.</div>';
            console.error(err);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send Message';
        }
    });
});
