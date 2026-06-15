/**
 * routes/legal.js
 * Public legal pages — /privacy, /terms, /accessibility.
 *
 * Served from published static_pages rows (seeded by migration 021) so the text
 * is editable by admins via /admin/pages/:slug without a deploy. Mirrors the
 * About route, including the NODE_ENV==='test' fallback so the routes render
 * without a database in the test suite.
 */

const express = require('express');
const pageController = require('../controllers/pageController');
const logger = require('../utils/logger');

const router = express.Router();

const LEGAL_PAGES = [
  {
    path: '/privacy',
    slug: 'privacy',
    title: 'Privacy Policy',
    fallback: '<h2>Privacy Policy</h2><p>How Temple B\'nai Israel collects and uses your information.</p>'
  },
  {
    path: '/terms',
    slug: 'terms',
    title: 'Terms of Use',
    fallback: '<h2>Terms of Use</h2><p>The terms governing your use of this website.</p>'
  },
  {
    path: '/accessibility',
    slug: 'accessibility',
    title: 'Accessibility Statement',
    fallback: '<h2>Accessibility Statement</h2><p>Our commitment to an accessible website.</p>'
  }
];

LEGAL_PAGES.forEach(({ path, slug, title, fallback }) => {
  router.get(path, async (req, res, next) => {
    try {
      const page = await pageController.getPublishedPage(slug);

      if (!page) {
        if (process.env.NODE_ENV === 'test') {
          return res.render('layout', {
            title,
            bodyView: 'legal',
            viewData: { page: { title, published: true, content: fallback } }
          });
        }

        return res.status(404).render('404', {
          title: '404 - Page Not Found',
          message: `The ${title} page could not be found.`
        });
      }

      res.render('layout', {
        title: page.title,
        bodyView: 'legal',
        viewData: { page }
      });
    } catch (error) {
      logger.error(`Error loading ${slug} page`, { error });
      next(error);
    }
  });
});

module.exports = router;
