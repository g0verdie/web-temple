// Past Services lightbox: clicking a card swaps the single shared player's iframe
// src instead of rendering one Facebook iframe per card. External file (no inline
// script) to satisfy the strict CSP.
(function () {
    'use strict';

    var iframe = document.getElementById('watch-iframe');
    if (!iframe) {
        return; // empty state — nothing to wire up
    }

    var nowPlaying = document.getElementById('watch-now-playing');
    var player = document.getElementById('watch-player');
    var buttons = document.querySelectorAll('.watch-card__btn');

    buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var url = btn.getAttribute('data-embed-url');
            if (!url) {
                return;
            }
            var title = btn.getAttribute('data-title') || '';

            iframe.src = url;
            iframe.title = title;
            if (nowPlaying) {
                nowPlaying.textContent = title;
            }

            buttons.forEach(function (other) {
                other.removeAttribute('aria-current');
            });
            btn.setAttribute('aria-current', 'true');

            if (player && typeof player.focus === 'function') {
                player.focus();
            }
        });
    });
})();
