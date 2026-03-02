const userService = require('../../../src/services/userService');
const db = require('../../../src/config/db');

jest.mock('../../../src/config/db');

describe('userService.completeOnboarding', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should update the database and return true', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 1 }] });

        const result = await userService.completeOnboarding(1);

        expect(db.query).toHaveBeenCalledWith(
            'UPDATE users SET onboarding_complete = true, updated_at = NOW() WHERE id = $1 RETURNING id',
            [1]
        );
        expect(result).toBe(true);
    });

    it('should throw "User not found" if rows are empty', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await expect(userService.completeOnboarding(999)).rejects.toThrow('User not found');
    });

    it('should properly propagate database errors', async () => {
        db.query.mockRejectedValue(new Error('Connection timeout'));

        await expect(userService.completeOnboarding(1)).rejects.toThrow('Connection timeout');
    });
});
