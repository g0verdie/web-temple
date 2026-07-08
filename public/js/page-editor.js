// page-editor.js — CSP-safe Quill init + actions for the admin page editor.
// Server values are read from the DOM (slug from the form's data-slug; existing
// content from a hidden #page-content-source textarea) — no inline script.
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('page-edit-form');
    const slug = form ? form.dataset.slug : '';
    // Global csurf protects every state-changing request; mirror login.js/contact-form.js
    // and send the layout's csrf-token meta as a CSRF-Token header on each write.
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    const quill = new Quill('#editor', {
        theme: 'snow',
        placeholder: 'Start typing your page content here...',
        modules: {
            // Only controls whose output survives sanitizeHtml() on save:
            // blockquote/code-block get unwrapped and the image button inserts
            // data: URIs the sanitizer strips (no upload endpoint exists yet).
            // Images enter content as hand-authored HTML until an image
            // pipeline lands.
            toolbar: [
                ['bold', 'italic', 'underline'],
                ['link'],
                [{ 'header': 2 }, { 'header': 3 }],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['clean']
            ]
        }
    });

    // Load existing content from the hidden source element (escaped on the server,
    // decoded back to its original HTML by the textarea's .value).
    const source = document.getElementById('page-content-source');
    const existingContent = source ? source.value : '';
    if (existingContent) {
        quill.root.innerHTML = existingContent;
    }

    // Update hidden input with editor content
    function updateContent() {
        document.getElementById('page-content').value = quill.root.innerHTML;
    }

    quill.on('text-change', updateContent);

    // Save button
    document.getElementById('btn-save').addEventListener('click', async function () {
        updateContent();
        const title = document.getElementById('page-title').value;
        const content = document.getElementById('page-content').value;

        try {
            const response = await fetch(`/admin/pages/${slug}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken,
                },
                body: JSON.stringify({ title, content })
            });

            const data = await response.json();
            if (data.success) {
                alert('Page saved successfully!');
            } else {
                alert('Error saving page: ' + data.error);
            }
        } catch (error) {
            alert('Error saving page: ' + error.message);
        }
    });

    // Preview button
    document.getElementById('btn-preview').addEventListener('click', function () {
        updateContent();
        const content = document.getElementById('page-content').value;
        const title = document.getElementById('page-title').value;

        const previewWindow = window.open('', 'preview', 'width=800,height=600');
        previewWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Preview: ${title}</title>
            <style>
              body { font-family: sans-serif; margin: 2rem; color: #333; }
              h2 { color: #1a3a52; margin-top: 1.5rem; }
              h3 { color: #2d5a7b; margin-top: 1.25rem; }
              a { color: #c9a961; }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <div class="content">${content}</div>
          </body>
          </html>
        `);
    });

    // Cancel button
    document.getElementById('btn-cancel').addEventListener('click', function () {
        if (confirm('Discard changes?')) {
            window.history.back();
        }
    });

    // Publish button
    document.getElementById('btn-publish')?.addEventListener('click', async function () {
        try {
            const response = await fetch(`/admin/pages/${slug}/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken,
                },
                body: JSON.stringify({ published: true })
            });

            const data = await response.json();
            if (data.success) {
                alert('Page published successfully!');
                location.reload();
            } else {
                alert('Error publishing page: ' + data.error);
            }
        } catch (error) {
            alert('Error publishing page: ' + error.message);
        }
    });

    // Unpublish button
    document.getElementById('btn-unpublish')?.addEventListener('click', async function () {
        if (!confirm('Are you sure you want to unpublish this page?')) {
            return;
        }

        try {
            const response = await fetch(`/admin/pages/${slug}/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken,
                },
                body: JSON.stringify({ published: false })
            });

            const data = await response.json();
            if (data.success) {
                alert('Page unpublished successfully!');
                location.reload();
            } else {
                alert('Error unpublishing page: ' + data.error);
            }
        } catch (error) {
            alert('Error unpublishing page: ' + error.message);
        }
    });

    // Restore version buttons
    document.querySelectorAll('.restore-version-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
            const version = this.dataset.version;
            if (!confirm(`Restore to version ${version}? This will create a new version with the old content.`)) {
                return;
            }

            try {
                const response = await fetch(`/admin/pages/${slug}/restore/${version}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken,
                    },
                    body: JSON.stringify({})
                });

                const data = await response.json();
                if (data.success) {
                    alert(`Restored to version ${version}!`);
                    location.reload();
                } else {
                    alert('Error restoring version: ' + data.error);
                }
            } catch (error) {
                alert('Error restoring version: ' + error.message);
            }
        });
    });
});
