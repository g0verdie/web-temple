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

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../../src/views'));

app.locals.formatEventDate = (date) => {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  return date.toLocaleDateString('en-US', options);
};

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
        status: 'offline',
        statusLabel: 'Offline',
        archiveCta: true,
        message: 'The livestream is currently offline. Please view our past recordings.',
        embedUrl: null
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

    it('should render the live stream embed when an active stream is available', async () => {
      StreamingService.getPublicEmbedMetadata.mockResolvedValue({
        status: 'live',
        statusLabel: 'LIVE NOW',
        title: 'Friday Evening Shabbat Service',
        embedUrl: 'https://www.facebook.com/plugins/video.php?href=123',
        watchUrl: 'https://www.facebook.com/temple/videos/123'
      });

      const response = await request(app).get('/');

      expect(response.text).toContain('Live Stream');
      expect(response.text).toContain('LIVE NOW');
      expect(response.text).toContain('Friday Evening Shabbat Service');
      expect(response.text).toContain('<iframe');
    });

    it('should render upcoming state correctly', async () => {
      StreamingService.getPublicEmbedMetadata.mockResolvedValue({
        status: 'upcoming',
        statusLabel: 'Upcoming',
        scheduledStart: '2026-03-27T19:00:00.000Z',
        countdownTarget: '2026-03-27T19:00:00.000Z',
        message: 'The livestream will begin shortly.'
      });

      const response = await request(app).get('/');
      expect(response.text).toContain('Live Stream');
      expect(response.text).toContain('Upcoming');
      expect(response.text).toContain('stream-countdown');
      expect(response.text).toContain('data-countdown-target="2026-03-27T19:00:00.000Z"');
      expect(response.text).toContain('The livestream will begin shortly.');
    });

    it('should render offline state correctly', async () => {
      const response = await request(app).get('/');
      
      expect(response.text).toContain('Live Stream');
      expect(response.text).toContain('Offline');
      expect(response.text).toContain('The livestream is currently offline. Please view our past recordings.');
      expect(response.text).toContain('View Recordings');
    });

    it('should render error state correctly', async () => {
      StreamingService.getPublicEmbedMetadata.mockResolvedValue({
        status: 'error',
        fallbackUrl: 'https://www.facebook.com/TempleBnaiIsrael',
        message: 'The streaming provider is currently unavailable. Please watch directly on Facebook.'
      });

      const response = await request(app).get('/');
      expect(response.text).toContain('Watch on Facebook');
      expect(response.text).toContain('The streaming provider is currently unavailable.');
    });

    it('should expose stream status semantics for assistive technology', async () => {
      StreamingService.getPublicEmbedMetadata.mockResolvedValue({
        status: 'offline',
        statusLabel: 'Offline',
        archiveCta: true,
        message: 'The livestream is currently offline. Please view our past recordings.',
        embedUrl: null
      });

      const response = await request(app).get('/');

      expect(response.text).toContain('role="status"');
      expect(response.text).toContain('aria-live="polite"');
      expect(response.text).toContain('aria-atomic="true"');
    });
  });
});
