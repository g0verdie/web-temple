const adminController = require('../../src/controllers/adminController');
const backupLogService = require('../../src/services/backupLogService');
const auditService = require('../../src/services/auditService');
const emailQueueService = require('../../src/services/emailQueueService');
const DonationService = require('../../src/services/DonationService');
const userService = require('../../src/services/userService');
const messageService = require('../../src/services/messageService');
const ChatService = require('../../src/services/ChatService');
const EventService = require('../../src/services/EventService');

jest.mock('../../src/services/backupLogService', () => ({
    getLastSuccessfulBackup: jest.fn(),
    getLastBackupAttempt: jest.fn()
}));

jest.mock('../../src/services/auditService', () => ({
    queryLogs: jest.fn(),
    AUDIT_ACTIONS: {}
}));

jest.mock('../../src/services/emailQueueService', () => ({
    getQueueStats: jest.fn(),
    retryFailedJob: jest.fn()
}));

jest.mock('../../src/services/DonationService', () => ({ getMtdTotalCents: jest.fn() }));
jest.mock('../../src/services/userService', () => ({ getNewMemberCountThisMonth: jest.fn() }));
jest.mock('../../src/services/messageService', () => ({ getNewMessageCount: jest.fn() }));
jest.mock('../../src/services/ChatService', () => ({ getPendingMessageCount: jest.fn() }));
jest.mock('../../src/services/EventService', () => ({ getUpcomingEvents: jest.fn() }));

describe('Admin Controller - Backup Status', () => {
    let req, res;

    beforeEach(() => {
        req = {};
        res = {
            render: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
        jest.clearAllMocks();
        // Safe defaults for the live-metric services so getDashboard renders.
        DonationService.getMtdTotalCents.mockResolvedValue(0);
        userService.getNewMemberCountThisMonth.mockResolvedValue(0);
        messageService.getNewMessageCount.mockResolvedValue(0);
        ChatService.getPendingMessageCount.mockResolvedValue(0);
        EventService.getUpcomingEvents.mockResolvedValue([]);
    });

    test('should render dashboard with last successful backup', async () => {
        backupLogService.getLastSuccessfulBackup.mockResolvedValue({
            timestamp: '2023-01-01T10:05:00Z',
            status: 'SUCCESS',
            message: 'Done',
            size_bytes: 1024
        });
        backupLogService.getLastBackupAttempt.mockResolvedValue({
            timestamp: '2023-01-01T10:05:00Z',
            status: 'SUCCESS',
            message: 'Done',
            size_bytes: 1024
        });
        emailQueueService.getQueueStats.mockResolvedValue({ counts: {}, failed: [] });

        await adminController.getDashboard(req, res);

        expect(res.render).toHaveBeenCalledWith('layout', expect.objectContaining({
            bodyView: 'admin/dashboard',
            viewData: expect.objectContaining({
                lastBackup: expect.objectContaining({
                    status: 'SUCCESS',
                    size_bytes: 1024
                })
            })
        }));
    });

    test('should handle missing log file', async () => {
        backupLogService.getLastSuccessfulBackup.mockResolvedValue(null);
        backupLogService.getLastBackupAttempt.mockResolvedValue(null);
        emailQueueService.getQueueStats.mockResolvedValue({ counts: {}, failed: [] });

        await adminController.getDashboard(req, res);

        expect(res.render).toHaveBeenCalledWith('layout', expect.objectContaining({
            bodyView: 'admin/dashboard',
            viewData: expect.objectContaining({
                lastBackup: null
            })
        }));
    });

    test('should handle corrupt log file', async () => {
        backupLogService.getLastSuccessfulBackup.mockResolvedValue(null);
        backupLogService.getLastBackupAttempt.mockResolvedValue({
            timestamp: '2023-01-02T09:00:00Z',
            status: 'ERROR',
            message: 'Corrupt log'
        });
        emailQueueService.getQueueStats.mockResolvedValue({ counts: {}, failed: [] });

        await adminController.getDashboard(req, res);

        expect(res.render).toHaveBeenCalledWith('layout', expect.objectContaining({
            bodyView: 'admin/dashboard',
            viewData: expect.objectContaining({
                lastBackup: null
            })
        }));
    });

    test('should handle dashboard errors', async () => {
        backupLogService.getLastSuccessfulBackup.mockRejectedValue(new Error('Read error'));
        backupLogService.getLastBackupAttempt.mockRejectedValue(new Error('Read error'));
        emailQueueService.getQueueStats.mockResolvedValue({ counts: {}, failed: [] });

        await adminController.getDashboard(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.render).toHaveBeenCalledWith('error', expect.any(Object));
    });

    test('should handle audit logs errors', async () => {
        const auditReq = { query: {} };
        const auditRes = {
            render: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        auditService.queryLogs.mockRejectedValue(new Error('Audit error'));

        await adminController.getAuditLogs(auditReq, auditRes);

        expect(auditRes.status).toHaveBeenCalledWith(500);
        expect(auditRes.render).toHaveBeenCalledWith('error', expect.any(Object));
    });

    test('should retry email job and redirect', async () => {
        const retryReq = { params: { id: 'job-1' } };
        const retryRes = {
            redirect: jest.fn(),
            status: jest.fn().mockReturnThis(),
            render: jest.fn()
        };

        emailQueueService.retryFailedJob.mockResolvedValue(true);

        await adminController.retryEmailJob(retryReq, retryRes);

        expect(emailQueueService.retryFailedJob).toHaveBeenCalledWith('job-1');
        expect(retryRes.redirect).toHaveBeenCalledWith('/admin');
    });

    test('should return 404 when email job not found', async () => {
        const retryReq = { params: { id: 'missing' } };
        const retryRes = {
            redirect: jest.fn(),
            status: jest.fn().mockReturnThis(),
            render: jest.fn()
        };

        emailQueueService.retryFailedJob.mockResolvedValue(false);

        await adminController.retryEmailJob(retryReq, retryRes);

        expect(retryRes.status).toHaveBeenCalledWith(404);
        expect(retryRes.render).toHaveBeenCalledWith('error', { title: '404 - Not Found', message: 'Email job not found.' });
    });

    test('should include user onboarding_complete flag in view context for new rabbis', async () => {
        // Test AC #1: onboarding_complete flag should be available in views
        const rabbiReq = {
            user: { 
                id: 'rabbi-1', 
                role: 'rabbi', 
                onboarding_complete: false 
            }
        };
        const rabbiRes = {
            render: jest.fn(),
            status: jest.fn().mockReturnThis(),
            locals: {}
        };

        backupLogService.getLastSuccessfulBackup.mockResolvedValue(null);
        backupLogService.getLastBackupAttempt.mockResolvedValue(null);
        emailQueueService.getQueueStats.mockResolvedValue({ counts: {}, failed: [] });

        await adminController.getDashboard(rabbiReq, rabbiRes);

        expect(rabbiRes.render).toHaveBeenCalledWith('layout', expect.objectContaining({
            bodyView: 'admin/dashboard',
            title: 'Admin Dashboard'
        }));
    });

    test('should show dashboard for rabbi with completed onboarding', async () => {
        // Test AC #6: rabbi who completed tour should not be interrupted
        const completedReq = {
            user: { 
                id: 'rabbi-2', 
                role: 'rabbi', 
                onboarding_complete: true 
            }
        };
        const completedRes = {
            render: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        backupLogService.getLastSuccessfulBackup.mockResolvedValue(null);
        backupLogService.getLastBackupAttempt.mockResolvedValue(null);
        emailQueueService.getQueueStats.mockResolvedValue({ counts: {}, failed: [] });

        await adminController.getDashboard(completedReq, completedRes);

        expect(completedRes.render).toHaveBeenCalledWith('layout', expect.objectContaining({
            bodyView: 'admin/dashboard'
        }));
    });

    test('dashboard viewData includes the key metrics and priorities (Story 9.1/9.3)', async () => {
        backupLogService.getLastSuccessfulBackup.mockResolvedValue({ timestamp: '2026-06-01T00:00:00Z', status: 'SUCCESS', size_bytes: 2048 });
        backupLogService.getLastBackupAttempt.mockResolvedValue({ timestamp: '2026-06-01T00:00:00Z', status: 'SUCCESS' });
        emailQueueService.getQueueStats.mockResolvedValue({ counts: { failed: 0 }, failed: [] });
        DonationService.getMtdTotalCents.mockResolvedValue(12345);
        userService.getNewMemberCountThisMonth.mockResolvedValue(4);
        messageService.getNewMessageCount.mockResolvedValue(3);
        ChatService.getPendingMessageCount.mockResolvedValue(2);

        await adminController.getDashboard(req, res);

        expect(res.render).toHaveBeenCalledWith('layout', expect.objectContaining({
            viewData: expect.objectContaining({
                metrics: expect.objectContaining({
                    newMembersThisMonth: 4,
                    donationsMtdCents: 12345,
                    pendingMessages: 3,
                    pendingChat: 2
                }),
                priorities: expect.objectContaining({ pendingChat: 2, pendingMessages: 3 })
            })
        }));
    });

    test('a failing metric query degrades to a default without 500-ing the dashboard', async () => {
        backupLogService.getLastSuccessfulBackup.mockResolvedValue(null);
        backupLogService.getLastBackupAttempt.mockResolvedValue(null);
        emailQueueService.getQueueStats.mockResolvedValue({ counts: {}, failed: [] });
        DonationService.getMtdTotalCents.mockRejectedValue(new Error('db down'));
        userService.getNewMemberCountThisMonth.mockRejectedValue(new Error('db down'));

        await adminController.getDashboard(req, res);

        expect(res.status).not.toHaveBeenCalledWith(500);
        expect(res.render).toHaveBeenCalledWith('layout', expect.objectContaining({
            viewData: expect.objectContaining({
                metrics: expect.objectContaining({ donationsMtdCents: 0, newMembersThisMonth: 0 })
            })
        }));
    });

    test('getDashboardMetricsJson returns the live metric shape', async () => {
        const jsonRes = { json: jest.fn(), status: jest.fn().mockReturnThis() };
        DonationService.getMtdTotalCents.mockResolvedValue(500);
        userService.getNewMemberCountThisMonth.mockResolvedValue(1);
        messageService.getNewMessageCount.mockResolvedValue(0);
        ChatService.getPendingMessageCount.mockResolvedValue(5);
        backupLogService.getLastSuccessfulBackup.mockResolvedValue({ timestamp: '2026-06-01T00:00:00Z' });

        await adminController.getDashboardMetricsJson({}, jsonRes);

        expect(jsonRes.json).toHaveBeenCalledWith(expect.objectContaining({
            newMembersThisMonth: 1,
            donationsMtdCents: 500,
            pendingChat: 5,
            pendingMessages: 0,
            lastBackupAt: '2026-06-01T00:00:00Z'
        }));
    });
});
