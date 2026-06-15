/**
 * Curated list of the temple's public Facebook videos for the "Past Services" page.
 *
 * This is the MVP / Board-demo source (PAST_VIDEO_SOURCE defaults to "curated") and
 * the runtime fallback when the Graph API source is unavailable. Each entry's `url`
 * must be a PUBLIC facebook.com / fb.watch video URL — CuratedSource validates it
 * with StreamingService.isAllowedProviderUrl and skips anything else.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  ⚠️  DEMO PRECONDITION — REPLACE THE EXAMPLES BELOW WITH REAL VIDEO URLS.
 *  The entries here are example-shaped placeholders so the page renders during
 *  development. Before the Board demo, an owner must paste 2–4 real public
 *  service-video URLs from the temple page (https://www.facebook.com/share/18jfSPTgMw/):
 *  open a past service video on Facebook, copy its URL (the
 *  `https://www.facebook.com/<page>/videos/<id>/` or `.../watch/?v=<id>` form —
 *  NOT the `share/` link, which does not embed), and replace the examples.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Shape per entry: { url, title, date (ISO), description }. `title`/`description`
 * are optional — CuratedSource derives a sensible title when absent.
 */
module.exports = [
    {
        url: 'https://www.facebook.com/watch/?v=1000000000000001',
        title: 'Kabbalat Shabbat Service',
        date: '2026-05-29T19:00:00.000Z',
        description: 'Friday evening Shabbat service from Temple B\'nai Israel.'
    },
    {
        url: 'https://www.facebook.com/watch/?v=1000000000000002',
        title: 'Shabbat Morning Service',
        date: '2026-05-23T10:00:00.000Z',
        description: 'Saturday morning Shabbat service from Temple B\'nai Israel.'
    }
];
