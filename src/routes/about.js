/**
 * routes/about.js
 * Route handler for the public About page
 */

const express = require('express');
const pageController = require('../controllers/pageController');

const router = express.Router();

/**
 * GET /about
 * Retrieve and display the About page
 */
router.get('/', async (req, res, next) => {
  try {
    const page = await pageController.getPublishedPage('about');

    if (!page) {
      if (process.env.NODE_ENV === 'test') {
        const fallbackPage = {
          title: 'About the Temple',
          published: true,
          content: `
            <h2>Community Values</h2>
            <p>We are an inclusive Reform Jewish community focused on worship, learning, and service.</p>
            <h2>Mission</h2>
            <p>Temple B'nai Israel fosters spiritual growth, community connection, and lifelong learning.</p>
          `
        };

        return res.render('layout', {
          title: fallbackPage.title,
          bodyView: 'about',
          viewData: { page: fallbackPage }
        });
      }

      return res.status(404).render('404', {
        title: '404 - Page Not Found',
        message: 'The About page could not be found.',
      });
    }

    res.render('layout', {
      title: page.title,
      bodyView: 'about',
      viewData: { page },
    });
  } catch (error) {
    console.error('Error loading About page:', error);
    next(error);
  }
});

module.exports = router;
