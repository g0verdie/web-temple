const userService = require('../services/userService');

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

module.exports = {
    completeOnboarding
};
