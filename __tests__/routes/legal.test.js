/**
 * __tests__/routes/legal.test.js
 * Tests for the public legal pages (/privacy, /terms, /accessibility).
 */

const request = require('supertest');
const pageController = require('../../src/controllers/pageController');

jest.mock('../../src/controllers/pageController', () => ({
  getPublishedPage: jest.fn()
}));

const app = require('../../src/server');

const originalEnv = { ...process.env };

const PAGES = [
  { path: '/privacy', slug: 'privacy', title: 'Privacy Policy' },
  { path: '/terms', slug: 'terms', title: 'Terms of Use' },
  { path: '/accessibility', slug: 'accessibility', title: 'Accessibility Statement' }
];

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  pageController.getPublishedPage.mockImplementation((slug) => {
    const match = PAGES.find((p) => p.slug === slug);
    return Promise.resolve({
      title: match ? match.title : slug,
      published: true,
      content: `<h2>Section for ${slug}</h2><p>Body content for ${slug}.</p>`
    });
  });
});

afterEach(() => {
  process.env = { ...originalEnv };
  jest.clearAllMocks();
});

describe('Legal page routes', () => {
  PAGES.forEach(({ path, slug, title }) => {
    describe(`GET ${path}`, () => {
      it('returns 200 with the page title and CMS content', async () => {
        const res = await request(app).get(path);
        expect(res.status).toBe(200);
        expect(res.text).toContain(title);
        expect(res.text).toContain(`Body content for ${slug}`);
        expect(pageController.getPublishedPage).toHaveBeenCalledWith(slug);
      });

      it('renders fallback content in test mode when the CMS row is missing', async () => {
        pageController.getPublishedPage.mockResolvedValueOnce(null);
        const res = await request(app).get(path);
        expect(res.status).toBe(200);
        expect(res.text).toContain(title);
      });

      it('returns 404 in production when the page is not published', async () => {
        pageController.getPublishedPage.mockResolvedValueOnce(null);
        process.env.NODE_ENV = 'production';
        const res = await request(app).get(path).set('x-forwarded-proto', 'https');
        expect(res.status).toBe(404);
      });

      it('returns 500 when the page controller throws', async () => {
        pageController.getPublishedPage.mockImplementationOnce(() => {
          throw new Error('DB Error');
        });
        const res = await request(app).get(path);
        expect(res.status).toBe(500);
      });
    });
  });

  it('links all three legal pages from the footer', async () => {
    const res = await request(app).get('/privacy');
    expect(res.text).toContain('href="/privacy"');
    expect(res.text).toContain('href="/terms"');
    expect(res.text).toContain('href="/accessibility"');
  });
});
