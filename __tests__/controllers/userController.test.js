const { completeOnboarding } = require('../../src/controllers/userController');
const userService = require('../../src/services/userService');

jest.mock('../../src/services/userService');

const mockRequest = (user) => ({
    user
});

const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('userController.completeOnboarding', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should complete onboarding and return success', async () => {
        const req = mockRequest({ id: 1 });
        const res = mockResponse();

        userService.completeOnboarding.mockResolvedValue(true);

        await completeOnboarding(req, res);

        expect(userService.completeOnboarding).toHaveBeenCalledWith(1);
        expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Onboarding marked as complete' });
    });

    it('should handle missing req.user', async () => {
        const req = mockRequest(null);
        const res = mockResponse();

        await completeOnboarding(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Unauthorized: User not found in request' });
    });

    it('should handle User not found error', async () => {
        const req = mockRequest({ id: 1 });
        const res = mockResponse();

        userService.completeOnboarding.mockRejectedValue(new Error('User not found'));

        await completeOnboarding(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'User not found' });
    });

    it('should handle errors from user service', async () => {
        const req = mockRequest({ id: 1 });
        const res = mockResponse();

        userService.completeOnboarding.mockRejectedValue(new Error('Database error'));

        await completeOnboarding(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Internal Server Error' });
    });
});
