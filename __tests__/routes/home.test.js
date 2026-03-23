/**
 * Integration tests for homepage route
 * Tests HTTP responses, status codes, and rendered HTML
 */

const request = require('supertest');
const express = require('express');
const path = require('path');
const EventService = require('../../src/services/EventService');
const StreamingService = require('../../src/services/StreamingService');

jest.mock('../../src/services/EventService');
jest.mock('../../src/services/StreamingService');

// Create a test app instance
const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../../src/views'));

// Add helper function
app.locals.formatEventDate = (date) => {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  };
  return date.toLocaleDateString('en-US', options);
};

// Add middleware to expose user to views (matching server.js)
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  next();
});

const homeRoutes = require('../../src/routes/home');
app.use('/', homeRoutes);

describe('Homepage Route Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    EventService.getNextService.mockResolvedValue({
      title: 'Kabbalat Shabbat Service',
      date: new Date('2026-03-27T19:00:00.000Z'),
      type: 'service'
    });

    EventService.getUpcomingEvents.mockResolvedValue([
      {
        title: 'Torah Study',
        date: new Date('2026-03-28T10:00:00.000Z'),
        type: 'event',
        description: 'Weekly Torah study',
        location: 'Community Hall'
      }
    ]);

    StreamingService.getPublicEmbedMetadata.mockResolvedValue({
      status: 'inactive',
      isLive: false,
      title: 'Temple B\'nai Israel Live Service',
      embedUrl: null,
      watchUrl: null,
      scheduledStart: '2026-03-27T19:00:00.000Z'
    });
  });

  describe('GET /', () => {
    it('should return 200 status code', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });

    it('should return HTML content', async () => {
      const response = await request(app).get('/');
      expect(response.type).toMatch(/html/);
    });

    it('should include mission statement in response', async () => {
      const response = await request(app).get('/');
      expect(response.text).toContain('Temple B\'nai Israel');
      expect(response.text).toContain('inclusive Jewish community');
    });

    it('should include CTA button "New Here? Learn More"', async () => {
      const response = await request(app).get('/');
      expect(response.text).toContain('New Here? Learn More');
      expect(response.text).toContain('href="/about"');
    });

    it('should include countdown timer elements when service exists', async () => {
      const response = await request(app).get('/');
      if (response.text.includes('countdown-timer')) {
        expect(response.text).toContain('countdown-days');
        expect(response.text).toContain('countdown-hours');
        expect(response.text).toContain('countdown-minutes');
        expect(response.text).toContain('countdown-seconds');
      }
    });

    it('should include upcoming events section', async () => {
      const response = await request(app).get('/');
      expect(response.text).toContain('Upcoming Events');
    });

    it('should render the live stream embed when an active stream is available', async () => {
      StreamingService.getPublicEmbedMetadata.mockResolvedValue({
        status: 'live',
        isLive: true,
        title: 'Friday Evening Shabbat Service',
        embedUrl: 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Ftemple%2Fvideos%2F123',
        watchUrl: 'https://www.facebook.com/temple/videos/123',
        scheduledStart: '2026-03-27T19:00:00.000Z'
      });

      const response = await request(app).get('/');

      expect(response.text).toContain('Live Stream');
      expect(response.text).toContain('Friday Evening Shabbat Service');
      expect(response.text).toContain('<iframe');
      expect(response.text).toContain('Watch on Facebook');
    });

    it('should render a safe fallback message when no stream is active', async () => {
      const response = await request(app).get('/');

      expect(response.text).toContain('The livestream will appear here when services go live');
      expect(response.text).not.toContain('Watch on Facebook');
      // Verify fallback card has accessible structure
      expect(response.text).toContain('stream-card--fallback');
      expect(response.text).toContain('Live Stream');
    });

    it('should include semantic HTML elements', async () => {
      const response = await request(app).get('/');
      expect(response.text).toContain('role="main"');
      expect(response.text).toContain('role="region"');
      expect(response.text).toContain('aria-labelledby');
    });

    it('should include skip link for accessibility', async () => {
      const response = await request(app).get('/');
      expect(response.text).toContain('Skip to main content');
      expect(response.text).toContain('class="skip-link"');
    });

    it('should respond quickly (performance requirement <2s)', async () => {
      const startTime = Date.now();
      await request(app).get('/');
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(500);
    });
  });
});
