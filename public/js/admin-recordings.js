// admin-recordings.js — CSP-safe handlers for the recordings publish page.
// Replaces the former inline onclick="loadRecording(...)" / onclick="publishRecording()"
// with addEventListener bindings; the recording payload travels on data-recording.
document.addEventListener('DOMContentLoaded', function () {
    let currentRecording = null;

    function loadRecording(recordingData) {
        currentRecording = recordingData;
        document.getElementById('recordingProvider').value = recordingData.providerName;
        document.getElementById('recordingId').value = recordingData.providerRecordingId;
        document.getElementById('recordingProviderVideoUrl').value = recordingData.providerVideoUrl || '';
        document.getElementById('recordingPreviewUrl').value = recordingData.previewUrl || '';
        document.getElementById('recordingTitle').value = recordingData.title || '';
        document.getElementById('recordingServiceDate').value = new Date(recordingData.serviceDate).toISOString().slice(0, 16);
        document.getElementById('recordingTorahPortion').value = recordingData.torahPortion || '';
        document.getElementById('recordingDuration').value = recordingData.durationSeconds || '';
        document.getElementById('recordingDescription').value = recordingData.description || '';

        // Load preview if available
        if (recordingData.previewUrl) {
            document.getElementById('recordingPreview').innerHTML = `<iframe src="${recordingData.previewUrl}" width="100%" height="300" frameborder="0" allow="autoplay"></iframe>`;
        }
    }

    async function publishRecording() {
        const form = document.getElementById('publishRecordingForm');
        const formData = new FormData(form);

        const payload = {
            providerVideoUrl: formData.get('providerVideoUrl'),
            previewUrl: formData.get('previewUrl'),
            title: formData.get('title'),
            serviceDate: new Date(formData.get('serviceDate')).toISOString(),
            torahPortion: formData.get('torahPortion') || null,
            durationSeconds: parseInt(formData.get('durationSeconds'), 10),
            description: formData.get('description') || null
        };

        try {
            const response = await fetch(`/admin/recordings/${formData.get('provider')}/${formData.get('recordingId')}/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                alert('Error publishing recording: ' + (data.error || 'Unknown error'));
                return;
            }

            alert('Recording published successfully! Members will receive notification emails.');
            $('#editRecordingModal').modal('hide');
            location.reload();
        } catch (error) {
            console.error('Error publishing recording:', error);
            alert('Error publishing recording: ' + error.message);
        }
    }

    // Bind the per-row "Edit & Publish" buttons (payload from data-recording).
    document.querySelectorAll('.js-edit-recording').forEach(btn => {
        btn.addEventListener('click', function () {
            try {
                loadRecording(JSON.parse(this.dataset.recording));
            } catch (err) {
                console.error('Failed to parse recording data:', err);
            }
        });
    });

    // Bind the modal "Publish Recording" button.
    const publishBtn = document.getElementById('btn-publish-recording');
    if (publishBtn) {
        publishBtn.addEventListener('click', publishRecording);
    }

    // Auto-save draft every 30 seconds
    setInterval(() => {
        if (!currentRecording) return;
        const form = document.getElementById('publishRecordingForm');

        // Stop saving if the modal is hidden
        if (!$('#editRecordingModal').hasClass('show')) {
            currentRecording = null;
            return;
        }

        const formData = new FormData(form);

        const payload = {
            providerName: formData.get('provider'),
            providerRecordingId: formData.get('recordingId'),
            providerVideoUrl: formData.get('providerVideoUrl'),
            previewUrl: formData.get('previewUrl'),
            title: formData.get('title'),
            serviceDate: new Date(formData.get('serviceDate')).toISOString(),
            torahPortion: formData.get('torahPortion'),
            durationSeconds: parseInt(formData.get('durationSeconds'), 10) || 0,
            description: formData.get('description')
        };

        fetch('/admin/recordings/drafts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
            },
            body: JSON.stringify(payload)
        }).catch(err => console.error('Draft autosave failed:', err)); // Non-blocking
    }, 30000);

    // Clear currentRecording when modal is closed to stop pending autosaves
    $('#editRecordingModal').on('hidden.bs.modal', function () {
        currentRecording = null;
    });
});
