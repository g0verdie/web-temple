const CacheService = require('../CacheService');
const emailService = require('../emailService');
const logger = require('../../utils/logger');
const { getSource } = require('./index');
const CuratedSource = require('./CuratedSource');

const LIST_KEY = 'pastVideos:list';          // success cache: { videos, degraded:false }
const FALLBACK_KEY = 'pastVideos:fallback';  // negative cache: { videos, degraded:true }
const LASTGOOD_KEY = 'pastVideos:lastgood';  // stale-while-revalidate: videos[]
const LOCK_KEY = 'pastVideos:refreshing';    // single-flight refresh lock
const ALERTED_KEY = 'pastVideos:alerted';    // fire-once operator-alert guard

const SUCCESS_TTL = parseInt(process.env.PAST_VIDEO_CACHE_TTL_SECONDS, 10) || 21600; // 6h
const FALLBACK_TTL = parseInt(process.env.PAST_VIDEO_FALLBACK_TTL_SECONDS, 10) || 900; // 15m
const LASTGOOD_TTL = 604800; // 7d — survives the success TTL so lock-losers serve real data
const LOCK_TTL = 10;         // seconds
const ALERT_DEDUPE_TTL = 3600; // 1h

/**
 * PastVideoService — the single entry point the /watch controller calls.
 *
 * Reads cache first (success, then negative) so the page never fetches per request
 * (R7). On a miss, a single-flight lock funnels one refresh while concurrent requests
 * serve the last-known-good list (no stampede). When the active (graph) source fails,
 * it logs a durable warning, falls back to the curated list, caches that degraded
 * result briefly, and alerts the operator at most once an hour — never throwing, so
 * the page degrades instead of 500-ing (R8).
 */
class PastVideoService {
    async getVideos() {
        const cached = await CacheService.get(LIST_KEY);
        if (cached) return cached;

        const fallbackCached = await CacheService.get(FALLBACK_KEY);
        if (fallbackCached) return fallbackCached;

        // The curated source is an in-memory read — no network, no stampede — so it
        // skips the single-flight lock entirely. That also avoids the cold-start
        // "lock-loser sees a blank page" race for the MVP default source.
        if (getSource() instanceof CuratedSource) {
            return this._loadAndCache();
        }

        // Network-backed (graph) source: single-flight so concurrent misses don't
        // stampede the rate-limited Graph API.
        const gotLock = await CacheService.acquireLock(LOCK_KEY, LOCK_TTL);
        if (!gotLock) {
            // Another request is refreshing. Serve last-good if we have it, else the
            // curated fallback — never a blank, non-degraded page at cold start.
            const lastGood = await CacheService.get(LASTGOOD_KEY);
            if (Array.isArray(lastGood) && lastGood.length) {
                return { videos: lastGood, degraded: false };
            }
            const fallbackVideos = await this._curatedFallback();
            return { videos: fallbackVideos, degraded: fallbackVideos.length > 0 };
        }

        try {
            return await this._loadAndCache();
        } finally {
            await CacheService.del(LOCK_KEY);
        }
    }

    async _loadAndCache() {
        try {
            const videos = await getSource().listVideos();
            // An empty result is not authoritative (every video private/processing, or
            // a genuinely empty page) — cache it only briefly and don't poison lastgood,
            // so one empty refresh can't pin a blank page for the full 6h success TTL.
            if (!videos.length) {
                const emptyResult = { videos: [], degraded: false };
                await CacheService.set(FALLBACK_KEY, emptyResult, FALLBACK_TTL);
                return emptyResult;
            }
            const result = { videos, degraded: false };
            await CacheService.set(LIST_KEY, result, SUCCESS_TTL);
            await CacheService.set(LASTGOOD_KEY, videos, LASTGOOD_TTL);
            return result;
        } catch (err) {
            // Durable signal, independent of email (which is best-effort / mock in dev).
            logger.warn('PastVideoService source failed; serving curated fallback', {
                tokenInvalid: !!(err && err.tokenInvalid),
                error: err && err.message
            });

            const videos = await this._curatedFallback();
            const result = { videos, degraded: true };
            await CacheService.set(FALLBACK_KEY, result, FALLBACK_TTL);
            await this._alertOperator(err);
            return result;
        }
    }

    async _curatedFallback() {
        // If curated is the active source and it just failed, re-calling it would only
        // fail again — decide off the live source object, not a duplicated env parse.
        if (getSource() instanceof CuratedSource) return [];
        try {
            return await new CuratedSource().listVideos();
        } catch (curatedErr) {
            logger.warn('PastVideoService curated fallback also failed', { error: curatedErr && curatedErr.message });
            return [];
        }
    }

    async _alertOperator(err) {
        // Atomic fire-once-per-hour guard so a broken token doesn't email on every miss.
        // failClosed: a Redis outage must NOT be read as "first alert" (that would email
        // the operator on every request during an incident) — suppress instead.
        const firstAlert = await CacheService.acquireLock(ALERTED_KEY, ALERT_DEDUPE_TTL, { failClosed: true });
        if (!firstAlert) return;

        const recipient = process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL;
        if (!recipient) return;

        // Fixed template — no err.message, no URL, nothing token-derived.
        const reason = err && err.tokenInvalid
            ? 'Facebook Page Access Token invalid or expired (Graph error 190)'
            : 'Facebook Graph API fetch failure';

        try {
            await emailService.sendEmail({
                to: recipient,
                subject: '[Temple B\'nai Israel] Past Services video feed degraded',
                text: [
                    'The public Past Services page could not refresh videos from Facebook.',
                    '',
                    `Reason: ${reason}`,
                    `Time: ${new Date().toISOString()}`,
                    '',
                    'The page is serving the curated fallback in the meantime.',
                    'Remediation: verify FACEBOOK_PAGE_ACCESS_TOKEN — regenerate it if a',
                    'page admin recently changed their password or lost the admin role.'
                ].join('\n')
            });
        } catch (mailErr) {
            logger.warn('PastVideoService operator alert email failed', { error: mailErr && mailErr.message });
        }
    }
}

module.exports = new PastVideoService();
module.exports.CACHE_KEYS = { LIST_KEY, FALLBACK_KEY, LASTGOOD_KEY, LOCK_KEY, ALERTED_KEY };
