// Wrapped in an IIFE so this script's top-level helpers (getCsrfToken / requestJson /
// showMessage) don't collide with the identically-named ones in account-settings.js —
// both load as classic defer scripts on /account/settings, sharing one global scope, and
// a duplicate top-level `const` would throw "Identifier already declared", leaving the
// directory editor inert.
(function () {
const getCsrfToken = () => {
    const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (metaToken) return metaToken;
    const inputToken = document.querySelector('input[name="_csrf"]')?.value;
    return inputToken || null;
};

const requestJson = async (url, method, body) => {
    const headers = { 'Content-Type': 'application/json' };
    const csrfToken = getCsrfToken();
    if (csrfToken) headers['CSRF-Token'] = csrfToken;

    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.message || 'Request failed');
        error.status = response.status;
        throw error;
    }
    return data;
};

const showMessage = (element, message, type) => {
    element.textContent = message;
    element.className = `form-message ${type}`;
};

// Compose month/day/(optional year) fields into the stored birthday form — '' (none),
// 'MM-DD' (year omitted), or 'YYYY-MM-DD' (full). Throws a friendly message on a partial
// entry. Shared by the member's own birthday and each household member's birthday.
const composeBirthday = (monthRaw, dayRaw, yearRaw) => {
    const month = (monthRaw || '').trim();
    const day = (dayRaw || '').trim();
    const year = (yearRaw || '').trim();
    if (!month && !day && !year) return '';
    if (!month || !day) {
        throw new Error('Please choose both a month and a day for the birthday (the year is optional).');
    }
    if (year) {
        if (!/^\d{4}$/.test(year)) throw new Error('Please enter a 4-digit birth year, or leave it blank.');
        return `${year}-${month}-${day}`;
    }
    return `${month}-${day}`;
};

// Structured household editor: an in-memory array of { name, relationship, birthday }
// rendered into a table, edited through a modal, and serialized into a hidden input
// on submit. All DOM text goes through textContent — no HTML injection, CSP-clean.
const createHouseholdEditor = () => {
    const tbody = document.getElementById('householdRows');
    const empty = document.getElementById('householdEmpty');
    if (!tbody) return { getPeople: () => [] };

    // Seed from the server-rendered rows so an existing list survives a page load.
    let people = Array.from(tbody.querySelectorAll('tr')).map((row) => ({
        name: (row.querySelector('[data-cell="name"]')?.textContent || '').trim(),
        relationship: (row.querySelector('[data-cell="relationship"]')?.textContent || '').trim(),
        birthday: (row.querySelector('[data-cell="birthday"]')?.textContent || '').trim()
    })).filter((p) => p.name);

    const render = () => {
        tbody.textContent = '';
        people.forEach((person, index) => {
            const tr = document.createElement('tr');
            tr.className = 'household-row';
            ['name', 'relationship', 'birthday'].forEach((field) => {
                const td = document.createElement('td');
                td.setAttribute('data-cell', field);
                td.textContent = person[field] || '';
                tr.appendChild(td);
            });
            const actionCell = document.createElement('td');
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'link-button household-remove';
            removeBtn.textContent = 'Remove';
            removeBtn.dataset.index = String(index);
            actionCell.appendChild(removeBtn);
            tr.appendChild(actionCell);
            tbody.appendChild(tr);
        });
        if (empty) {
            if (people.length > 0) empty.setAttribute('hidden', '');
            else empty.removeAttribute('hidden');
        }
    };

    tbody.addEventListener('click', (event) => {
        const btn = event.target.closest('.household-remove');
        if (!btn) return;
        const index = parseInt(btn.dataset.index, 10);
        if (!Number.isNaN(index)) {
            people.splice(index, 1);
            render();
        }
    });

    // Modal wiring.
    const modal = document.getElementById('householdModal');
    const openBtn = document.getElementById('householdAddBtn');
    const addBtn = document.getElementById('householdModalAdd');
    const cancelBtn = document.getElementById('householdModalCancel');
    const nameInput = document.getElementById('hm-name');
    const relInput = document.getElementById('hm-relationship');
    const bdayMonth = document.getElementById('hm-birthday-month');
    const bdayDay = document.getElementById('hm-birthday-day');
    const bdayYear = document.getElementById('hm-birthday-year');
    const modalError = document.getElementById('householdModalError');

    const closeModal = () => {
        if (modal) modal.setAttribute('hidden', '');
        if (modalError) modalError.textContent = '';
        // Return focus to the trigger so keyboard/SR users aren't dropped at body.
        if (openBtn) openBtn.focus();
    };
    const openModal = () => {
        if (nameInput) nameInput.value = '';
        if (relInput) relInput.value = '';
        if (bdayMonth) bdayMonth.value = '';
        if (bdayDay) bdayDay.value = '';
        if (bdayYear) bdayYear.value = '';
        if (modalError) modalError.textContent = '';
        if (modal) modal.removeAttribute('hidden');
        if (nameInput) nameInput.focus();
    };

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Modal a11y: Escape closes it, and Tab is trapped within its controls so focus
    // can't slip into the settings page behind the overlay. The listener is inert while
    // the modal is `hidden` (display:none removes its children from the tab order).
    if (modal) {
        modal.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeModal();
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = Array.from(
                modal.querySelectorAll('input, select, button, [tabindex]:not([tabindex="-1"])')
            ).filter((el) => !el.disabled && el.offsetParent !== null);
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const name = (nameInput?.value || '').trim();
            if (!name) {
                if (modalError) modalError.textContent = 'Please enter a name.';
                return;
            }
            let birthday;
            try {
                birthday = composeBirthday(bdayMonth?.value, bdayDay?.value, bdayYear?.value);
            } catch (err) {
                if (modalError) modalError.textContent = err.message;
                return;
            }
            people.push({
                name,
                relationship: (relInput?.value || '').trim(),
                birthday
            });
            render();
            closeModal();
        });
    }

    render();
    return { getPeople: () => people };
};

// Tag-stack editor for committees/interests (item 4): an in-memory array of strings
// rendered as removable chips. The server contract is unchanged — chips are joined to a
// comma-separated string on submit, preserving the directory's ILIKE search. CSP-clean
// (createElement + textContent, never innerHTML).
const createTagStack = () => {
    const stack = document.getElementById('interestsStack');
    const entry = document.getElementById('interestsEntry');
    if (!stack) return { getTags: () => [] };

    // Seed from the server-rendered chips so an existing list survives a page load.
    let tags = Array.from(stack.querySelectorAll('.tag-chip'))
        .map((chip) => (chip.getAttribute('data-tag') || chip.querySelector('.tag-chip-label')?.textContent || '').trim())
        .filter(Boolean);

    const render = () => {
        stack.textContent = '';
        tags.forEach((tag, index) => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            chip.setAttribute('role', 'listitem');
            chip.dataset.tag = tag;
            const label = document.createElement('span');
            label.className = 'tag-chip-label';
            label.textContent = tag;
            chip.appendChild(label);
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'tag-chip-remove';
            remove.setAttribute('aria-label', `Remove ${tag}`);
            remove.dataset.index = String(index);
            remove.textContent = '×'; // ×
            chip.appendChild(remove);
            stack.appendChild(chip);
        });
    };

    // A comma-separated value adds several at once; commas never live inside a chip.
    const addFrom = (raw) => {
        String(raw).split(',').forEach((part) => {
            const tag = part.trim().slice(0, 60);
            if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) tags.push(tag);
        });
        render();
    };

    stack.addEventListener('click', (event) => {
        const btn = event.target.closest('.tag-chip-remove');
        if (!btn) return;
        const index = parseInt(btn.dataset.index, 10);
        if (Number.isNaN(index)) return;
        tags.splice(index, 1);
        render();
        // Keep keyboard focus sensible after the chip is gone: land on the chip that
        // shifted into its place (or the last one), else the entry input.
        const removeButtons = stack.querySelectorAll('.tag-chip-remove');
        if (removeButtons.length === 0) {
            if (entry) entry.focus();
        } else {
            removeButtons[Math.min(index, removeButtons.length - 1)].focus();
        }
    });

    if (entry) {
        entry.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                if (entry.value.trim()) { addFrom(entry.value); entry.value = ''; }
            }
        });
        // Commit a pending value when focus leaves the field.
        entry.addEventListener('blur', () => {
            if (entry.value.trim()) { addFrom(entry.value); entry.value = ''; }
        });
    }

    render();
    return { getTags: () => tags };
};

// Birthday (item 3): year is OPTIONAL. Compose the month/day/(optional year) fields into
// the stored form — '' (none), 'MM-DD' (year omitted), or 'YYYY-MM-DD' (full). Throws a
// friendly message on a partial entry (month or day missing).
const readBirthday = () => composeBirthday(
    document.getElementById('birthday_month')?.value,
    document.getElementById('birthday_day')?.value,
    document.getElementById('birthday_year')?.value
);

// Populate the birthday fields from the stored value ('YYYY-MM-DD' or 'MM-DD').
const seedBirthday = () => {
    const stored = document.getElementById('birthdayFields')?.getAttribute('data-birthday') || '';
    const m = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(stored);
    if (!m) return;
    const monthSel = document.getElementById('birthday_month');
    const daySel = document.getElementById('birthday_day');
    const yearInput = document.getElementById('birthday_year');
    if (monthSel) monthSel.value = m[2];
    if (daySel) daySel.value = m[3];
    if (yearInput && m[1]) yearInput.value = m[1];
};

// Item 5: the "Show my..." options are meaningless unless you're listed, so disable and
// grey the whole visibility fieldset until "List me in the member directory" is on.
const wireVisibilityToggle = () => {
    const listed = document.getElementById('listed');
    const fieldset = document.getElementById('visibilityFieldset');
    if (!listed || !fieldset) return;
    const sync = () => { fieldset.disabled = !listed.checked; };
    listed.addEventListener('change', sync);
    sync(); // initial state on load (no flash)
};

// Open + scroll to + focus the directory section. Used when arriving via the 301 from
// /account/directory, a /directory entry link, or the in-page jump-nav — none of which
// re-fire DOMContentLoaded for a same-page #anchor, so a plain anchor would leave the
// <details> collapsed.
const expandDirectorySection = () => {
    const section = document.getElementById('directory-listing');
    if (!section) return;
    section.open = true;
    section.setAttribute('tabindex', '-1');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.focus({ preventScroll: true });
};

const wireDirectoryExpand = () => {
    const section = document.getElementById('directory-listing');
    if (!section) return;
    if (window.location.hash === '#directory-listing') expandDirectorySection();
    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#directory-listing') expandDirectorySection();
    });
    const navLink = document.querySelector('.settings-nav a[href="#directory-listing"]');
    if (navLink) navLink.addEventListener('click', () => expandDirectorySection());
};

// Refresh the collapsed <summary> state line from the values just saved, so the header
// isn't stale until the next page load.
const updateDirectorySummary = (saved) => {
    const stateEl = document.querySelector('.directory-summary-state');
    if (!stateEl) return;
    if (!saved.listed) { stateEl.textContent = 'Not listed (tap to manage)'; return; }
    const shown = [];
    if (saved.show_phone) shown.push('phone');
    if (saved.show_email) shown.push('email');
    if (saved.show_address) shown.push('address');
    if (saved.show_birthday) shown.push('birthday');
    if (saved.show_household) shown.push('household');
    stateEl.textContent = 'Listed' + (shown.length ? ' — shows ' + shown.join(', ') : '');
};

document.addEventListener('DOMContentLoaded', () => {
    // The disclosure exists even in the degraded (no-form) state, so wire expand first.
    wireDirectoryExpand();
    const form = document.getElementById('directoryForm');
    if (!form) return;

    const household = createHouseholdEditor();
    const interests = createTagStack();
    seedBirthday();
    wireVisibilityToggle();

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = document.getElementById('directoryMessage');

        const listed = form.elements.listed.checked;
        const showHousehold = form.elements.show_household.checked;
        const householdConsent = form.elements.household_consent.checked;
        const wasListed = form.dataset.initialListed === 'true';

        // Gate: can't reveal household without acknowledging consent.
        if (showHousehold && !householdConsent) {
            showMessage(message, 'Please confirm the household acknowledgement before showing your household.', 'error');
            return;
        }

        let birthday;
        try {
            birthday = readBirthday();
        } catch (err) {
            showMessage(message, err.message, 'error');
            return;
        }

        // R10: enabling the listing is publicly consequential — confirm before it goes live.
        if (listed && !wasListed) {
            const ok = window.confirm(
                'Listing yourself makes your selected profile details visible to all logged-in members. Continue?'
            );
            if (!ok) return;
        }

        const body = {
            phone: form.elements.phone.value.trim(),
            address: form.elements.address.value.trim(),
            birthday,
            household: household.getPeople(),
            bio: form.elements.bio.value.trim(),
            interests: interests.getTags().join(', '),
            listed,
            show_phone: form.elements.show_phone.checked,
            show_address: form.elements.show_address.checked,
            show_birthday: form.elements.show_birthday.checked,
            show_email: form.elements.show_email.checked,
            show_household: showHousehold,
            household_consent: householdConsent
        };

        try {
            await requestJson('/api/account/directory', 'PUT', body);
            // The editor now lives on /account/settings, so a save stays in place and reads
            // back like the other settings forms — no redirect to /directory. Keep the
            // section open, re-baseline the listed state (so a re-save doesn't re-prompt),
            // and refresh the collapsed summary line.
            form.dataset.initialListed = String(listed);
            showMessage(message, 'Saved — your directory listing is up to date.', 'success');
            const section = document.getElementById('directory-listing');
            if (section) section.open = true;
            updateDirectorySummary(body);
        } catch (error) {
            showMessage(message, error.message || 'Unable to save your listing.', 'error');
        }
    });
});
})();
