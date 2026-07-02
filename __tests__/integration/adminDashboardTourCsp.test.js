const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/DonationService', () => ({ getMtdTotalCents: jest.fn() }));
jest.mock('../../src/services/userService', () => ({ getNewMemberCountThisMonth: jest.fn() }));
jest.mock('../../src/services/messageService', () => ({ getNewMessageCount: jest.fn() }));
jest.mock('../../src/services/ChatService', () => ({ getPendingMessageCount: jest.fn() }));
jest.mock('../../src/services/EventService', () => ({ getUpcomingEvents: jest.fn() }));
jest.mock('../../src/services/backupLogService', () => ({ getLastSuccessfulBackup: jest.fn(), getLastBackupAttempt: jest.fn() }));
jest.mock('../../src/services/emailQueueService', () => ({ getQueueStats: jest.fn(), retryFailedJob: jest.fn() }));
jest.mock('../../src/services/StreamingService', () => ({ getPublicEmbedMetadata: jest.fn().mockResolvedValue(null) }));

const app = require('../../src/server');
const db = require('../../src/config/db');
const DonationService = require('../../src/services/DonationService');
const userService = require('../../src/services/userService');
const messageService = require('../../src/services/messageService');
const ChatService = require('../../src/services/ChatService');
const EventService = require('../../src/services/EventService');
const backupLogService = require('../../src/services/backupLogService');
const emailQueueService = require('../../src/services/emailQueueService');

const rabbiToken = jwt.sign(
    { user_id: 'rabbi-1', role: 'rabbi', email: 'rabbi-1@x.com', token_version: 1, onboarding_complete: false },
    process.env.JWT_SECRET || 'test-jwt-secret'
);

describe('Rabbi onboarding tour is CSP-safe (U2)', () => {
    afterEach(() => jest.clearAllMocks());
    beforeEach(() => {
        db.query.mockResolvedValue({ rows: [{ id: 'rabbi-1', token_version: 1, role: 'rabbi', email: 'rabbi-1@x.com' }] });
        DonationService.getMtdTotalCents.mockResolvedValue(0);
        userService.getNewMemberCountThisMonth.mockResolvedValue(0);
        messageService.getNewMessageCount.mockResolvedValue(0);
        ChatService.getPendingMessageCount.mockResolvedValue(0);
        EventService.getUpcomingEvents.mockResolvedValue([]);
        backupLogService.getLastSuccessfulBackup.mockResolvedValue(null);
        backupLogService.getLastBackupAttempt.mockResolvedValue(null);
        emailQueueService.getQueueStats.mockResolvedValue({ counts: {}, failed: [] });
    });

    test('tour loads driver.js from /vendor, not a CDN, with no inline bootstrap script', async () => {
        const res = await request(app).get('/admin').set('Cookie', [`auth_token=${rabbiToken}`]);
        expect(res.status).toBe(200);
        // Vendored, served from 'self'
        expect(res.text).toContain('/vendor/driver.js');
        expect(res.text).toContain('/vendor/driver.css');
        // No blocked CDN, no inline bootstrap
        expect(res.text).not.toContain('cdn.jsdelivr.net');
        expect(res.text).not.toContain('window.USER_ONBOARDING_COMPLETE');
        expect(res.text).not.toContain('<script>');
        // Onboarding flag now travels on a data-* attribute
        expect(res.text).toContain('data-onboarding-complete');
        // Tour target ids preserved
        expect(res.text).toContain('id="tour-announcements"');
        expect(res.text).toContain('id="tour-calendar"');
        expect(res.text).toContain('id="tour-messages"');
        expect(res.text).toContain('id="replay-tour-btn"');
    });
});
