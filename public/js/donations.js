document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('donationForm');
    if (!form) return;

    const customInput = document.getElementById('custom_amount');
    const amountCents = document.getElementById('amount_cents');
    const anonymous = document.getElementById('is_anonymous');
    const emailRow = document.getElementById('donor_email_row');
    const emailInput = document.getElementById('donor_email');

    const presetRadios = () => Array.from(form.querySelectorAll('input[name="amount_preset"]'));
    const selectedPreset = () => presetRadios().find((r) => r.checked);

    const syncAmount = () => {
        const preset = selectedPreset();
        if (!preset) return;
        if (preset.value === 'custom') {
            customInput.disabled = false;
            const dollars = parseFloat(customInput.value);
            amountCents.value = Number.isFinite(dollars) && dollars > 0 ? String(Math.round(dollars * 100)) : '';
        } else {
            customInput.disabled = true;
            amountCents.value = preset.value;
        }
    };

    const syncAnonymous = () => {
        const isAnon = anonymous.checked;
        emailRow.style.display = isAnon ? 'none' : '';
        // Toggle the requirement in lockstep so the visible marker (inside the now-
        // hidden row) is never announced as required while the row is anonymous.
        if (emailInput) {
            emailInput.required = !isAnon;
            emailInput.setAttribute('aria-required', isAnon ? 'false' : 'true');
        }
    };

    const msgDiv = document.getElementById('donationFormMessages');

    // Mirror the server-side email check (donationController) so a bad address is
    // caught before submit instead of bouncing the donor to a full error page.
    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    const showError = (field, message) => {
        if (msgDiv) {
            // textContent (not innerHTML) — messages are static, no user input, no XSS surface.
            const alert = document.createElement('div');
            alert.className = 'alert alert-error';
            alert.textContent = message;
            msgDiv.replaceChildren(alert);
        }
        if (field) {
            field.setAttribute('aria-invalid', 'true');
            field.focus();
        } else if (msgDiv) {
            msgDiv.focus();
        }
    };

    form.addEventListener('submit', (e) => {
        // Clear prior error state.
        if (msgDiv) msgDiv.replaceChildren();
        form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));

        // amount_cents must be a positive integer (custom amount ≥ $1). The server
        // (donationController) stays authoritative — this only protects donor input.
        const cents = Number(amountCents.value);
        if (!Number.isInteger(cents) || cents < 100) {
            e.preventDefault();
            const customSelected = selectedPreset() && selectedPreset().value === 'custom';
            showError(customSelected ? customInput : null, 'Please enter a donation amount of at least $1.');
            return;
        }

        // A non-anonymous donation with an email present must carry a valid address.
        if (emailInput && !anonymous.checked) {
            const email = emailInput.value.trim();
            if (email && !isValidEmail(email)) {
                e.preventDefault();
                showError(emailInput, 'Please enter a valid email address for your receipt.');
            }
        }
    });

    presetRadios().forEach((r) => r.addEventListener('change', syncAmount));
    customInput.addEventListener('input', syncAmount);
    anonymous.addEventListener('change', syncAnonymous);

    syncAmount();
    syncAnonymous();
});
