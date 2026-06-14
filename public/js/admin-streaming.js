// admin-streaming.js — CSP-safe confirm-on-submit for forms carrying a
// data-confirm message (replaces inline onsubmit="return confirm(...)").
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form[data-confirm]').forEach(form => {
        form.addEventListener('submit', function (e) {
            if (!window.confirm(form.dataset.confirm)) {
                e.preventDefault();
            }
        });
    });
});
