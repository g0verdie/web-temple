const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const donationController = require('../controllers/donationController');

// Public POSTs are unauthenticated, so throttle per IP to stop a script from
// fabricating fake completed donations that would pollute the admin dashboard.
// Skipped in test for a deterministic suite (matches chatPostLimiter).
const donationPostLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many donation attempts. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test'
});

// Public donations surface (no login — FR53). State-changing POSTs are covered by
// the global conditionalCsrf middleware.
router.get('/', donationController.getDonationsPage);
router.post('/checkout', donationPostLimiter, donationController.startCheckout);
router.get('/thank-you', donationController.thankYou);
router.get('/checkout/:id', donationController.getCheckout);
router.post('/checkout/:id/complete', donationPostLimiter, donationController.completeCheckout);

module.exports = router;
