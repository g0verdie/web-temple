const userService = require('../services/userService');
const { verifyUnsubscribeToken } = require('../utils/unsubscribeToken');
const logger = require('../utils/logger');

/**
 * GET /unsubscribe — render the one-click opt-out shell. The page carries the
 * token in a hidden input; deferred external JS auto-POSTs it (CSP-clean and
 * prefetch-safe, since link scanners don't execute JS). Mirrors the
 * email-change-confirm flow.
 */
const renderPage = (req, res) => {
    res.render('layout', {
        title: 'Unsubscribe - Temple B\'nai Israel',
        bodyView: 'unsubscribe',
        viewData: { token: req.query.token || '' },
        stylesheets: ['/css/account.css']
    });
};

/**
 * Verify the signed token and apply the opt-out. Backs two routes: the
 * CSRF-protected POST /api/unsubscribe/confirm (the unsubscribe page's auto-POST)
 * and the CSRF-exempt RFC 8058 one-click POST /unsubscribe (mailbox-provider
 * one-click). Public + token-authenticated (no requireAuth). A valid signature
 * over a user that no longer exists still returns success-shaped so existence
 * isn't leaked.
 */
const apply = async (req, res) => {
    const token = (req.body && req.body.token) || (req.query && req.query.token);
    const userId = verifyUnsubscribeToken(token);

    if (!userId) {
        return res.status(400).json({ ok: false });
    }

    try {
        await userService.unsubscribeAll(userId);
        return res.json({ ok: true });
    } catch (error) {
        logger.error('Failed to apply unsubscribe', { error: error.message });
        return res.status(500).json({ ok: false });
    }
};

module.exports = {
    renderPage,
    apply,
};
