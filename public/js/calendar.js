/* Public calendar keyboard-nav enhancement (CSP-safe).
 * Month navigation works without JS (plain links); this adds left/right arrow
 * shortcuts to jump between months when the focus is not in an input. */
(function () {
  'use strict';

  document.addEventListener('keydown', function (event) {
    var tag = (event.target && event.target.tagName) ? event.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      var prev = document.querySelector('.calendar-month-nav a[rel="prev"]');
      if (prev) { window.location.href = prev.getAttribute('href'); }
    } else if (event.key === 'ArrowRight') {
      var next = document.querySelector('.calendar-month-nav a[rel="next"]');
      if (next) { window.location.href = next.getAttribute('href'); }
    }
  });
})();
