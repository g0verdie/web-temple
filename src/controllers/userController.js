const userService = require('../services/userService');

const completeOnboarding = async (req, res) => {
    try {
        await userService.completeOnboarding(req.user.id);
        res.json({ success: true, message: 'Onboarding marked as complete' });
    } catch (error) {
        console.error('Error completing onboarding:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

module.exports = {
    completeOnboarding
};
