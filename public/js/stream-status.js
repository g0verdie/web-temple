(function() {
    'use strict';

    const ALLOWED_STATUSES = new Set(['live', 'upcoming', 'offline', 'error']);
    const DEFAULT_FALLBACK_URL = 'https://www.facebook.com/TempleBnaiIsrael';
    const CLIENT_REFRESH_ERROR_STATE = {
        status: 'error',
        statusLabel: 'Stream Error',
        fallbackUrl: DEFAULT_FALLBACK_URL,
        message: 'We are having trouble refreshing livestream status. Please watch directly on Facebook.'
    };

    const escapeHtml = (value) => {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const isHostOrSubdomain = (hostname, rootDomain) => {
        return hostname === rootDomain || hostname.endsWith(`.${rootDomain}`);
    };

    const sanitizeExternalUrl = (value) => {
        if (!value) {
            return null;
        }

        try {
            const url = new URL(value);
            if (url.protocol !== 'https:') {
                return null;
            }

            if (!isHostOrSubdomain(url.hostname, 'facebook.com') && url.hostname !== 'fb.watch') {
                return null;
            }

            return url.toString();
        } catch (error) {
            return null;
        }
    };

    const sanitizeStream = (stream) => {
        const status = ALLOWED_STATUSES.has(stream?.status) ? stream.status : 'offline';

        return {
            status,
            statusLabel: escapeHtml(stream?.statusLabel || ''),
            title: escapeHtml(stream?.title || ''),
            message: escapeHtml(stream?.message || ''),
            scheduledStart: stream?.scheduledStart || null,
            countdownTarget: stream?.countdownTarget || stream?.scheduledStart || null,
            embedUrl: sanitizeExternalUrl(stream?.embedUrl),
            watchUrl: sanitizeExternalUrl(stream?.watchUrl),
            fallbackUrl: sanitizeExternalUrl(stream?.fallbackUrl),
            archiveCta: stream?.archiveCta === true
        };
    };

    const buildStatusBadgeHtml = (safeStream) => {
        if (!safeStream.statusLabel) {
            return '';
        }

        return `<span class="stream-badge stream-badge--${safeStream.status}" role="status" aria-live="polite" aria-atomic="true" aria-label="${safeStream.statusLabel}">${safeStream.statusLabel}</span>`;
    };

    const buildLiveCardHtml = (safeStream) => {
        return `
            <div class="stream-card">
                <div class="stream-player-frame">
                    <iframe
                        src="${safeStream.embedUrl}"
                        title="${safeStream.title || ''} livestream player"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowfullscreen
                        loading="eager"
                        referrerpolicy="no-referrer">
                    </iframe>
                </div>
                <div class="stream-details">
                    <p class="stream-title">${safeStream.title || ''}</p>
                    ${safeStream.message ? `<p class="stream-helper" role="status" aria-live="polite" aria-atomic="true">${safeStream.message}</p>` : ''}
                    ${safeStream.watchUrl ? `<a href="${safeStream.watchUrl}" class="stream-link">Watch on Facebook</a>` : ''}
                </div>
            </div>
        `;
    };

    const buildFallbackCardHtml = (safeStream) => {
        let upcomingHtml = '';
        if (safeStream.status === 'upcoming' && safeStream.scheduledStart) {
            const scheduledDate = new Date(safeStream.scheduledStart);
            const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' };
            const formatted = Number.isNaN(scheduledDate.getTime())
                ? ''
                : scheduledDate.toLocaleDateString('en-US', opts);

            upcomingHtml = `
                ${formatted ? `<p class="stream-schedule">Next scheduled stream: ${escapeHtml(formatted)}</p>` : ''}
                <div class="stream-countdown" data-countdown-target="${escapeHtml(safeStream.countdownTarget || '')}" role="status" aria-live="polite" aria-atomic="true"></div>
            `;
        }

        return `
            <div class="stream-card stream-card--fallback">
                ${safeStream.title ? `<p class="stream-title">${safeStream.title}</p>` : ''}
                <p class="stream-helper" role="status" aria-live="polite" aria-atomic="true">${safeStream.message || ''}</p>
                ${upcomingHtml}
                ${safeStream.status === 'error' && safeStream.fallbackUrl ? `<a href="${safeStream.fallbackUrl}" class="stream-link cta-button">Watch on Facebook</a>` : ''}
                ${safeStream.status === 'offline' && safeStream.archiveCta ? '<a href="/archive" class="stream-link cta-button">View Recordings</a>' : ''}
            </div>
        `;
    };

    const replaceStreamCard = (container, cardMarkup) => {
        const currentCard = container.querySelector('.stream-card');
        if (currentCard) {
            currentCard.outerHTML = cardMarkup;
            return;
        }

        container.insertAdjacentHTML('beforeend', cardMarkup);
    };

    const updateStatusBadge = (container, safeStream) => {
        const header = container.querySelector('.stream-header');
        if (!header) {
            return;
        }

        const existingBadge = header.querySelector('.stream-badge');

        if (!safeStream.statusLabel) {
            if (existingBadge) {
                existingBadge.remove();
            }
            return;
        }

        if (existingBadge) {
            existingBadge.className = `stream-badge stream-badge--${safeStream.status}`;
            existingBadge.setAttribute('role', 'status');
            existingBadge.setAttribute('aria-live', 'polite');
            existingBadge.setAttribute('aria-atomic', 'true');
            existingBadge.setAttribute('aria-label', safeStream.statusLabel);
            existingBadge.textContent = safeStream.statusLabel;
            return;
        }

        header.insertAdjacentHTML('beforeend', buildStatusBadgeHtml(safeStream));
    };

    const updateLiveCard = (container, safeStream) => {
        const currentIframe = container.querySelector('.stream-player-frame iframe');
        const currentSrc = currentIframe ? currentIframe.getAttribute('src') : null;

        if (!currentIframe || currentSrc !== safeStream.embedUrl) {
            replaceStreamCard(container, buildLiveCardHtml(safeStream));
            return;
        }

        const title = container.querySelector('.stream-title');
        if (title) {
            title.textContent = safeStream.title || '';
        }

        const details = container.querySelector('.stream-details');
        if (!details) {
            return;
        }

        let helper = details.querySelector('.stream-helper');
        if (safeStream.message) {
            if (!helper) {
                helper = document.createElement('p');
                helper.className = 'stream-helper';
                helper.setAttribute('role', 'status');
                helper.setAttribute('aria-live', 'polite');
                helper.setAttribute('aria-atomic', 'true');
                const watchLink = details.querySelector('.stream-link');
                if (watchLink) {
                    details.insertBefore(helper, watchLink);
                } else {
                    details.appendChild(helper);
                }
            }
            helper.textContent = safeStream.message;
        } else if (helper) {
            helper.remove();
        }

        let watchLink = details.querySelector('.stream-link');
        if (safeStream.watchUrl) {
            if (!watchLink) {
                watchLink = document.createElement('a');
                watchLink.className = 'stream-link';
                watchLink.textContent = 'Watch on Facebook';
                details.appendChild(watchLink);
            }
            watchLink.setAttribute('href', safeStream.watchUrl);
        } else if (watchLink) {
            watchLink.remove();
        }
    };

    // Countdown logic for the main next service
    const initServiceCountdown = () => {
        const countdownTimer = document.querySelector('.countdown-timer');
        if (!countdownTimer) return;

        const serviceDate = new Date(countdownTimer.dataset.serviceDate);

        function updateCountdown() {
            const now = new Date();
            const diff = serviceDate - now;

            if (diff <= 0) {
                const elDays = document.getElementById('countdown-days');
                if (elDays) {
                    elDays.textContent = '0';
                    document.getElementById('countdown-hours').textContent = '0';
                    document.getElementById('countdown-minutes').textContent = '0';
                    document.getElementById('countdown-seconds').textContent = '0';
                }
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const elDays = document.getElementById('countdown-days');
            if (elDays) {
                elDays.textContent = days;
                document.getElementById('countdown-hours').textContent = hours;
                document.getElementById('countdown-minutes').textContent = minutes;
                document.getElementById('countdown-seconds').textContent = seconds;
            }
        }

        setInterval(updateCountdown, 1000);
        updateCountdown();
    };

    // Stream Status Polling
    const fetchStreamStatus = async () => {
        try {
            const res = await fetch('/api/stream/status');
            if (!res.ok) throw new Error('Network response was not ok');
            return await res.json();
        } catch (error) {
            console.error('Error fetching stream status:', error);
            return null;
        }
    };

    const updateStreamDOM = (stream) => {
        const container = document.getElementById('live-stream-container');
        if (!container) return;

        const safeStream = sanitizeStream(stream);

        if (!container.querySelector('.stream-header')) {
            container.innerHTML = `
                <div class="stream-header">
                    <h3 id="stream-heading" class="section-title">Live Stream</h3>
                    ${buildStatusBadgeHtml(safeStream)}
                </div>
            `;
        }

        updateStatusBadge(container, safeStream);

        if (safeStream.status === 'live' && safeStream.embedUrl) {
            updateLiveCard(container, safeStream);
            return;
        }

        replaceStreamCard(container, buildFallbackCardHtml(safeStream));
    };

    const renderMiniCountdown = () => {
        const el = document.querySelector('.stream-countdown[data-countdown-target]');
        if (!el) return;
        const targetStr = el.dataset.countdownTarget;
        if (!targetStr) return;
        const target = new Date(targetStr);
        if (Number.isNaN(target.getTime())) return;
        const diff = target - new Date();
        
        if (diff <= 0) {
            el.textContent = "Starting soon...";
            return;
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        let text = [];
        if (days > 0) text.push(`${days}d`);
        if (hours > 0 || days > 0) text.push(`${hours}h`);
        text.push(`${minutes}m`);
        text.push(`${seconds}s`);
        
        el.textContent = `Starts in: ${text.join(' ')}`;
    };

    const initStreamPolling = () => {
        let consecutiveFailures = 0;

        const poll = async () => {
            const stream = await fetchStreamStatus();
            if (stream) {
                consecutiveFailures = 0;
                updateStreamDOM(stream);
                return;
            }

            consecutiveFailures += 1;
            if (consecutiveFailures >= 2) {
                updateStreamDOM(CLIENT_REFRESH_ERROR_STATE);
            }
        };

        // Refresh once immediately so users do not wait for first interval.
        poll();

        // Poll every 30 seconds
        setInterval(poll, 30000);

        // Countdown every 1 second
        setInterval(renderMiniCountdown, 1000);
        renderMiniCountdown();
    };

    document.addEventListener('DOMContentLoaded', () => {
        initServiceCountdown();
        initStreamPolling();
    });

})();
