/**
 * Operator health panel + honest banner on /admin (plan 2026-07-02-009).
 *
 * The System Status card must speak plain operator language (Backups / Live chat /
 * Email sending) with a next step for anything wrong, must NOT leak backup-pipeline
 * internals, and Redis / email-queue degradation must surface as an on-page banner
 * with a 200 response rather than a swallowed log line or a whole-dashboard 500.
 *
 * Follows the just-merged flake-fix convention: StreamingService.getPublicEmbedMetadata
 * is mocked so the render is deterministic (no cross-suite log leak).
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/DonationService', () => ({ getMtdTotalCents: jest.fn() }));
jest.mock('../../src/services/userService', () => ({ getNewMemberCountThisMonth: jest.fn() }));
jest.mock('../../src/services/messageService', () => ({ getNewMessageCount: jest.fn() }));
jest.mock('../../src/services/ChatService', () => ({ getPendingMessageCount: jest.fn(), getPendingMessages: jest.fn() }));
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
const { formatEventDateTime } = require('../../src/utils/templeTime');

const adminToken = jwt.sign(
    { user_id: 'admin-1', role: 'admin', email: 'admin-1@x.com', token_version: 1 },
    process.env.JWT_SECRET || 'test-jwt-secret'
);

const getDashboard = () => request(app).get('/admin').set('Cookie', [`auth_token=${adminToken}`]);

describe('Admin operator health panel (plan 009)', () => {
    afterEach(() => jest.clearAllMocks());
    beforeEach(() => {
        db.query.mockResolvedValue({ rows: [{ id: 'admin-1', token_version: 1, role: 'admin', email: 'admin-1@x.com' }] });
        DonationService.getMtdTotalCents.mockResolvedValue(3600);
        userService.getNewMemberCountThisMonth.mockResolvedValue(4);
        messageService.getNewMessageCount.mockResolvedValue(3);
        ChatService.getPendingMessageCount.mockResolvedValue(2);
        EventService.getUpcomingEvents.mockResolvedValue([]);
        // Healthy defaults: successful backup, readable queue with no failures.
        backupLogService.getLastSuccessfulBackup.mockResolvedValue({ timestamp: '2026-06-14T00:00:00Z' });
        backupLogService.getLastBackupAttempt.mockResolvedValue({ timestamp: '2026-06-14T00:00:00Z', status: 'SUCCESS' });
        emailQueueService.getQueueStats.mockResolvedValue({ counts: { failed: 0 }, failed: [] });
    });

    // AE1 (R1, R2): a failed attempt whose message carries pipeline internals.
    test('AE1: failed backup → "last attempt failed" with a next step and NO pipeline internals', async () => {
        backupLogService.getLastBackupAttempt.mockResolvedValue({
            timestamp: '2026-06-14T00:00:00Z',
            status: 'FAILED',
            message: 'pg_dump | openssl enc -aes-256-cbc failed: exit code 1'
        });
        backupLogService.getLastSuccessfulBackup.mockResolvedValue({ timestamp: '2026-05-01T00:00:00Z' });

        const res = await getDashboard();
        expect(res.status).toBe(200);
        expect(res.text).toContain('Backups: last attempt failed');
        // A next step for the failing state.
        expect(res.text).toContain('Review backup activity');
        // Raw pipeline internals must never reach the operator.
        expect(res.text).not.toContain('pg_dump');
        expect(res.text).not.toContain('openssl');
        // The old raw block is gone.
        expect(res.text).not.toContain('Backup Failure Detected');
    });

    // AE2 (R2, R3): nothing on record → not configured with a setup link, no red alert.
    test('AE2: no backup on record → "not configured" with a setup link and no failure alert', async () => {
        backupLogService.getLastSuccessfulBackup.mockResolvedValue(null);
        backupLogService.getLastBackupAttempt.mockResolvedValue(null);

        const res = await getDashboard();
        expect(res.status).toBe(200);
        expect(res.text).toContain('Backups: not configured');
        expect(res.text).toContain('How to set up backups');
        expect(res.text).not.toContain('Backup Failure Detected');
    });

    // AE3 (R2, R7, R8): success → OK with a templeTime date and non-alarm styling.
    test('AE3: successful backup → "OK" with a templeTime date and no alarm styling', async () => {
        const res = await getDashboard();
        expect(res.status).toBe(200);
        expect(res.text).toContain('Backups: OK');
        // Date rendered via the temple-timezone formatter, not bare toLocaleString().
        expect(res.text).toContain(formatEventDateTime('2026-06-14T00:00:00Z'));
        // Healthy → nothing renders in danger/alarm styling.
        expect(res.text).not.toContain('ops-status--danger');
        expect(res.text).not.toContain('alert-danger');
    });

    // AE4 (R5, R12): a Redis outage on the email-queue read → 200 + honest banner.
    test('AE4: email-queue read throws → 200 with an "Email sending: degraded" banner, not a 500', async () => {
        emailQueueService.getQueueStats.mockRejectedValueOnce(new Error('Redis connection refused'));

        const res = await getDashboard();
        expect(res.status).toBe(200);
        expect(res.text).toContain('Email sending: degraded');
        // Must NOT fall back to the 500 error view.
        expect(res.text).not.toContain('Unable to load the dashboard.');
    });

    // AE6 (R7): a fully healthy system renders no danger/alarm styling anywhere.
    test('AE6: fully healthy system → no danger/alarm styling', async () => {
        const res = await getDashboard();
        expect(res.status).toBe(200);
        expect(res.text).not.toContain('ops-status--danger');
        expect(res.text).not.toContain('alert-danger');
    });
});
