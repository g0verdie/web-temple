const express = require('express');
const router = express.Router();
const watchController = require('../controllers/watchController');

// Public "Past Services" page. requireAuth is intentionally NOT applied — anyone can
// watch the temple's past videos without logging in (distinct from the members-only
// /archive). req.user is still populated globally by the server JWT decode if present.
router.get('/', watchController.getWatchPage);

module.exports = router;
