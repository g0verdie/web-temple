/**
 * Unit tests for homeController
 * Tests business logic, countdown calculation, and data formatting
 */

const homeController = require('../../src/controllers/homeController');
const EventService = require('../../src/services/EventService');
const StreamingService = require('../../src/services/StreamingService');

jest.mock('../../src/services/EventService');
jest.mock('../../src/services/StreamingService');

describe('homeController', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {};
    res = {
      render: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
  });

  describe('getHomepage', () => {
    const mockService = {
      title: 'Kabbalat Shabbat',
      date: new Date('2026-02-07T19:00:00'),
      type: 'service'
    };

    const mockEvents = [
      {
        title: 'Tu B\'Shvat',
        date: new Date('2026-02-12T18:30:00'),
        type: 'event',
        location: 'Hall'
      }
    ];

    it('should render layout view with correct data structure', async () => {
      EventService.getNextService.mockResolvedValue(mockService);
      EventService.getUpcomingEvents.mockResolvedValue(mockEvents);
      StreamingService.getPublicEmbedMetadata.mockResolvedValue({
        status: 'offline',
        embedUrl: null
      });

      await homeController.getHomepage(req, res);

      expect(res.render).toHaveBeenCalledWith('layout', expect.objectContaining({
        title: expect.any(String),
        bodyView: 'home',
        viewData: expect.objectContaining({
          mission: expect.any(Object),
          events: expect.any(Array),
          nextService: mockService,
          countdown: expect.any(Object),
          stream: expect.any(Object)
        })
      }));
    });

    it('should render the branded error view (not plain text) on failure', async () => {
      EventService.getNextService.mockRejectedValue(new Error('Service failure'));
      StreamingService.getPublicEmbedMetadata.mockResolvedValue({
        status: 'offline',
        embedUrl: null
      });

      await homeController.getHomepage(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.render).toHaveBeenCalledWith('error', expect.objectContaining({
        title: expect.any(String),
        message: expect.any(String)
      }));
      expect(res.send).not.toHaveBeenCalled();
    });

    it('should format event dates for display', async () => {
      EventService.getNextService.mockResolvedValue(mockService);
      EventService.getUpcomingEvents.mockResolvedValue(mockEvents);
      StreamingService.getPublicEmbedMetadata.mockResolvedValue({
        status: 'offline',
        embedUrl: null
      });

      await homeController.getHomepage(req, res);

      const renderCall = res.render.mock.calls[0][1];
      expect(renderCall.viewData.events[0]).toHaveProperty('formattedDate');
      expect(typeof renderCall.viewData.events[0].formattedDate).toBe('string');
    });

    it('should map live stream metadata into the homepage view model', async () => {
      EventService.getNextService.mockResolvedValue(mockService);
      EventService.getUpcomingEvents.mockResolvedValue(mockEvents);
      StreamingService.getPublicEmbedMetadata.mockResolvedValue({
        status: 'live',
        isLive: true,
        embedUrl: 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Ftemple%2Fvideos%2F123',
        watchUrl: 'https://www.facebook.com/temple/videos/123',
        title: 'Friday Evening Shabbat Service',
        scheduledStart: '2026-03-27T19:00:00.000Z'
      });

      await homeController.getHomepage(req, res);

      const renderCall = res.render.mock.calls[0][1];
      expect(renderCall.viewData.stream).toEqual(expect.objectContaining({
        status: 'live',
        embedUrl: expect.stringContaining('facebook.com'),
        title: 'Friday Evening Shabbat Service'
      }));
    });

    it('should degrade gracefully when the streaming provider cannot be loaded', async () => {
      EventService.getNextService.mockResolvedValue(mockService);
      EventService.getUpcomingEvents.mockResolvedValue(mockEvents);
      StreamingService.getPublicEmbedMetadata.mockRejectedValue(new Error('Provider unavailable'));

      await homeController.getHomepage(req, res);

      expect(res.render).toHaveBeenCalledWith('layout', expect.objectContaining({
        viewData: expect.objectContaining({
          stream: expect.objectContaining({
            status: 'error',
            fallbackUrl: expect.any(String)
          })
        })
      }));
    });
  });

  describe('getTimeUntilService', () => {
    it('should return zero values for past date', () => {
      const pastDate = new Date('2020-01-01T00:00:00');
      const countdown = homeController.getTimeUntilService(pastDate);

      expect(countdown.days).toBe(0);
      expect(countdown.hours).toBe(0);
      expect(countdown.minutes).toBe(0);
      expect(countdown.seconds).toBe(0);
    });

    it('should calculate positive values for future date', () => {
      const futureDate = new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)); // 2 days from now
      const countdown = homeController.getTimeUntilService(futureDate);

      expect(countdown.days).toBeGreaterThanOrEqual(1);
    });
  });

  describe('formatEventDate', () => {
    it('should format date correctly', () => {
      const testDate = new Date('2026-02-07T19:00:00');
      const formatted = homeController.formatEventDate(testDate);

      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('February');
    });
  });
});
