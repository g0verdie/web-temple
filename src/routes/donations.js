const express = require('express');
const router = express.Router();
const donationController = require('../controllers/donationController');

// Public donations surface (no login — FR53). State-changing POSTs are covered by
// the global conditionalCsrf middleware.
router.get('/', donationController.getDonationsPage);
router.post('/checkout', donationController.startCheckout);
router.get('/thank-you', donationController.thankYou);
router.get('/checkout/:id', donationController.getCheckout);
router.post('/checkout/:id/complete', donationController.completeCheckout);

module.exports = router;
