/**
 * Integration tests for homepage route
 * Tests HTTP responses, status codes, and rendered HTML
 */

const request = require('supertest');
const express = require('express');
const path = require('path');

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

const homeRoutes = require('../../src/routes/home');
app.use('/', homeRoutes);

describe('Homepage Route Integration Tests', () => {
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
      // Check for countdown structure (may not always be present if no upcoming service)
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
      
      // Test should complete in much less than 2s (no DB yet, just rendering)
      expect(responseTime).toBeLessThan(500); // 500ms for unit test
    });
  });
});
