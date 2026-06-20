const express = require('express');
const router = express.Router();

// The local recordings archive was retired in favour of the single public
// Facebook-sourced /watch surface. Permanently redirect old archive URLs
// (including member bookmarks of /archive/:id) to /watch.
router.get('/', (req, res) => res.redirect(301, '/watch'));
router.get('/:id', (req, res) => res.redirect(301, '/watch'));

module.exports = router;
