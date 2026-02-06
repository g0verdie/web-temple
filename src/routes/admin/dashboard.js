const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/adminController');
const requireAdmin = require('../../middleware/requireAdmin');

// Dashboard Route
router.get('/', requireAdmin, adminController.getDashboard);

module.exports = router;
