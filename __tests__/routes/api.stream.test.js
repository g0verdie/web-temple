const request = require('supertest');
const express = require('express');
const StreamingService = require('../../src/services/StreamingService');

jest.mock('../../src/services/StreamingService');
jest.mock('../../src/middleware/requireAuth', () => (req, res, next) => next());
jest.mock('../../src/middleware/sessionTimeout', () => () => (req, res, next) => next());
jest.mock('../../src/middleware/requireRbac', () => ({
    requireRole: () => (req, res, next) => next(),
    requirePermission: () => (req, res, next) => next()
}));
jest.mock('../../src/services/backupLogService', () => ({}));
jest.mock('../../src/services/auditService', () => ({}));
jest.mock('../../src/services/sessionService', () => ({}));
jest.mock('../../src/controllers/donationController', () => ({ createDonation: jest.fn() }));
jest.mock('../../src/controllers/userController', () => ({
    getAccountSettings: jest.fn(),
    updateProfile: jest.fn(),
    updatePreferences: jest.fn(),
    changePassword: jest.fn(),
    requestEmailChange: jest.fn(),
    confirmEmailChange: jest.fn(),
    completeOnboarding: jest.fn(),
    getDirectoryListing: jest.fn(),
    updateDirectoryListing: jest.fn()
}));
jest.mock('../../src/routes/auth', () => {
    const router = require('express').Router();
    return router;
});

const apiRoutes = require('../../src/routes/api');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('GET /api/stream/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns stream status from StreamingService', async () => {
    const mockStatus = { status: 'live', statusLabel: 'LIVE NOW' };
    StreamingService.getPublicEmbedMetadata.mockResolvedValue(mockStatus);

    const response = await request(app).get('/api/stream/status');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockStatus);
  });

  it('handles errors gracefully', async () => {
    StreamingService.getPublicEmbedMetadata.mockRejectedValue(new Error('Test error'));

    const response = await request(app).get('/api/stream/status');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal Server Error' });
  });
});
