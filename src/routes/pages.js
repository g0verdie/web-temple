const express = require('express');
const router = express.Router();

/**
 * GET /register
 * Display registration form
 */
router.get('/register', (req, res) => {
    res.render('layout', {
        title: 'Register - Temple B\'nai Israel',
        bodyView: 'register',
        viewData: {},
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
        stylesheets: ['/css/auth.css']
    });
});

module.exports = router;
