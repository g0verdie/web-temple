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

        test('admin → the failed-job retry form carries a CSRF token', async () => {
            db.query.mockResolvedValue({ rows: [{ id: 'admin-1', token_version: 1, role: 'admin', email: 'admin-1@x.com' }] });
            emailQueueService.getQueueStats.mockResolvedValue({
                counts: { failed: 1 },
                failed: [{ id: '42', data: { to: 'x@y.com' }, attemptsMade: 3, failedReason: 'boom' }]
            });
            const res = await request(app).get('/admin').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            // Without a _csrf field the global csurf middleware 403s the retry POST in
            // production. Scope the assertion to the retry form so it can't false-pass
            // on another form rendered by the layout.
            const retryForm = res.text.match(/<form[^>]*\/admin\/email-queue\/42\/retry[\s\S]*?<\/form>/);
            expect(retryForm).not.toBeNull();
            expect(retryForm[0]).toContain('name="_csrf"');
        });
    });

    describe('Back to Dashboard button', () => {
        beforeEach(() => {
            db.query.mockResolvedValue({ rows: [{ id: 'admin-1', token_version: 1, role: 'admin', email: 'admin-1@x.com' }] });
        });

        test('the /admin dashboard itself does NOT render a Back to Dashboard button', async () => {
            const res = await request(app).get('/admin').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).not.toContain('class="back-to-dashboard"');
        });

        test('a non-dashboard admin page renders the Back to Dashboard button linking to /admin', async () => {
            ChatService.getPendingMessages.mockResolvedValue([]);
            const res = await request(app).get('/admin/chat-moderation').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).toContain('<a href="/admin" class="back-to-dashboard">');
        });
    });

    describe('error page payload (Item 10)', () => {
        beforeEach(() => {
            db.query.mockResolvedValue({ rows: [{ id: 'admin-1', token_version: 1, role: 'admin', email: 'admin-1@x.com' }] });
        });

        test('email-queue retry → 404 with a real message when the job is missing', async () => {
            emailQueueService.retryFailedJob.mockResolvedValueOnce(false);
            const res = await request(app)
                .post('/admin/email-queue/999/retry')
                .set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(404);
            expect(res.text).toContain('Email job not found.');
            // The error page heading must reflect the real status, not a generic 500.
            expect(res.text).toContain('<h1>404 - Not Found</h1>');
            expect(res.text).not.toContain('<h1>500 - Server Error</h1>');
        });

        test('chat moderation → 500 with a real message when the service throws', async () => {
            ChatService.getPendingMessages.mockRejectedValueOnce(new Error('db down'));
            const res = await request(app)
                .get('/admin/chat-moderation')
                .set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(500);
            expect(res.text).toContain('Unable to load chat moderation.');
        });

        // Item 9 safety net: a failing backup/email-queue read must still surface as a
        // 500 after the metric reads are parallelized — error semantics must not change.
        test('dashboard → 500 when a backup read throws', async () => {
            backupLogService.getLastSuccessfulBackup.mockRejectedValueOnce(new Error('backup down'));
            const res = await request(app).get('/admin').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(500);
            expect(res.text).toContain('Unable to load the dashboard.');
        });
    });

    describe('role-aware /admin (staff access)', () => {
        const loginAs = (role) => {
            const id = `${role}-1`;
            db.query.mockResolvedValue({ rows: [{ id, token_version: 1, role, email: `${id}@x.com` }] });
            return [`auth_token=${sign(id, role)}`];
        };
        const manageLinks = (html) => {
            const section = html.match(/<section class="card mb-4" aria-labelledby="manage-heading">[\s\S]*?<\/section>/);
            expect(section).not.toBeNull();
            return [...section[0].matchAll(/href="(\/admin[^"]*)"/g)].map(m => m[1]);
        };
        const READ_SERVICES = () => [
            DonationService.getMtdTotalCents,
            userService.getNewMemberCountThisMonth,
            messageService.getNewMessageCount,
            ChatService.getPendingMessageCount,
            EventService.getUpcomingEvents,
            backupLogService.getLastSuccessfulBackup,
            backupLogService.getLastBackupAttempt,
            emailQueueService.getQueueStats
        ];

        test('social chair sees the landing with only the links their permissions allow (AE1)', async () => {
            const res = await request(app).get('/admin').set('Cookie', loginAs('social_chair'));
            expect(res.status).toBe(200);
            expect(manageLinks(res.text)).toEqual(['/admin/announcements', '/admin/calendar', '/admin/chat-moderation']);
            for (const href of ['/admin/donations', '/admin/members', '/admin/messages', '/admin/audit-logs']) {
                expect(res.text).not.toContain(`href="${href}"`);
            }
            expect(res.text).not.toContain('metric-donations');
        });

        test('treasurer sees the landing with Donations only and no dashboard data (AE2)', async () => {
            const res = await request(app).get('/admin').set('Cookie', loginAs('treasurer'));
            expect(res.status).toBe(200);
            expect(manageLinks(res.text)).toEqual(['/admin/donations']);
            expect(res.text).not.toContain('metric-donations');
            expect(res.text).not.toContain('metric-new-members');
            expect(res.text).not.toContain('Audit Logs');
        });

        test('the staff landing makes no service reads', async () => {
            await request(app).get('/admin').set('Cookie', loginAs('social_chair'));
            await request(app).get('/admin').set('Cookie', loginAs('treasurer'));
            READ_SERVICES().forEach(fn => expect(fn).not.toHaveBeenCalled());
        });

        const FULL_DASHBOARD_LINKS = {
            admin: [
                '/admin/announcements', '/admin/calendar', '/admin/donations', '/admin/directory',
                '/admin/members', '/admin/messages', '/admin/streaming', '/admin/chat-moderation',
                '/admin/pages', '/admin/audit-logs'
            ],
            rabbi: [
                '/admin/announcements', '/admin/calendar', '/admin/donations', '/admin/directory',
                '/admin/members', '/admin/messages', '/admin/streaming', '/admin/chat-moderation',
                '/admin/audit-logs'
            ],
            membership_director: [
                '/admin/announcements', '/admin/calendar', '/admin/donations', '/admin/directory',
                '/admin/members', '/admin/messages', '/admin/pages', '/admin/audit-logs'
            ]
        };
        test.each(Object.keys(FULL_DASHBOARD_LINKS))('%s still gets the full dashboard with the same Manage links', async (role) => {
            const res = await request(app).get('/admin').set('Cookie', loginAs(role));
            expect(res.status).toBe(200);
            expect(res.text).toContain('metric-donations');
            expect(manageLinks(res.text)).toEqual(FULL_DASHBOARD_LINKS[role]);
        });

        test('a member gets 403 on /admin', async () => {
            const res = await request(app).get('/admin').set('Cookie', loginAs('member'));
            expect(res.status).toBe(403);
        });

        test('the choice follows the DB role, not a stale token claim', async () => {
            // Token claims admin; the database says social_chair.
            db.query.mockResolvedValue({ rows: [{ id: 'admin-1', token_version: 1, role: 'social_chair', email: 'admin-1@x.com' }] });
            const res = await request(app).get('/admin').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).not.toContain('metric-donations');
            expect(manageLinks(res.text)).toEqual(['/admin/announcements', '/admin/calendar', '/admin/chat-moderation']);
        });

        test.each(['social_chair', 'treasurer'])('%s gets 403 on the dashboard-only routes (R4)', async (role) => {
            const cookie = loginAs(role);
            expect((await request(app).get('/admin/metrics.json').set('Cookie', cookie)).status).toBe(403);
            expect((await request(app).get('/admin/audit-logs').set('Cookie', cookie)).status).toBe(403);
            expect((await request(app).post('/admin/email-queue/42/retry').set('Cookie', cookie)).status).toBe(403);
            expect(emailQueueService.retryFailedJob).not.toHaveBeenCalled();
        });
    });
});
