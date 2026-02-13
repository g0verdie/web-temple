const form = document.getElementById('register-form');
const errorDiv = document.getElementById('error-message');
const successDiv = document.getElementById('success-message');

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    errorDiv.textContent = '';
    successDiv.textContent = '';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm_password').value;

    if (!emailRegex.test(email)) {
      errorDiv.textContent = 'Please enter a valid email address.';
      return;
    }

    if (!passwordRegex.test(password)) {
      errorDiv.textContent = 'Password must be at least 12 characters and include uppercase, lowercase, number, and symbol.';
      return;
    }

    if (password !== confirmPassword) {
      errorDiv.textContent = 'Passwords do not match';
      return;
    }

    const formData = {
      email,
      password,
      first_name: document.getElementById('first_name').value || null,
      last_name: document.getElementById('last_name').value || null
    };

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        successDiv.textContent = 'Registration successful! Redirecting...';
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
        return;
      }

      errorDiv.textContent = result.message || 'Registration failed. Please try again.';
    } catch (error) {
      errorDiv.textContent = 'Network error. Please try again.';
      console.error('Registration error:', error);
    }
  });
}
