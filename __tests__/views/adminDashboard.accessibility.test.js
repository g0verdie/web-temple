/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.setImmediate = global.setImmediate || process.nextTick;

const request = require('supertest');
const { axe, toHaveNoViolations } = require('jest-axe');
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

expect.extend(toHaveNoViolations);
const AXE = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } };

describe('Rabbi/Admin dashboard accessibility (WCAG AA)', () => {
    let adminToken;
    beforeAll(() => {
        adminToken = jwt.sign(
            { user_id: 'admin-1', role: 'admin', email: 'a@x.com', token_version: 1 },
            process.env.JWT_SECRET || 'test-jwt-secret'
        );
    });
    afterEach(() => jest.clearAllMocks());
    beforeEach(() => {
        // auth token_version lookup + any unmocked read
        db.query.mockResolvedValue({ rows: [{ id: 'admin-1', token_version: 1, role: 'admin', email: 'a@x.com' }] });
        DonationService.getMtdTotalCents.mockResolvedValue(3600);
        userService.getNewMemberCountThisMonth.mockResolvedValue(4);
        messageService.getNewMessageCount.mockResolvedValue(3);
        ChatService.getPendingMessageCount.mockResolvedValue(2);
        EventService.getUpcomingEvents.mockResolvedValue([
            { id: 1, title: 'Shabbat Service', date: new Date(Date.now() + 86400000) }
        ]);
        backupLogService.getLastSuccessfulBackup.mockResolvedValue({ timestamp: '2026-06-14T00:00:00Z', size_bytes: 1024 });
        backupLogService.getLastBackupAttempt.mockResolvedValue({ timestamp: '2026-06-14T00:00:00Z', status: 'SUCCESS' });
        emailQueueService.getQueueStats.mockResolvedValue({ counts: { failed: 0 }, failed: [] });
    });

    test('admin dashboard renders with no WCAG AA violations', async () => {
        const res = await request(app).get('/admin').set('Cookie', [`auth_token=${adminToken}`]);
        expect(res.status).toBe(200);
        expect(await axe(res.text, AXE)).toHaveNoViolations();
    });
});
