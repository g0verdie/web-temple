/**
 * public/js/chat-moderation.js
 * Drives the /admin/chat-moderation queue: Approve/Delete actions and
 * empty-state transition. Loaded by views/admin/chat-moderation.ejs.
 *
 * Lives in an external script (not inline) so the project's strict CSP
 * (no 'unsafe-inline' on script-src) doesn't block moderation.
 */

document.addEventListener('DOMContentLoaded', () => {
    const table = document.getElementById('moderation-table');
    if (!table) return;

    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : '';

    table.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-action');
        if (!btn) return;

        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action'); // 'approve' or 'delete'
        const row = document.getElementById(`row-${id}`);

        if (!id || !action || !row) return;

        // Disable buttons in the row during request
        const buttons = row.querySelectorAll('.btn-action');
        buttons.forEach(b => b.setAttribute('disabled', 'true'));

        try {
            const response = await fetch(`/api/chat/message/${id}/${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to ${action} message`);
            }

            const result = await response.json();
            if (result.success) {
                // Fade out row and remove from table
                row.style.transition = 'opacity 0.3s ease';
                row.style.opacity = '0';
                setTimeout(() => {
                    row.remove();

                    // Update count
                    const countEl = document.getElementById('pending-count');
                    if (countEl) {
                        const newCount = parseInt(countEl.textContent, 10) - 1;
                        countEl.textContent = newCount;
                        if (newCount <= 0) {
                            const card = document.getElementById('moderation-card');
                            if (card) card.remove();
                            const allDoneAlert = document.getElementById('all-done-alert');
                            if (allDoneAlert) allDoneAlert.classList.remove('d-none');
                        }
                    }
                }, 300);
            } else {
                alert(`Error: ${result.error || 'Unknown error occurred'}`);
                buttons.forEach(b => b.removeAttribute('disabled'));
            }
        } catch (err) {
            console.error(err);
            alert(`Network error: ${err.message}`);
            buttons.forEach(b => b.removeAttribute('disabled'));
        }
    });
});
