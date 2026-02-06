const adminController = require('../../src/controllers/adminController');
const backupLogService = require('../../src/services/backupLogService');
const auditService = require('../../src/services/auditService');

jest.mock('../../src/services/backupLogService', () => ({
    getLastSuccessfulBackup: jest.fn(),
    getLastBackupAttempt: jest.fn()
}));

jest.mock('../../src/services/auditService', () => ({
    queryLogs: jest.fn(),
    AUDIT_ACTIONS: {}
}));

describe('Admin Controller - Backup Status', () => {
    let req, res;

    beforeEach(() => {
        req = {};
        res = {
            render: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
        jest.clearAllMocks();
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
});
