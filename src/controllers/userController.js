const userService = require('../services/userService');
const authService = require('../services/authService');

const completeOnboarding = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: 'Unauthorized: User not found in request' });
        }
        await userService.completeOnboarding(req.user.id);
        res.json({ success: true, message: 'Onboarding marked as complete' });
    } catch (error) {
        console.error('Error completing onboarding:', error);
        if (error.message === 'User not found') {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const getAccountSettings = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: 'Unauthorized: User not found in request' });
        }

        const settings = await userService.getAccountSettings(req.user.id);
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error loading account settings:', error);
        if (error.message === 'User not found') {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const updateProfile = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: 'Unauthorized: User not found in request' });
        }

        const { first_name, last_name } = req.body || {};
        if (!first_name && !last_name) {
            return res.status(400).json({ success: false, message: 'No profile fields provided' });
        }

        await userService.updateProfile(req.user.id, { first_name, last_name });
        res.json({ success: true, message: 'Profile updated' });
    } catch (error) {
        console.error('Error updating profile:', error);
        if (error.message === 'User not found') {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const updatePreferences = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: 'Unauthorized: User not found in request' });
        }

        const { notification_preferences } = req.body || {};
        const preferences = await userService.updatePreferences(req.user.id, notification_preferences);

        res.json({ success: true, preferences });
    } catch (error) {
        console.error('Error updating preferences:', error);
        if (error.message === 'User not found') {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(400).json({ success: false, message: error.message });
    }
};

const changePassword = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: 'Unauthorized: User not found in request' });
        }

        const { current_password, new_password } = req.body || {};
        if (!current_password || !new_password) {
            return res.status(400).json({ success: false, message: 'Current and new password are required' });
        }

        await authService.changePassword({
            user_id: req.user.id,
            current_password,
            new_password,
            ip_address: req.ip || (req.connection && req.connection.remoteAddress)
        });

        res.json({ success: true, message: 'Password updated' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

const requestEmailChange = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: 'Unauthorized: User not found in request' });
        }

        const { new_email } = req.body || {};
        if (!new_email) {
            return res.status(400).json({ success: false, message: 'New email is required' });
        }

        await userService.requestEmailChange(req.user.id, new_email);
        res.json({ success: true, message: 'Confirmation email sent' });
    } catch (error) {
        console.error('Error requesting email change:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

const confirmEmailChange = async (req, res) => {
    try {
        const token = (req.body && req.body.token) || (req.query && req.query.token);
        if (!token) {
            return res.status(400).json({ success: false, message: 'Token is required' });
        }

        await userService.confirmEmailChange(token);
        res.json({ success: true, message: 'Email updated' });
    } catch (error) {
        console.error('Error confirming email change:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    completeOnboarding,
    getAccountSettings,
    updateProfile,
    updatePreferences,
    changePassword,
    requestEmailChange,
    confirmEmailChange
};
