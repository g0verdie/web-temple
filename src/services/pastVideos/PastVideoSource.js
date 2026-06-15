/**
 * PastVideoSource — the interface the public "Past Services" page is written against.
 *
 * Implementations: CuratedSource (a committed list of Facebook video URLs — the MVP
 * default and the API fallback) and GraphApiSource (auto-pull from the temple's
 * Facebook Page once a Page Access Token lands). Both drop in behind this same seam,
 * selected by the PAST_VIDEO_SOURCE env var (see index.js). Mirrors the
 * swappable-provider pattern in src/services/payments.
 *
 * Normalized contract — every implementation's listVideos() resolves to an array of:
 *   {
 *     id:           string,   // stable per-video id
 *     title:        string,   // display title (never empty)
 *     date:         string,   // ISO 8601
 *     description:  string,   // may be ''
 *     thumbnailUrl: ?string,  // null → the view renders a placeholder
 *     embedUrl:     string    // the CSP-safe plugins/video.php form
 *   }
 * ordered newest-first. The embedUrl is always built via the exported
 * StreamingService.convertToEmbedUrl so live and past-video embeds stay identical.
 */
class PastVideoSource {
    /**
     * List the page's past videos, normalized and newest-first.
     * @returns {Promise<Array<object>>}
     */
    async listVideos() {
        throw new Error('PastVideoSource.listVideos not implemented');
    }
}

module.exports = PastVideoSource;
