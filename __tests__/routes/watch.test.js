/**
 * Integration tests for the public /watch ("Past Services") route.
 * Verifies it is public (no auth redirect), renders the lightbox/cards, the
 * degraded notice, the empty state, the nav link, and escapes untrusted fields.
 */
const request = require('supertest');
const express = require('express');
const path = require('path');
const PastVideoService = require('../../src/services/pastVideos/PastVideoService');

jest.mock('../../src/services/pastVideos/PastVideoService');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../../src/views'));

app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.currentPath = req.path;
    next();
});

const watchRoutes = require('../../src/routes/watch');
app.use('/watch', watchRoutes);

const embed = 'https://www.facebook.com/plugins/video.php?href=ENC&show_text=false';

describe('GET /watch (public Past Services page)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('(a) returns 200 for an unauthenticated request (no login redirect)', async () => {
        PastVideoService.getVideos.mockResolvedValue({ videos: [], degraded: false });
        const res = await request(app).get('/watch');
        expect(res.status).toBe(200);
    });

    it('(b) renders a play button and a plugins/video.php embed per video', async () => {
        PastVideoService.getVideos.mockResolvedValue({
            videos: [{ id: '1', title: 'Service A', date: '2026-05-29T19:00:00.000Z', description: '', thumbnailUrl: null, embedUrl: embed }],
            degraded: false
        });
        const res = await request(app).get('/watch');
        expect(res.status).toBe(200);
        expect(res.text).toContain('plugins/video.php');
        expect(res.text).toContain('watch-card__btn');
        expect(res.text).toContain('Service A');
        // thumbnail-absent → placeholder
        expect(res.text).toContain('/images/video-placeholder.svg');
    });

    it('(c) renders the empty state with a Facebook link when there are no videos', async () => {
        PastVideoService.getVideos.mockResolvedValue({ videos: [], degraded: false });
        const res = await request(app).get('/watch');
        expect(res.status).toBe(200);
        expect(res.text).toContain('watch-empty');
        expect(res.text).toContain('facebook.com/share/18jfSPTgMw');
    });

    it('(d) shows the degraded notice when degraded with videos present', async () => {
        PastVideoService.getVideos.mockResolvedValue({
            videos: [{ id: '1', title: 'A', date: null, description: '', thumbnailUrl: null, embedUrl: embed }],
            degraded: true
        });
        const res = await request(app).get('/watch');
        expect(res.text).toContain('watch-notice');
    });

    it('(e) includes a /watch nav link in the layout', async () => {
        PastVideoService.getVideos.mockResolvedValue({ videos: [], degraded: false });
        const res = await request(app).get('/watch');
        expect(res.text).toContain('href="/watch"');
    });

    it('(f) HTML-escapes an untrusted video title (XSS guard)', async () => {
        PastVideoService.getVideos.mockResolvedValue({
            videos: [{ id: '1', title: '<script>alert(1)</script>', date: null, description: '', thumbnailUrl: null, embedUrl: embed }],
            degraded: false
        });
        const res = await request(app).get('/watch');
        expect(res.text).not.toContain('<script>alert(1)</script>');
        expect(res.text).toContain('&lt;script&gt;');
    });
});
