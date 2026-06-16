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
    const bdayInput = document.getElementById('hm-birthday');
    const modalError = document.getElementById('householdModalError');

    const closeModal = () => {
        if (modal) modal.setAttribute('hidden', '');
        if (modalError) modalError.textContent = '';
    };
    const openModal = () => {
        if (nameInput) nameInput.value = '';
        if (relInput) relInput.value = '';
        if (bdayInput) bdayInput.value = '';
        if (modalError) modalError.textContent = '';
        if (modal) modal.removeAttribute('hidden');
        if (nameInput) nameInput.focus();
    };

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const name = (nameInput?.value || '').trim();
            if (!name) {
                if (modalError) modalError.textContent = 'Please enter a name.';
                return;
            }
            people.push({
                name,
                relationship: (relInput?.value || '').trim(),
                birthday: (bdayInput?.value || '').trim()
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
const readBirthday = () => {
    const month = (document.getElementById('birthday_month')?.value || '').trim();
    const day = (document.getElementById('birthday_day')?.value || '').trim();
    const year = (document.getElementById('birthday_year')?.value || '').trim();
    if (!month && !day && !year) return '';
    if (!month || !day) {
        throw new Error('Please choose both a month and a day for your birthday (the year is optional).');
    }
    if (year) {
        if (!/^\d{4}$/.test(year)) throw new Error('Please enter a 4-digit birth year, or leave it blank.');
        return `${year}-${month}-${day}`;
    }
    return `${month}-${day}`;
};

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

document.addEventListener('DOMContentLoaded', () => {
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
            // Item 7: a successful self-service save returns to the public directory page.
            showMessage(message, 'Saved — taking you to the directory…', 'success');
            window.location.href = '/directory';
        } catch (error) {
            showMessage(message, error.message || 'Unable to save your listing.', 'error');
        }
    });
});
