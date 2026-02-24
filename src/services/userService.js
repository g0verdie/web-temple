const db = require('../config/db');

const completeOnboarding = async (userId) => {
    const result = await db.query(
        'UPDATE users SET onboarding_complete = true, updated_at = NOW() WHERE id = $1 RETURNING id',
        [userId]
    );
    if (result.rows.length === 0) {
        throw new Error('User not found');
    }
    return true;
};

module.exports = {
    completeOnboarding
};
