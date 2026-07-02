const form = document.getElementById('login-form');
const errorDiv = document.getElementById('error-message');
const successDiv = document.getElementById('success-message');

// Resolve the post-login landing path from the ?redirect parameter that
// requireAuth set on the login URL. A redirect value is honored only when it
// resolves to the current origin. We parse it against window.location.origin and
// require the parsed origin to match exactly, then navigate to the parsed
// path/query/hash. Anything that resolves off-origin, fails to parse, or is
// empty/whitespace-only fails closed to the member directory.
//
// Per-character inspection of the raw string is unsafe: browsers strip ASCII
// tab (U+0009), LF (U+000A), and CR (U+000D) from a URL before navigating, so a
// value like "/<TAB>/evil.example" is re-read as "//evil.example" (an external
// host) even though the raw first two characters look like a same-origin path.
// We therefore reject any control character up front and let the URL parser —
// which applies the same normalization the browser will — decide the origin.
function resolveLandingPath(search) {
  const DEFAULT = '/directory';
  let redirect;
  try {
    redirect = new URLSearchParams(search).get('redirect');
  } catch (error) {
    return DEFAULT;
  }
  if (!redirect || redirect.trim() === '') {
    return DEFAULT;
  }
  // Reject C0 control characters and DEL; browsers strip tab/LF/CR from URLs,
  // which would let an off-origin host slip past origin validation.
  if (/[\u0000-\u001F\u007F]/.test(redirect)) {
    return DEFAULT;
  }
  let parsed;
  try {
    parsed = new URL(redirect, window.location.origin);
  } catch (error) {
    return DEFAULT;
  }
  if (parsed.origin !== window.location.origin) {
    return DEFAULT;
  }
  return parsed.pathname + parsed.search + parsed.hash;
}

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
        const landingPath = resolveLandingPath(window.location.search);
        setTimeout(() => {
          window.location.href = landingPath;
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
