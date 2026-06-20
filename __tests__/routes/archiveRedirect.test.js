const request = require('supertest');
const app = require('../../src/server');

// The local recordings archive was retired in favour of the single public
// Facebook-sourced /watch surface. Old archive URLs (including member
// bookmarks of /archive/:id) must permanently redirect to /watch.
describe('GET /archive (retired — redirects to /watch)', () => {
    it('301-redirects /archive to /watch', async () => {
        const res = await request(app).get('/archive');
        expect(res.status).toBe(301);
        expect(res.headers.location).toBe('/watch');
    });

    it('301-redirects a recording detail URL to /watch', async () => {
        const res = await request(app).get('/archive/some-old-id');
        expect(res.status).toBe(301);
        expect(res.headers.location).toBe('/watch');
    });
});
