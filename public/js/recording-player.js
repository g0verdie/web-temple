/**
 * Recording playback progressive enhancement (Story 3.5).
 *
 * The page renders a fully-functional native <video controls> first; this
 * script only wires up the playback-rate radios and the captions toggle when
 * present. If the script never loads the page still satisfies AC4 (rate is
 * still controllable via the browser's own context menu) and AC3 falls back
 * to the always-visible affordance.
 */
(function () {
    'use strict';

    var player = document.getElementById('recording-player');
    if (!player) {
        return;
    }

    // Playback speed radios.
    var rateInputs = document.querySelectorAll('[data-playback-rate]');
    Array.prototype.forEach.call(rateInputs, function (input) {
        input.addEventListener('change', function () {
            var rate = parseFloat(input.value);
            if (!isNaN(rate) && rate > 0) {
                player.playbackRate = rate;
            }
        });
    });

    // Captions toggle (only present when caption_format = 'webvtt').
    var toggle = document.querySelector('[data-captions-toggle]');
    var stateLabel = document.querySelector('[data-captions-state]');
    if (toggle && player.textTracks && player.textTracks.length > 0) {
        var track = player.textTracks[0];
        // Force showing on load so the default attribute is honored across browsers.
        track.mode = 'showing';

        toggle.addEventListener('click', function () {
            var nextOn = track.mode !== 'showing';
            track.mode = nextOn ? 'showing' : 'hidden';
            toggle.setAttribute('aria-pressed', String(nextOn));
            if (stateLabel) {
                stateLabel.textContent = nextOn ? 'On' : 'Off';
            }
        });
    }
})();
