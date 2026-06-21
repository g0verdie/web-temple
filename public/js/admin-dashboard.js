// admin-dashboard.js — polls the dashboard metrics endpoint every 30s (Story 9.1)
// and updates the metric tiles in place. CSP-safe: external file, no inline handlers.
(function () {
    'use strict';

    var REFRESH_MS = 30000;
    var section = document.querySelector('[data-metrics-endpoint]');
    if (!section) return;
    var endpoint = section.getAttribute('data-metrics-endpoint');

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el && value !== undefined && value !== null) {
            el.textContent = value;
        }
    }

    function formatMoneyCents(cents) {
        var n = Number(cents) || 0;
        return '$' + (n / 100).toFixed(2);
    }

    function formatDate(iso) {
        if (!iso) return '—';
        var d = new Date(iso);
        return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
    }

    function refresh() {
        fetch(endpoint, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (data) {
                if (!data) return;
                setText('metric-new-members', data.newMembersThisMonth);
                setText('metric-donations', formatMoneyCents(data.donationsMtdCents));
                setText('metric-active-chat', data.activeChatUsers);
                setText('metric-pending-messages', data.pendingMessages);
                setText('metric-uptime', data.serverUptime);
                setText('metric-last-backup', formatDate(data.lastBackupAt));
                setText('priority-pending-chat', data.pendingChat);
                setText('priority-pending-messages', data.pendingMessages);
                setText('priority-pending-approvals', data.pendingApprovals);
            })
            .catch(function () { /* transient failure — keep last-known values */ });
    }

    var timer = setInterval(refresh, REFRESH_MS);
    window.addEventListener('beforeunload', function () { clearInterval(timer); });
})();
