/* Calendar admin enhancements (CSP-safe, no inline handlers):
 *  - live preview of title/description as the user types
 *  - location dropdown: reveal the custom field only when "Custom" is chosen
 *  - delete confirmation dialog
 * Progressive enhancement: the form works without JS. */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    // Location dropdown: show the custom text field only when "Custom" is selected.
    var locationSelect = document.querySelector('[data-location-select]');
    var locationCustom = document.querySelector('[data-location-custom]');
    if (locationSelect && locationCustom) {
      var syncLocation = function () {
        if (locationSelect.value === 'custom') {
          locationCustom.removeAttribute('hidden');
        } else {
          locationCustom.setAttribute('hidden', '');
        }
      };
      locationSelect.addEventListener('change', syncLocation);
      syncLocation();
    }

    // Live preview
    var titleInput = document.querySelector('[data-preview-source="title"]');
    var descInput = document.querySelector('[data-preview-source="description"]');
    var previewTitle = document.getElementById('preview-title');
    var previewDesc = document.getElementById('preview-description');

    if (titleInput && previewTitle) {
      titleInput.addEventListener('input', function () {
        previewTitle.textContent = titleInput.value || 'Your event title';
      });
    }
    if (descInput && previewDesc) {
      descInput.addEventListener('input', function () {
        previewDesc.textContent = descInput.value || 'Your description will appear here.';
      });
    }

    // Delete confirmation
    var forms = document.querySelectorAll('form.js-confirm-delete');
    forms.forEach(function (form) {
      form.addEventListener('submit', function (event) {
        var message = form.getAttribute('data-confirm') || 'Are you sure?';
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      });
    });
  });
})();
