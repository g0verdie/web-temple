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
