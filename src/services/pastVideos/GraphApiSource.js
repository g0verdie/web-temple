const PastVideoSource = require('./PastVideoSource');
const StreamingService = require('../StreamingService');
const logger = require('../../utils/logger');

const DEFAULT_GRAPH_VERSION = 'v21.0';
const PAGE_SIZE = 50;
const TITLE_MAX_LEN = 80;

/**
 * GraphApiSource — auto-pulls the temple page's videos from the Facebook Graph API.
 *
 * Server-side fetch (no CSP connect-src change). The Page Access Token is sent in the
 * Authorization header, never the query string, so a logged URL can't leak it. The
 * embed URL is built from the numeric video `id` (share/permalink URLs do not embed)
 * and wrapped via the exported StreamingService.convertToEmbedUrl. Token/fetch
 * failures throw a tagged Error (err.tokenInvalid for Graph code 190) so the service
 * layer (PastVideoService) can fall back + alert — this source never silently empties.
 */
class GraphApiSource extends PastVideoSource {
    async listVideos() {
        const pageId = process.env.FACEBOOK_PAGE_ID;
        const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
        const version = process.env.FACEBOOK_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION;

        if (!pageId || !token) {
            const err = new Error('GraphApiSource missing FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN');
            err.tokenInvalid = true;
            throw err;
        }

        const url = `https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}/videos`
            + `?fields=id,description,created_time,picture,status&limit=${PAGE_SIZE}`;

        let response;
        try {
            response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        } catch (cause) {
            // Network failure — never log the token (it is in the header, not the URL).
            logger.warn('GraphApiSource fetch failed', { error: cause.message });
            throw new Error('GraphApiSource fetch failed');
        }

        const body = await response.json().catch(() => ({}));

        if (!response.ok || body.error) {
            const code = body.error && body.error.code;
            const err = new Error(`GraphApiSource error (status ${response.status}, code ${code})`);
            if (code === 190) {
                err.tokenInvalid = true;
            }
            throw err;
        }

        const items = Array.isArray(body.data) ? body.data : [];
        const normalized = items
            .map((item) => this._normalize(item, pageId))
            .filter(Boolean);

        normalized.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return normalized;
    }

    _normalize(item, pageId) {
        if (!item || typeof item.id !== 'string') {
            return null;
        }
        // Only public, finished videos embed; private/unlisted/processing render blank.
        if (item.status && item.status.video_status && item.status.video_status !== 'ready') {
            return null;
        }
        // The canonical embed URL is built from the numeric id; reject anything else.
        if (!/^\d+$/.test(item.id)) {
            logger.warn('GraphApiSource skipping non-numeric video id', { id: item.id });
            return null;
        }

        const date = item.created_time ? new Date(item.created_time) : null;
        const isoDate = date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
        const canonicalUrl = `https://www.facebook.com/${encodeURIComponent(pageId)}/videos/${item.id}/`;

        return {
            id: item.id,
            title: this._deriveTitle(item.description, date),
            date: isoDate,
            description: item.description ? String(item.description) : '',
            thumbnailUrl: item.picture || null,
            embedUrl: StreamingService.convertToEmbedUrl(canonicalUrl)
        };
    }

    _deriveTitle(description, date) {
        const firstLine = (description || '').split('\n')[0].trim();
        if (firstLine) {
            return firstLine.length > TITLE_MAX_LEN
                ? `${firstLine.slice(0, TITLE_MAX_LEN - 1).trimEnd()}…`
                : firstLine;
        }
        if (date && !Number.isNaN(date.getTime())) {
            return `Service — ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
        }
        return 'Past Service';
    }
}

module.exports = GraphApiSource;
