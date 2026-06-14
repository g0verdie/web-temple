/**
 * routes/admin/donations.js
 * Rabbi/Admin/Treasurer donation dashboard + CSV export (Story 8.6).
 * Full auth chain (requireAuth → sessionTimeout → requirePermission), per NFR-S6.
 */
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const adminDonationController = require('../../controllers/adminDonationController');
const { requirePermission } = require('../../middleware/requireRbac');
const requireAuth = require('../../middleware/requireAuth');
const sessionTimeout = require('../../middleware/sessionTimeout');
const { Permissions } = require('../../config/roles-permissions');

const requireDonationsAccess = [
    requireAuth,
    sessionTimeout(),
    requirePermission(Permissions.VIEW_DONATIONS)
];

// CSV export decrypts the dataset in-app, so cap export frequency per user.
const exportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => (req.user && req.user.id ? String(req.user.id) : 'anonymous'),
    message: { error: 'Too many export requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test'
});

router.get('/', requireDonationsAccess, adminDonationController.getDashboard);
router.get('/export.csv', requireDonationsAccess, exportLimiter, adminDonationController.exportCsv);

module.exports = router;
