const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');

// Homepage route
router.get('/', homeController.getHomepage);

// Responsive design test page (development only)
router.get('/responsive-test', (req, res) => {
  res.render('layout', {
    title: 'Responsive Design Test',
    bodyView: 'responsive-test',
    viewData: {}
  });
});

module.exports = router;

