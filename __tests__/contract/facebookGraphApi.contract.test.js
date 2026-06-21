/**
 * Live contract test for the Facebook Graph API "Past Services" source.
 *
 * OPT-IN ONLY — skipped by default (including in CI). It hits the REAL Facebook
 * Graph API, so it needs real credentials and network access. Run it from a
 * later validation session, never in CI:
 *
 *   FB_LIVE_CONTRACT=1 \
 *   FACEBOOK_PAGE_ID=<numeric-page-id> \
 *   FACEBOOK_PAGE_ACCESS_TOKEN=<long-lived-page-token> \
 *   npx jest facebookGraphApi.contract
 *
 * This is the only automated layer that catches what the mocked unit tests cannot:
 * Graph response schema drift, a wrong scope/expired token, and the non-numeric
 * Page ID silent-failure (a vanity slug returns 200 with no embeddable videos).
 * See docs/qa/2026-06-21-facebook-integration-test-plan.md (Part B1).
 */
const GraphApiSource = require('../../src/services/pastVideos/GraphApiSource');

const RUN = process.env.FB_LIVE_CONTRACT === '1';
const describeMaybe = RUN ? describe : describe.skip;

describeMaybe('Facebook Graph API — live contract (opt-in)', () => {
    const source = new GraphApiSource();

    beforeAll(() => {
        if (!process.env.FACEBOOK_PAGE_ID || !process.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
            throw new Error(
                'FB_LIVE_CONTRACT=1 requires real FACEBOOK_PAGE_ID (numeric) and '
                + 'FACEBOOK_PAGE_ACCESS_TOKEN in the environment.'
            );
        }
    });

    it('returns embeddable, numeric-id videos for the configured page', async () => {
        const videos = await source.listVideos();

        expect(Array.isArray(videos)).toBe(true);
        // A numeric Page ID with published videos yields rows; an empty array here is
        // the classic vanity-slug / wrong-page symptom worth investigating.
        expect(videos.length).toBeGreaterThan(0);

        for (const v of videos) {
            expect(typeof v.id).toBe('string');
            expect(/^\d+$/.test(v.id)).toBe(true);
            expect(v.embedUrl).toContain('https://www.facebook.com/plugins/video.php?href=');
        }
    }, 15000);

    it('fails loudly (tokenInvalid), not silently empty, on a bad token', async () => {
        const realToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
        process.env.FACEBOOK_PAGE_ACCESS_TOKEN = 'invalid-token-for-contract-test';
        try {
            await expect(source.listVideos()).rejects.toMatchObject({ tokenInvalid: true });
        } finally {
            process.env.FACEBOOK_PAGE_ACCESS_TOKEN = realToken;
        }
    }, 15000);
});
