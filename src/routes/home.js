const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');

// Homepage route
router.get('/', homeController.getHomepage);

// Responsive design test page — development only. This view carries inline
// styles + an inline script (a dev artifact), so it is NOT registered in
// production, where strict CSP would block it anyway.
if (process.env.NODE_ENV !== 'production') {
  router.get('/responsive-test', (req, res) => {
    res.render('layout', {
      title: 'Responsive Design Test',
      bodyView: 'responsive-test',
      viewData: {}
    });
  });
}

module.exports = router;

