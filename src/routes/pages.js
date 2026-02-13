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

module.exports = router;
