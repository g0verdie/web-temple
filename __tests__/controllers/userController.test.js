const {
    completeOnboarding,
    getAccountSettings,
    updateProfile,
    updatePreferences,
    changePassword,
    requestEmailChange,
    confirmEmailChange
} = require('../../src/controllers/userController');
const userService = require('../../src/services/userService');
const authService = require('../../src/services/authService');

jest.mock('../../src/services/userService');
jest.mock('../../src/services/authService');

const mockRequest = (user) => ({
    user,
    body: {},
    query: {}
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

describe('userController.getAccountSettings', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns account settings for logged-in user', async () => {
        const req = mockRequest({ id: 'user-1' });
        const res = mockResponse();

        userService.getAccountSettings.mockResolvedValue({ email: 'member@example.com' });

        await getAccountSettings(req, res);

        expect(userService.getAccountSettings).toHaveBeenCalledWith('user-1');
        expect(res.json).toHaveBeenCalledWith({ success: true, settings: { email: 'member@example.com' } });
    });

    it('rejects when user is missing', async () => {
        const req = mockRequest(null);
        const res = mockResponse();

        await getAccountSettings(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Unauthorized: User not found in request' });
    });
});

describe('userController.updateProfile', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('updates profile fields', async () => {
        const req = mockRequest({ id: 'user-1' });
        req.body = { first_name: 'New', last_name: 'Name' };
        const res = mockResponse();

        userService.updateProfile.mockResolvedValue(true);

        await updateProfile(req, res);

        expect(userService.updateProfile).toHaveBeenCalledWith('user-1', { first_name: 'New', last_name: 'Name' });
        expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Profile updated' });
    });
});

describe('userController.updatePreferences', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('updates notification preferences', async () => {
        const req = mockRequest({ id: 'user-1' });
        req.body = { notification_preferences: { messages: false } };
        const res = mockResponse();

        userService.updatePreferences.mockResolvedValue({ messages: false });

        await updatePreferences(req, res);

        expect(userService.updatePreferences).toHaveBeenCalledWith('user-1', { messages: false });
        expect(res.json).toHaveBeenCalledWith({ success: true, preferences: { messages: false } });
    });
});

describe('userController.changePassword', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('delegates password change', async () => {
        const req = mockRequest({ id: 'user-1' });
        req.body = { current_password: 'OldPass123!', new_password: 'NewPass123!' };
        const res = mockResponse();

        authService.changePassword.mockResolvedValue(true);

        await changePassword(req, res);

        expect(authService.changePassword).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Password updated' });
    });
});

describe('userController.requestEmailChange', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('requests email change', async () => {
        const req = mockRequest({ id: 'user-1' });
        req.body = { new_email: 'new@example.com' };
        const res = mockResponse();

        userService.requestEmailChange.mockResolvedValue(true);

        await requestEmailChange(req, res);

        expect(userService.requestEmailChange).toHaveBeenCalledWith('user-1', 'new@example.com');
        expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Confirmation email sent' });
    });
});

describe('userController.confirmEmailChange', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('confirms email change token', async () => {
        const req = mockRequest(null);
        req.body = { token: 'token-123' };
        const res = mockResponse();

        userService.confirmEmailChange.mockResolvedValue(true);

        await confirmEmailChange(req, res);

        expect(userService.confirmEmailChange).toHaveBeenCalledWith('token-123');
        expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Email updated' });
    });
});
