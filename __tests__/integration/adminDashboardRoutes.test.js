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

const app = require('../../src/server');
const db = require('../../src/config/db');
const DonationService = require('../../src/services/DonationService');
const userService = require('../../src/services/userService');
const messageService = require('../../src/services/messageService');
const ChatService = require('../../src/services/ChatService');
const EventService = require('../../src/services/EventService');
const backupLogService = require('../../src/services/backupLogService');
const emailQueueService = require('../../src/services/emailQueueService');

const sign = (id, role) => jwt.sign({ user_id: id, role, email: `${id}@x.com`, token_version: 1 }, process.env.JWT_SECRET || 'test-jwt-secret');
const memberToken = sign('member-1', 'member');
const adminToken = sign('admin-1', 'admin');

describe('Admin dashboard routes (Story 9.1)', () => {
    afterEach(() => jest.clearAllMocks());
    beforeEach(() => {
        DonationService.getMtdTotalCents.mockResolvedValue(3600);
        userService.getNewMemberCountThisMonth.mockResolvedValue(4);
        messageService.getNewMessageCount.mockResolvedValue(3);
        ChatService.getPendingMessageCount.mockResolvedValue(2);
        EventService.getUpcomingEvents.mockResolvedValue([]);
        backupLogService.getLastSuccessfulBackup.mockResolvedValue({ timestamp: '2026-06-14T00:00:00Z' });
        backupLogService.getLastBackupAttempt.mockResolvedValue({ timestamp: '2026-06-14T00:00:00Z', status: 'SUCCESS' });
        emailQueueService.getQueueStats.mockResolvedValue({ counts: { failed: 0 }, failed: [] });
    });

    describe('RBAC on /admin/metrics.json (admin/rabbi only)', () => {
        test('member → 403', async () => {
            db.query.mockResolvedValue({ rows: [{ id: 'member-1', token_version: 1, role: 'member', email: 'member-1@x.com' }] });
            const res = await request(app).get('/admin/metrics.json').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(403);
        });

        test('admin → 200 with the live metric shape and no donor PII', async () => {
            db.query.mockResolvedValue({ rows: [{ id: 'admin-1', token_version: 1, role: 'admin', email: 'admin-1@x.com' }] });
            const res = await request(app).get('/admin/metrics.json').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('application/json');
            expect(res.body).toEqual(expect.objectContaining({
                newMembersThisMonth: 4,
                donationsMtdCents: 3600,
                activeChatUsers: expect.any(Number),
                pendingMessages: 3,
                pendingChat: 2,
                serverUptime: expect.any(String)
            }));
            // The polling payload must not leak donor-level data.
            expect(res.body).not.toHaveProperty('identifiedDonorCount');
            expect(JSON.stringify(res.body)).not.toMatch(/@/);
        });
    });

    describe('RBAC on /admin (dashboard page)', () => {
        test('member → 403', async () => {
            db.query.mockResolvedValue({ rows: [{ id: 'member-1', token_version: 1, role: 'member', email: 'member-1@x.com' }] });
            const res = await request(app).get('/admin').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(403);
        });

        test('admin → 200 dashboard with the metrics header', async () => {
            db.query.mockResolvedValue({ rows: [{ id: 'admin-1', token_version: 1, role: 'admin', email: 'admin-1@x.com' }] });
            const res = await request(app).get('/admin').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).toContain('Admin Dashboard');
            expect(res.text).toContain('Today\'s Priorities');
        });
    });
});
