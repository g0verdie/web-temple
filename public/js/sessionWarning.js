/**
 * Session Warning Poller
 * Polls the session status endpoint and displays a warning when the session is about to expire.
 */

(function () {
    const POLL_INTERVAL = 30000; // 30 seconds
    const WARNING_THRESHOLD = 60000; // 1 minute warning
    let warningElement = null;

    function createWarningBanner(message) {
        if (warningElement) return;

        warningElement = document.createElement('div');
        Object.assign(warningElement.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#ff9800',
            color: '#fff',
            padding: '15px 20px',
            borderRadius: '5px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            zIndex: '9999',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            maxWidth: '300px',
            borderLeft: '5px solid #e65100'
        });

        warningElement.innerHTML = `
            <strong style="display:block;margin-bottom:5px;">Session Warning</strong>
            <span>${message}</span>
            <button id="session-warning-dismiss" style="margin-top:10px;background:rgba(255,255,255,0.2);border:none;color:#fff;padding:5px 10px;border-radius:3px;cursor:pointer;width:100%;">Got it</button>
        `;

        document.body.appendChild(warningElement);

        document.getElementById('session-warning-dismiss').addEventListener('click', () => {
            if (warningElement) {
                warningElement.remove();
                warningElement = null;
            }
        });
    }

    async function checkSessionStatus() {
        try {
            const response = await fetch('/api/session/status', {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.status === 401) {
                // Session expired, reload page to trigger redirect
                window.location.reload();
                return;
            }

            if (response.ok) {
                const data = await response.json();

                // Show warning if less than 1 minute remaining
                if (data.remainingMs <= WARNING_THRESHOLD && data.remainingMs > 0) {
                    const seconds = Math.floor(data.remainingMs / 1000);
                    createWarningBanner(`Your session will expire in ${seconds} seconds due to inactivity. Unsaved progress will be lost. Refresh the page or navigate to keep your session active!`);
                } else if (warningElement) {
                    // Session was refreshed (mouse move triggered fetch or just normal page activity)
                    warningElement.remove();
                    warningElement = null;
                }
            }
        } catch (error) {
            console.error('Failed to check session status', error);
        }
    }

    // Ping immediately and start polling
    // Only check if we are not on the login page to avoid pinging while unauthenticated unexpectedly
    if (window.location.pathname !== '/login') {
        setInterval(checkSessionStatus, POLL_INTERVAL);
    }
})();
