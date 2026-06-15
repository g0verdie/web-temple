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

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('directoryForm');
    if (!form) return;

    const household = createHouseholdEditor();

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
            birthday: form.elements.birthday.value,
            household: household.getPeople(),
            bio: form.elements.bio.value.trim(),
            interests: form.elements.interests.value.trim(),
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
            form.dataset.initialListed = String(listed);
            showMessage(message, listed ? 'Saved — you are listed in the directory.' : 'Saved — you are not listed.', 'success');
        } catch (error) {
            showMessage(message, error.message || 'Unable to save your listing.', 'error');
        }
    });
});
