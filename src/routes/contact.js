const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const messageController = require('../controllers/messageController');

// GET /contact - Render Contact Page
router.get('/', (req, res) => {
    res.render('layout', {
        title: 'Contact Us',
        bodyView: 'contact',
        viewData: {
            user: req.user || null,
            captchaSiteKey: process.env.CAPTCHA_SITE_KEY || '10000000-ffff-ffff-ffff-000000000001' // Default test key
        }
    });
});

// POST /contact - Submit Message
router.post('/', [
    body('name').trim().notEmpty().withMessage('Name is required').escape(),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('subject').trim().notEmpty().withMessage('Subject is required').escape(),
    body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters').escape(),
    // body('captchaToken').notEmpty().withMessage('CAPTCHA is required') // Handled in controller for better error msg
], messageController.submitMessage);

module.exports = router;
