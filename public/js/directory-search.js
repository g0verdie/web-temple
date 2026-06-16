/**
 * Public member-directory live search (item 9). All listed members are rendered on one
 * page (the controller drops pagination), so filtering is a pure client-side, debounced
 * match over each card's name + interests — no backend call, no rate limit. The GET
 * <form> stays intact as the no-JS fallback. CSP-clean: no inline handlers.
 */
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('directorySearchInput');

    // If we arrived via a server-side ?search= (no-JS fallback or a shared link), only the
    // matching subset was rendered. Re-fetch the full directory so live filtering owns the
    // whole list, carrying the term across the reload so it stays applied.
    const serverSearch = new URLSearchParams(window.location.search).get('search');
    if (input && serverSearch) {
        try { sessionStorage.setItem('directorySearch', serverSearch); } catch (e) { /* sessionStorage unavailable */ }
        window.location.replace('/directory');
        return;
    }

    const list = document.getElementById('memberList');
    if (!input || !list) return; // empty directory or no-results page: nothing to filter

    // Restore a term carried across the redirect above and let the client filter apply it.
    try {
        const carried = sessionStorage.getItem('directorySearch');
        if (carried) { sessionStorage.removeItem('directorySearch'); input.value = carried; }
    } catch (e) { /* sessionStorage unavailable */ }

    const status = document.getElementById('directorySearchStatus');
    const emptyMsg = document.getElementById('directoryLiveEmpty');
    const cards = Array.from(list.querySelectorAll('.member-card'));

    // Precompute a lowercase "name + interests" haystack per card.
    const haystacks = cards.map((card) => {
        const name = card.querySelector('h2')?.textContent || '';
        const interests = card.querySelector('.member-interests')?.textContent || '';
        return `${name} ${interests}`.toLowerCase();
    });

    const apply = () => {
        const raw = input.value.trim();
        const q = raw.toLowerCase();
        let visible = 0;
        cards.forEach((card, i) => {
            const match = !q || haystacks[i].includes(q);
            card.classList.toggle('is-hidden', !match);
            if (match) visible += 1;
        });
        if (emptyMsg) emptyMsg.hidden = visible > 0;
        if (status) {
            status.textContent = raw
                ? `${visible} member${visible === 1 ? '' : 's'} match "${raw}".`
                : `${cards.length} member${cards.length === 1 ? '' : 's'} listed.`;
        }
    };

    let timer = null;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(apply, 150); // debounce typing
    });

    // With JS on, live filtering replaces the full-page reload; keep the form usable but
    // don't navigate (the no-JS fallback still submits when JS is off).
    const form = input.closest('form');
    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            clearTimeout(timer);
            apply();
        });
    }

    apply(); // seed the status line on load
});
