const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const sessionTimeout = require('../middleware/sessionTimeout');
const userService = require('../services/userService');
const MemberDirectoryService = require('../services/MemberDirectoryService');
const unsubscribeController = require('../controllers/unsubscribeController');
const authController = require('../controllers/authController');
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
 * GET /auth/verify-email
 * Verify an email address from the link in the verification email (Gate 1).
 */
router.get('/auth/verify-email', authController.verifyEmailPage);

/**
 * GET /auth/resend-verification
 * Display the "resend verification email" form.
 */
router.get('/auth/resend-verification', (req, res) => {
    res.render('layout', {
        title: 'Resend Verification Email - Temple B\'nai Israel',
        bodyView: 'auth/resend-verification',
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
        // The directory-listing editor now lives on this page (consolidated from the
        // former /account/directory). Load the member's own profile too — but a
        // directory-load failure must NOT take down the whole settings page (Profile,
        // Notifications, Password), so it degrades to a notice in that one section.
        let profile = null;
        let directoryError = false;
        try {
            profile = await MemberDirectoryService.getMyProfile(req.user.id);
        } catch (dirErr) {
            logger.error('Error loading directory profile for settings page', { error: dirErr });
            directoryError = true;
        }
        res.render('layout', {
            title: 'Account Settings - Temple B\'nai Israel',
            bodyView: 'account/settings',
            viewData: { settings, profile, directoryError },
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
 * POST /unsubscribe
 * RFC 8058 one-click target. Mailbox providers (Gmail/Yahoo) POST
 * `List-Unsubscribe=One-Click` here with the token in the query — no browser,
 * cookies, or CSRF token. Authenticated by the HMAC-signed token; CSRF-exempt in
 * src/server.js. Reuses the same token-verify + idempotent opt-out as the confirm
 * endpoint, so a tampered token yields 400 and never opts anyone out.
 */
router.post('/unsubscribe', unsubscribeController.apply);

/**
 * GET /account/directory
 * The member's own directory-listing editor has been consolidated into the
 * "Directory Listing & Privacy" section of /account/settings. Permanently
 * redirect (301) so registration opt-in, the R20 nudge, bookmarks, and emailed
 * links keep working; the #anchor auto-expands the section client-side.
 */
router.get('/account/directory', requireAuth, sessionTimeout(), (req, res) => {
    res.redirect(301, '/account/settings#directory-listing');
});

module.exports = router;
