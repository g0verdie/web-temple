const form = document.getElementById('login-form');
const errorDiv = document.getElementById('error-message');
const successDiv = document.getElementById('success-message');

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    errorDiv.textContent = '';
    successDiv.textContent = '';

    // Only clear aria-invalid set during form validation, not on previous submission errors
    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => input.setAttribute('aria-invalid', 'false'));

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Validate required fields and email format (form validation phase)
    if (!email || !password) {
      errorDiv.textContent = 'Email and password are required.';
      if (!email) document.getElementById('email').setAttribute('aria-invalid', 'true');
      if (!password) document.getElementById('password').setAttribute('aria-invalid', 'true');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errorDiv.textContent = 'Please enter a valid email address.';
      document.getElementById('email').setAttribute('aria-invalid', 'true');
      return;
    }

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (result.success) {
        successDiv.textContent = 'Login successful! Redirecting...';
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
        return;
      }

      // On login failure, show generic error message WITHOUT setting aria-invalid
      // This prevents revealing which field caused the failure (security requirement)
      errorDiv.textContent = result.message || 'Login failed. Please try again.';
      // Move focus to the live region so screen-reader + keyboard users land on
      // the failure message (mirror contact-form.js).
      errorDiv.setAttribute('tabindex', '-1');
      errorDiv.focus();
      // Note: Do NOT set aria-invalid on fields for authentication failures
    } catch (error) {
      errorDiv.textContent = 'Network error. Please try again.';
      errorDiv.setAttribute('tabindex', '-1');
      errorDiv.focus();
      console.error('Login error:', error);
    }
  });
}
