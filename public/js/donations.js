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
        if (emailInput) emailInput.required = !isAnon;
    };

    presetRadios().forEach((r) => r.addEventListener('change', syncAmount));
    customInput.addEventListener('input', syncAmount);
    anonymous.addEventListener('change', syncAnonymous);

    syncAmount();
    syncAnonymous();
});
