/**
 * public/js/admin-announcements.js
 * CSP-safe external module for the announcement authoring UI:
 *  - minimal rich-text toolbar over a contenteditable body
 *  - client preview
 *  - localStorage autosave (30s) with restore-on-load
 *  - JSON fetch submit (create/edit)
 *  - list-page actions (feature / delete / restore) with confirmation
 * The server re-sanitizes body_html on write (the client preview is convenience only).
 */
(function () {
    'use strict';

    var AUTOSAVE_KEY = 'announcement-draft';
    var AUTOSAVE_MS = 30000;

    function getCsrf(root) {
        var meta = document.querySelector('meta[name="csrf-token"]');
        if (meta && meta.getAttribute('content')) {
            return meta.getAttribute('content');
        }
        return (root && root.dataset && root.dataset.csrf) || '';
    }

    function postJson(url, body, csrf) {
        var headers = { 'Content-Type': 'application/json' };
        if (csrf) {
            headers['CSRF-Token'] = csrf;
        }
        return fetch(url, {
            method: 'POST',
            headers: headers,
            body: body ? JSON.stringify(body) : undefined
        }).then(function (response) {
            return response.json().then(function (data) {
                if (!response.ok) {
                    var err = new Error((data && data.error) || 'Request failed');
                    err.status = response.status;
                    throw err;
                }
                return data;
            });
        });
    }

    function showMessage(el, message, type) {
        if (!el) {
            return;
        }
        el.textContent = message;
        el.className = 'form-message ' + (type || '');
    }

    // ---- Authoring form -----------------------------------------------------
    function initForm() {
        var wrap = document.querySelector('.announcement-form-wrap');
        if (!wrap) {
            return;
        }

        var form = document.getElementById('announcementForm');
        var titleInput = document.getElementById('announcementTitle');
        var body = document.getElementById('announcementBody');
        var message = document.getElementById('announcementFormMessage');
        var autosaveStatus = document.getElementById('autosaveStatus');
        var csrf = getCsrf(wrap);
        var id = wrap.dataset.id || '';
        var isEdit = !!id;

        // Toolbar commands.
        document.querySelectorAll('.rte-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var command = btn.dataset.command;
                body.focus();
                if (command === 'createLink') {
                    var url = window.prompt('Link URL (http/https/mailto):');
                    if (url) {
                        document.execCommand('createLink', false, url);
                    }
                } else if (command === 'insertImage') {
                    var src = window.prompt('Image URL (http/https):');
                    if (!src) {
                        return;
                    }
                    var alt = window.prompt('Alternative text (required for accessibility):');
                    if (!alt) {
                        window.alert('Image not inserted: alternative text is required.');
                        return;
                    }
                    document.execCommand('insertImage', false, src);
                    // execCommand cannot set alt; find the just-inserted img and set it.
                    var imgs = body.querySelectorAll('img[src="' + src + '"]:not([alt])');
                    if (imgs.length) {
                        imgs[imgs.length - 1].setAttribute('alt', alt);
                    }
                } else {
                    document.execCommand(command, false, null);
                }
            });
        });

        // Preview toggle.
        var previewToggle = document.getElementById('previewToggle');
        var preview = document.getElementById('announcementPreview');
        if (previewToggle && preview) {
            previewToggle.addEventListener('click', function () {
                var open = preview.hasAttribute('hidden');
                if (open) {
                    document.getElementById('previewTitle').textContent = titleInput.value || '(untitled)';
                    document.getElementById('previewBody').innerHTML = body.innerHTML;
                    preview.removeAttribute('hidden');
                } else {
                    preview.setAttribute('hidden', '');
                }
                previewToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        }

        // Autosave to localStorage (MVP — client-side only).
        var draftKey = AUTOSAVE_KEY + (isEdit ? ':' + id : ':new');

        if (!isEdit) {
            try {
                var saved = window.localStorage.getItem(draftKey);
                if (saved) {
                    var parsed = JSON.parse(saved);
                    if (parsed && (parsed.title || parsed.body) && window.confirm('Restore your unsaved draft?')) {
                        titleInput.value = parsed.title || '';
                        body.innerHTML = parsed.body || '';
                    } else if (parsed) {
                        window.localStorage.removeItem(draftKey);
                    }
                }
            } catch (e) { /* ignore corrupt drafts */ }
        }

        var autosaveTimer = window.setInterval(function () {
            try {
                window.localStorage.setItem(draftKey, JSON.stringify({ title: titleInput.value, body: body.innerHTML }));
                if (autosaveStatus) {
                    autosaveStatus.textContent = 'Draft saved locally at ' + new Date().toLocaleTimeString();
                }
            } catch (e) { /* storage full / disabled — non-blocking */ }
        }, AUTOSAVE_MS);

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var title = titleInput.value.trim();
            if (!title) {
                showMessage(message, 'Title is required.', 'error');
                return;
            }
            var payload = { title: title, body: body.innerHTML };
            var url = isEdit ? '/admin/announcements/' + id : '/admin/announcements';
            if (!isEdit) {
                var featuredEl = document.getElementById('announcementFeatured');
                payload.featured = !!(featuredEl && featuredEl.checked);
            }

            postJson(url, payload, csrf).then(function () {
                window.clearInterval(autosaveTimer);
                try { window.localStorage.removeItem(draftKey); } catch (e) { /* ignore */ }
                window.location.href = '/admin/announcements';
            }).catch(function (err) {
                showMessage(message, err.message || 'Unable to save announcement.', 'error');
            });
        });
    }

    // ---- List page actions --------------------------------------------------
    function initList() {
        var root = document.querySelector('.announcements-admin');
        if (!root) {
            return;
        }
        var csrf = getCsrf(root);
        var status = document.getElementById('announcementsStatus');

        root.addEventListener('click', function (event) {
            var btn = event.target.closest('[data-action]');
            if (!btn) {
                return;
            }
            var action = btn.dataset.action;
            var id = btn.dataset.id;

            if (action === 'delete') {
                if (!window.confirm('Delete "' + (btn.dataset.title || 'this announcement') + '"? It will be moved to the archive and removed from the homepage.')) {
                    return;
                }
                postJson('/admin/announcements/' + id + '/delete', {}, csrf)
                    .then(function () { window.location.reload(); })
                    .catch(function (err) { showMessage(status, err.message || 'Unable to delete.', 'error'); });
            } else if (action === 'restore') {
                postJson('/admin/announcements/' + id + '/restore', {}, csrf)
                    .then(function () { window.location.reload(); })
                    .catch(function (err) { showMessage(status, err.message || 'Unable to restore.', 'error'); });
            } else if (action === 'feature') {
                var makeFeatured = btn.dataset.featured !== 'true';
                if (makeFeatured && !window.confirm('Feature this announcement? Any other featured announcement will be unpinned.')) {
                    return;
                }
                postJson('/admin/announcements/' + id + '/feature', { featured: makeFeatured }, csrf)
                    .then(function () { window.location.reload(); })
                    .catch(function (err) { showMessage(status, err.message || 'Unable to update.', 'error'); });
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        initForm();
        initList();
    });
})();
