const form = document.getElementById('login-form');
const errorDiv = document.getElementById('error-message');
const successDiv = document.getElementById('success-message');

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    errorDiv.textContent = '';
    successDiv.textContent = '';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      errorDiv.textContent = 'Email and password are required.';
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

      errorDiv.textContent = result.message || 'Login failed. Please try again.';
    } catch (error) {
      errorDiv.textContent = 'Network error. Please try again.';
      console.error('Login error:', error);
    }
  });
}
