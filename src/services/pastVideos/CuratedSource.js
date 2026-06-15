const PastVideoSource = require('./PastVideoSource');
const StreamingService = require('../StreamingService');
const curatedVideos = require('./curatedVideos');
const logger = require('../../utils/logger');

/**
 * CuratedSource — serves a committed list of Facebook video URLs (curatedVideos.js),
 * normalized identically to the Graph source. It is the MVP default and the runtime
 * fallback. URLs are validated to facebook.com / fb.watch (the same gate the live
 * stream uses) so a malformed entry can never become an arbitrary iframe src.
 */
class CuratedSource extends PastVideoSource {
    async listVideos() {
        const entries = Array.isArray(curatedVideos) ? curatedVideos : [];

        const normalized = entries
            .map((entry) => this._normalize(entry))
            .filter(Boolean);

        // Newest-first by date; entries with an unparseable date sort last.
        normalized.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return normalized;
    }

    _normalize(entry) {
        if (!entry || typeof entry.url !== 'string') {
            logger.warn('CuratedSource skipping entry without a url');
            return null;
        }
        if (!StreamingService.isAllowedProviderUrl(entry.url)) {
            logger.warn('CuratedSource skipping non-facebook.com url', { url: entry.url });
            return null;
        }

        const date = entry.date ? new Date(entry.date) : null;
        const isoDate = date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;

        return {
            id: entry.url,
            title: (entry.title && String(entry.title).trim()) || 'Past Service',
            date: isoDate,
            description: entry.description ? String(entry.description) : '',
            thumbnailUrl: entry.thumbnailUrl || null,
            embedUrl: StreamingService.convertToEmbedUrl(entry.url)
        };
    }
}

module.exports = CuratedSource;
