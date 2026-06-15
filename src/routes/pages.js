const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const sessionTimeout = require('../middleware/sessionTimeout');
const userService = require('../services/userService');
const MemberDirectoryService = require('../services/MemberDirectoryService');
const unsubscribeController = require('../controllers/unsubscribeController');
const logger = require('../utils/logger');

/**
 * GET /register
 * Display registration form
 */
router.get('/register', (req, res) => {
    res.render('layout', {
        title: 'Register - Temple B\'nai Israel',
        bodyView: 'register',
        viewData: {},
        noindex: true,
        stylesheets: ['/css/auth.css']
    });
});

/**
 * GET /login
 * Display login form
 */
router.get('/login', (req, res) => {
    res.render('layout', {
        title: 'Login - Temple B\'nai Israel',
        bodyView: 'login',
        viewData: {},
        noindex: true,
        stylesheets: ['/css/auth.css']
    });
});

/**
 * GET /auth/request-password-reset
 * Display password reset request form
 */
router.get('/auth/request-password-reset', (req, res) => {
    res.render('layout', {
        title: 'Reset Your Password - Temple B\'nai Israel',
        bodyView: 'auth/request-password-reset',
        viewData: {},
        noindex: true,
        stylesheets: ['/css/auth.css']
    });
});

/**
 * GET /auth/reset-password
 * Display password reset form
 */
router.get('/auth/reset-password', (req, res) => {
    res.render('layout', {
        title: 'Set New Password - Temple B\'nai Israel',
        bodyView: 'auth/reset-password',
        viewData: {},
        noindex: true,
        stylesheets: ['/css/auth.css']
    });
});

/**
 * GET /account/settings
 * Display account settings page
 */
router.get('/account/settings', requireAuth, sessionTimeout(), async (req, res) => {
    try {
        const settings = await userService.getAccountSettings(req.user.id);
        res.render('layout', {
            title: 'Account Settings - Temple B\'nai Israel',
            bodyView: 'account/settings',
            viewData: { settings },
            noindex: true,
            stylesheets: ['/css/account.css']
        });
    } catch (error) {
        logger.error('Error loading account settings page', { error });
        res.status(500).render('error', {
            title: '500 - Server Error',
            message: 'Unable to load account settings.'
        });
    }
});

/**
 * GET /account/confirm-email
 * Display email change confirmation page
 */
router.get('/account/confirm-email', (req, res) => {
    res.render('layout', {
        title: 'Confirm Email - Temple B\'nai Israel',
        bodyView: 'account/confirm-email',
        viewData: { token: req.query.token || '' },
        noindex: true,
        stylesheets: ['/css/account.css']
    });
});

/**
 * GET /unsubscribe
 * Public one-click email opt-out shell (CAN-SPAM). Token comes from the email
 * link; deferred external JS auto-POSTs it. Registered here (before the CMS-slug
 * catch-all) so it isn't swallowed.
 */
router.get('/unsubscribe', unsubscribeController.renderPage);

/**
 * GET /account/directory
 * Display the member's own directory-listing edit page
 */
router.get('/account/directory', requireAuth, sessionTimeout(), async (req, res) => {
    try {
        const profile = await MemberDirectoryService.getMyProfile(req.user.id);
        res.render('layout', {
            title: 'My Directory Listing - Temple B\'nai Israel',
            bodyView: 'account/directory-listing',
            viewData: { profile },
            noindex: true,
            stylesheets: ['/css/account.css']
        });
    } catch (error) {
        logger.error('Error loading directory listing page', { error });
        res.status(500).render('error', {
            title: '500 - Server Error',
            message: 'Unable to load your directory listing.'
        });
    }
});

module.exports = router;
