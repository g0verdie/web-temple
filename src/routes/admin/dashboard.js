const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/adminController');
const requireAdmin = require('../../middleware/requireAdmin');

// Dashboard Route
router.get('/', requireAdmin, adminController.getDashboard);

// Email Queue Retry Route
router.post('/email-queue/:id/retry', requireAdmin, adminController.retryEmailJob);

// Audit Logs Route
router.get('/audit-logs', requireAdmin, adminController.getAuditLogs);

module.exports = router;
