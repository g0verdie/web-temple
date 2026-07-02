/** @jest-environment jsdom */

// U8 — donation-form client-side validation. Mirrors the contact-form pattern:
// a bad amount/email is caught before submit (preventDefault), an inline message
// is shown in the aria-live region, and focus moves to the first invalid field.
describe('donations client-side validation', () => {
    const FORM_HTML = `
        <form id="donationForm" method="POST" action="/donations/checkout" novalidate>
            <div id="donationFormMessages" role="alert" aria-live="assertive"></div>
            <input type="radio" name="amount_preset" value="1800" checked>
            <input type="radio" name="amount_preset" value="custom">
            <input type="number" id="custom_amount" name="custom_amount" disabled>
            <input type="hidden" name="amount_cents" id="amount_cents" value="1800">
            <input type="checkbox" name="is_anonymous" id="is_anonymous">
            <div id="donor_email_row">
                <input type="email" id="donor_email" name="donor_email">
            </div>
            <button type="submit">Donate Now</button>
        </form>
    `;

    let form;
    let submitEvent;

    const loadScript = () => {
        require('../../public/js/donations.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
        form = document.getElementById('donationForm');
        // Stub submit so jsdom doesn't try to navigate; capture defaultPrevented.
        submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    };

    const toggleAnonymous = (on) => {
        const anon = document.getElementById('is_anonymous');
        anon.checked = on;
        anon.dispatchEvent(new Event('change'));
    };

    const selectCustom = () => {
        document.querySelector('input[value="1800"]').checked = false;
        const custom = document.querySelector('input[value="custom"]');
        custom.checked = true;
        custom.dispatchEvent(new Event('change'));
    };

    beforeEach(() => {
        jest.resetModules();
        document.body.innerHTML = FORM_HTML;
    });

    test('a valid preset amount submits normally (not prevented)', () => {
        loadScript();
        form.dispatchEvent(submitEvent);
        expect(submitEvent.defaultPrevented).toBe(false);
    });

    test('an empty custom amount blocks submit, shows an error, focuses the custom field', () => {
        loadScript();
        selectCustom();
        document.getElementById('custom_amount').value = '';
        document.getElementById('custom_amount').dispatchEvent(new Event('input'));

        form.dispatchEvent(submitEvent);

        expect(submitEvent.defaultPrevented).toBe(true);
        const msg = document.getElementById('donationFormMessages');
        expect(msg.textContent).toMatch(/at least \$1/i);
        expect(msg.querySelector('.alert-error')).not.toBeNull();
        expect(document.activeElement).toBe(document.getElementById('custom_amount'));
        expect(document.getElementById('custom_amount').getAttribute('aria-invalid')).toBe('true');
    });

    test('a zero / negative custom amount is blocked', () => {
        loadScript();
        selectCustom();
        const custom = document.getElementById('custom_amount');
        custom.value = '0';
        custom.dispatchEvent(new Event('input'));

        form.dispatchEvent(submitEvent);
        expect(submitEvent.defaultPrevented).toBe(true);
    });

    test('a malformed email blocks submit with a field-specific message and focus', () => {
        loadScript();
        const email = document.getElementById('donor_email');
        email.value = 'not-an-email';

        form.dispatchEvent(submitEvent);

        expect(submitEvent.defaultPrevented).toBe(true);
        expect(document.getElementById('donationFormMessages').textContent).toMatch(/valid email/i);
        expect(document.activeElement).toBe(email);
        expect(email.getAttribute('aria-invalid')).toBe('true');
    });

    test('a well-formed email with a valid amount submits', () => {
        loadScript();
        document.getElementById('donor_email').value = 'donor@example.com';
        form.dispatchEvent(submitEvent);
        expect(submitEvent.defaultPrevented).toBe(false);
    });

    test('email is not validated when giving anonymously', () => {
        loadScript();
        const anon = document.getElementById('is_anonymous');
        anon.checked = true;
        anon.dispatchEvent(new Event('change'));
        document.getElementById('donor_email').value = 'not-an-email';

        form.dispatchEvent(submitEvent);
        expect(submitEvent.defaultPrevented).toBe(false);
    });

    // AE1 (R7, R8) — the required signal toggles in lockstep with the anonymous
    // control: the email is programmatically required when a receipt is expected,
    // and the requirement is cleared (and the row hidden) when giving anonymously.
    test('email reports aria-required="true" by default (non-anonymous)', () => {
        loadScript();
        const email = document.getElementById('donor_email');
        expect(email.getAttribute('aria-required')).toBe('true');
        expect(email.required).toBe(true);
    });

    test('checking "Give anonymously" clears the requirement and hides the email row', () => {
        loadScript();
        toggleAnonymous(true);
        const email = document.getElementById('donor_email');
        expect(email.getAttribute('aria-required')).toBe('false');
        expect(email.required).toBe(false);
        // Row hidden, so the required marker inside it is neither shown nor announced.
        expect(document.getElementById('donor_email_row').style.display).toBe('none');
    });

    test('unchecking "Give anonymously" restores the required signal', () => {
        loadScript();
        toggleAnonymous(true);
        toggleAnonymous(false);
        const email = document.getElementById('donor_email');
        expect(email.getAttribute('aria-required')).toBe('true');
        expect(email.required).toBe(true);
        expect(document.getElementById('donor_email_row').style.display).not.toBe('none');
    });

    test('prior error state is cleared on the next submit', () => {
        loadScript();
        const email = document.getElementById('donor_email');
        email.value = 'not-an-email';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(email.getAttribute('aria-invalid')).toBe('true');

        // Fix the email and resubmit — error state should clear.
        email.value = 'donor@example.com';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(email.getAttribute('aria-invalid')).toBeNull();
        expect(document.getElementById('donationFormMessages').textContent).toBe('');
    });
});
