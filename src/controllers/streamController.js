/**
 * controllers/streamController.js
 * Public single-stream view page (/streams/:id). Linked from the calendar event popup.
 * Read-only; no auth (streams are public). Embed is built only for a genuinely-live
 * stream with a valid provider URL, reusing StreamingService's embed/validation helpers.
 */

const StreamingService = require('../services/StreamingService');
const logger = require('../utils/logger');

// Stream status → label + badge modifier for the public page.
const STATUS_META = {
    scheduled: { label: 'Upcoming', badge: 'upcoming' },
    active: { label: 'Live now', badge: 'live' },
    completed: { label: 'Ended', badge: 'offline' },
    canceled: { label: 'Canceled', badge: 'offline' }
};

exports.getStreamPage = async (req, res) => {
    try {
        const stream = await StreamingService.getScheduledStreamById(req.params.id);
        if (!stream) {
            return res.status(404).render('404', { title: '404 - Stream Not Found' });
        }

        const hasValidUrl = StreamingService.isAllowedProviderUrl(stream.facebook_live_url);
        // Only embed a stream that's actually live with a valid provider URL; otherwise
        // the page shows status messaging (upcoming / ended / canceled).
        const embedUrl = (stream.status === 'active' && hasValidUrl)
            ? StreamingService.convertToEmbedUrl(stream.facebook_live_url)
            : null;
        const meta = STATUS_META[stream.status] || { label: 'Stream', badge: 'offline' };

        res.render('layout', {
            title: stream.title || 'Live Stream',
            bodyView: 'streams/show',
            stylesheets: ['/css/watch.css'],
            viewData: {
                stream,
                statusLabel: meta.label,
                statusBadge: meta.badge,
                embedUrl,
                watchUrl: hasValidUrl ? stream.facebook_live_url : null
            }
        });
    } catch (error) {
        logger.error('Error loading stream page:', error);
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load the stream.' });
    }
};
