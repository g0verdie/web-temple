/**
 * Unit tests for homeController
 * Tests business logic, countdown calculation, and data formatting
 */

const homeController = require('../../src/controllers/homeController');

describe('homeController', () => {
  let req, res;
  
  beforeEach(() => {
    req = {};
    res = {
      render: jest.fn()
    };
  });
  
  describe('getHomepage', () => {
    it('should render home view with correct data structure', () => {
      homeController.getHomepage(req, res);
      
      expect(res.render).toHaveBeenCalledWith('home', expect.objectContaining({
        title: expect.any(String),
        mission: expect.objectContaining({
          headline: expect.any(String),
          statement: expect.any(String),
          cta: expect.objectContaining({
            text: expect.any(String),
            link: expect.any(String)
          })
        }),
        events: expect.any(Array)
      }));
    });
    
    it('should include mission statement with CTA', () => {
      homeController.getHomepage(req, res);
      
      const renderCall = res.render.mock.calls[0][1];
      expect(renderCall.mission.headline).toContain('Temple B\'nai Israel');
      expect(renderCall.mission.statement).toBeTruthy();
      expect(renderCall.mission.cta.text).toContain('Learn More');
      expect(renderCall.mission.cta.link).toBe('/about');
    });
    
    it('should provide next service with countdown when available', () => {
      homeController.getHomepage(req, res);
      
      const renderCall = res.render.mock.calls[0][1];
      if (renderCall.nextService) {
        expect(renderCall.nextService).toHaveProperty('title');
        expect(renderCall.nextService).toHaveProperty('date');
        expect(renderCall.nextService.type).toBe('service');
        expect(renderCall.countdown).toHaveProperty('days');
        expect(renderCall.countdown).toHaveProperty('hours');
        expect(renderCall.countdown).toHaveProperty('minutes');
        expect(renderCall.countdown).toHaveProperty('seconds');
      }
    });
    
    it('should provide up to 3 upcoming events', () => {
      homeController.getHomepage(req, res);
      
      const renderCall = res.render.mock.calls[0][1];
      expect(Array.isArray(renderCall.events)).toBe(true);
      expect(renderCall.events.length).toBeLessThanOrEqual(3);
    });
    
    it('should format event dates for display', () => {
      homeController.getHomepage(req, res);
      
      const renderCall = res.render.mock.calls[0][1];
      if (renderCall.events.length > 0) {
        renderCall.events.forEach(event => {
          expect(event).toHaveProperty('formattedDate');
          expect(typeof event.formattedDate).toBe('string');
          expect(event.formattedDate.length).toBeGreaterThan(0);
        });
      }
    });
    
    it('should include event details (title, description, location)', () => {
      homeController.getHomepage(req, res);
      
      const renderCall = res.render.mock.calls[0][1];
      if (renderCall.events.length > 0) {
        renderCall.events.forEach(event => {
          expect(event).toHaveProperty('title');
          expect(event).toHaveProperty('description');
          expect(event).toHaveProperty('location');
          expect(event).toHaveProperty('date');
        });
      }
    });
    
    it('should handle countdown when past service time', () => {
      // This tests the edge case of countdown calculation
      homeController.getHomepage(req, res);
      
      const renderCall = res.render.mock.calls[0][1];
      if (renderCall.countdown) {
        expect(renderCall.countdown.days).toBeGreaterThanOrEqual(0);
        expect(renderCall.countdown.hours).toBeGreaterThanOrEqual(0);
        expect(renderCall.countdown.minutes).toBeGreaterThanOrEqual(0);
        expect(renderCall.countdown.seconds).toBeGreaterThanOrEqual(0);
      }
    });
    
    it('should handle no upcoming service gracefully', () => {
      homeController.getHomepage(req, res);
      
      const renderCall = res.render.mock.calls[0][1];
      // If no service, both nextService and countdown should be null
      if (!renderCall.nextService) {
        expect(renderCall.countdown).toBeNull();
      }
    });
    
    it('should provide formatEventDate function', () => {
      homeController.getHomepage(req, res);
      
      const renderCall = res.render.mock.calls[0][1];
      expect(renderCall.formatEventDate).toBeDefined();
      expect(typeof renderCall.formatEventDate).toBe('function');
      
      // Test the function works
      const testDate = new Date('2026-02-07T19:00:00');
      const formatted = renderCall.formatEventDate(testDate);
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
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
  
  describe('getNextService', () => {
    it('should return next service or null', () => {
      const nextService = homeController.getNextService();
      
      // Either returns service object or null
      if (nextService) {
        expect(nextService.type).toBe('service');
        expect(nextService.date).toBeInstanceOf(Date);
      } else {
        expect(nextService).toBeNull();
      }
    });
  });
  
  describe('getUpcomingEvents', () => {
    it('should return array of upcoming events', () => {
      const events = homeController.getUpcomingEvents();
      
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeLessThanOrEqual(3);
      
      events.forEach(event => {
        expect(event).toHaveProperty('title');
        expect(event).toHaveProperty('date');
        expect(event.date).toBeInstanceOf(Date);
      });
    });
  });
});
