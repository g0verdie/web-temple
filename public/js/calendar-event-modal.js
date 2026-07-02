// Calendar event popup: clicking a calendar event opens an accessible dialog with
// the event's details and, when the event has a linked stream, a link to its stream
// page. External file (no inline script) to satisfy the strict CSP; all text is set
// via textContent so event data can't inject markup.
(function () {
    'use strict';

    var modal = document.getElementById('calendarEventModal');
    var grid = document.querySelector('.calendar-grid');
    if (!modal || !grid) {
        return;
    }

    var titleEl = document.getElementById('calendarEventModalTitle');
    var timeEl = document.getElementById('calendarEventModalTime');
    var locationEl = document.getElementById('calendarEventModalLocation');
    var membersEl = document.getElementById('calendarEventModalMembers');
    var descriptionEl = document.getElementById('calendarEventModalDescription');
    var streamLink = document.getElementById('calendarEventModalStreamLink');
    var closeBtn = document.getElementById('calendarEventModalClose');
    var lastTrigger = null;

    function openModal(trigger) {
        lastTrigger = trigger;

        titleEl.textContent = trigger.getAttribute('data-title') || 'Event';
        // Show the server-formatted temple-timezone datetime directly (no second
        // client-side format), so the popup matches the event's grid cell exactly.
        timeEl.textContent = trigger.getAttribute('data-when') || trigger.getAttribute('data-time') || '';

        var location = trigger.getAttribute('data-location') || '';
        locationEl.textContent = location ? '📍 ' + location : '';
        locationEl.hidden = !location;

        membersEl.hidden = trigger.getAttribute('data-visibility') !== 'members';

        var description = trigger.getAttribute('data-description') || '';
        descriptionEl.textContent = description;
        descriptionEl.hidden = !description;

        var streamId = trigger.getAttribute('data-stream-id');
        if (streamId) {
            streamLink.href = '/streams/' + encodeURIComponent(streamId);
            streamLink.hidden = false;
        } else {
            streamLink.hidden = true;
            streamLink.removeAttribute('href');
        }

        modal.removeAttribute('hidden');
        closeBtn.focus();
    }

    function closeModal() {
        modal.setAttribute('hidden', '');
        // Return focus to the event that opened the dialog so keyboard/SR users aren't
        // dropped at the top of the document.
        if (lastTrigger && typeof lastTrigger.focus === 'function') {
            lastTrigger.focus();
        }
        lastTrigger = null;
    }

    grid.addEventListener('click', function (event) {
        var trigger = event.target.closest('.calendar-event-trigger');
        if (trigger) {
            openModal(trigger);
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // Clicking the dimmed overlay (outside the content) closes the dialog.
    modal.addEventListener('click', function (event) {
        if (event.target === modal) {
            closeModal();
        }
    });

    // a11y: Escape closes, and Tab is trapped within the dialog while it's open.
    modal.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeModal();
            return;
        }
        if (event.key !== 'Tab') {
            return;
        }
        var focusable = Array.from(
            modal.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])')
        ).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
        if (focusable.length === 0) {
            return;
        }
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
})();
