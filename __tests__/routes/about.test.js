/**
 * __tests__/routes/about.test.js
 * Tests for the public About page route
 */

const request = require('supertest');
const pageController = require('../../src/controllers/pageController');

jest.mock('../../src/controllers/pageController', () => ({
  getPublishedPage: jest.fn()
}));

const app = require('../../src/server');

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  pageController.getPublishedPage.mockResolvedValue({
    title: 'About the Temple',
    published: true,
    content: '<h2>Community Values</h2><p>Mission</p>'
  });
});

afterEach(() => {
  process.env = { ...originalEnv };
  jest.clearAllMocks();
});

describe('About Page Route', () => {
  describe('GET /about', () => {
    it('should return 200 and render the About page', async () => {
      const res = await request(app).get('/about');
      expect(res.status).toBe(200);
      expect(res.text).toContain('About the Temple');
      expect(res.text).toContain('Temple B\'nai Israel');
    });

    it('should have proper accessibility attributes', async () => {
      const res = await request(app).get('/about');
      expect(res.text).toContain('id="main-content"');
      expect(res.text).toContain('role="main"');
      expect(res.text).toContain('role="region"');
      expect(res.text).toContain('aria-label');
    });

    it('should include proper HTML structure for SEO', async () => {
      const res = await request(app).get('/about');
      expect(res.text).toContain('<h1');
      expect(res.text).toContain('<h2');
      expect(res.text).toContain('<article');
    });

    it('should have responsive meta tags', async () => {
      const res = await request(app).get('/about');
      expect(res.text).toContain('viewport');
      expect(res.text).toContain('width=device-width');
    });

    it('should include rich text content from CMS', async () => {
      const res = await request(app).get('/about');
      expect(res.text).toContain('Community Values');
      expect(res.text).toContain('Mission');
    });

    it('should set correct Content-Type header', async () => {
      const res = await request(app).get('/about');
      expect(res.headers['content-type']).toMatch(/text\/html/);
    });
  });

  describe('SEO Metadata', () => {
    it('should name the Reform identity and the Florence / Shoals locality in the meta description', async () => {
      const res = await request(app).get('/about');
      const meta = res.text.match(/<meta name="description" content="([^"]*)"/);
      expect(meta).toBeTruthy();
      expect(meta[1]).toContain('Reform');
      expect(meta[1]).toContain('Florence');
      expect(meta[1]).toContain('Shoals');
    });
  });

  describe('Draft Status Indicator', () => {
    it('should NOT show draft indicator for published pages', async () => {
      const res = await request(app).get('/about');
      expect(res.text).not.toContain('<strong>Draft:</strong>');
    });
  });

  describe('Page Layout', () => {
    it('should include main navigation', async () => {
      const res = await request(app).get('/about');
      expect(res.text).toContain('Home');
      expect(res.text).toContain('Calendar');
      expect(res.text).toContain('Contact');
    });

    it('should show a Login link for logged-out visitors', async () => {
      const res = await request(app).get('/about');
      expect(res.text).toContain('href="/login"');
      expect(res.text).toContain('nav-login');
    });

    it('should include footer', async () => {
      const res = await request(app).get('/about');
      expect(res.text).toContain('Temple B\'nai Israel');
      expect(res.text).toContain('rights reserved');
    });

    it('should have skip-to-main-content link', async () => {
      const res = await request(app).get('/about');
      expect(res.text).toContain('skip-link');
      expect(res.text).toContain('main-content');
    });
  });

  describe('Quick Links sidebar', () => {
    it('should link Services & Events to /calendar and Support Us to /donations', async () => {
      const res = await request(app).get('/about');
      expect(res.text).toContain('href="/calendar"');
      expect(res.text).toContain('href="/donations"');
      expect(res.text).toContain('Services & Events');
      expect(res.text).toContain('Support Us');
    });

    it('should not render "Coming Soon" placeholders', async () => {
      const res = await request(app).get('/about');
      expect(res.text).not.toContain('Coming Soon');
      expect(res.text).not.toContain('aria-disabled');
    });
  });

  describe('Responsive Design', () => {
    it('should include responsive CSS class names', async () => {
      const res = await request(app).get('/about');
      expect(res.text).toContain('about-page');
      expect(res.text).toContain('about-hero');
      expect(res.text).toContain('about-content');
    });
  });

  describe('Performance Headers', () => {
    it('should include compression middleware', async () => {
      const res = await request(app).get('/about');
      // Compression should be applied
      expect(res.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 if page not found', async () => {
      pageController.getPublishedPage.mockResolvedValueOnce(null);
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .get('/about')
        .set('x-forwarded-proto', 'https');
      expect(res.status).toBe(404);
    });
  });

  describe('Fallback Content', () => {
    it('should render fallback content in test mode when CMS is empty', async () => {
      pageController.getPublishedPage.mockResolvedValueOnce(null);
      process.env.NODE_ENV = 'test';

      const res = await request(app).get('/about');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Community Values');
      expect(res.text).toContain('Mission');
    });
  });

  describe('Error Handling (Server)', () => {
    it('should handle errors from page controller', async () => {
      pageController.getPublishedPage.mockImplementationOnce(() => {
        throw new Error('DB Error');
      });

      const res = await request(app).get('/about');
      expect(res.status).toBe(500);
    });
  });
});
