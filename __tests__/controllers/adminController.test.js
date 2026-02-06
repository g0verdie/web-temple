const adminController = require('../../src/controllers/adminController');
const fs = require('fs');
const path = require('path');

jest.mock('fs');

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
        const mockLog = [
            '{"timestamp": "2023-01-01T10:00:00Z", "status": "START", "message": "Start"}',
            '{"timestamp": "2023-01-01T10:05:00Z", "status": "SUCCESS", "message": "Done", "size_bytes": 1024}'
        ].join('\n');

        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(mockLog);

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
        fs.existsSync.mockReturnValue(false);

        await adminController.getDashboard(req, res);

        expect(res.render).toHaveBeenCalledWith('layout', expect.objectContaining({
            bodyView: 'admin/dashboard',
            viewData: expect.objectContaining({
                lastBackup: null
            })
        }));
    });

    test('should handle corrupt log file', async () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('INVALID JSON\nANOTHER BAD LINE');

        await adminController.getDashboard(req, res);

        expect(res.render).toHaveBeenCalledWith('layout', expect.objectContaining({
            bodyView: 'admin/dashboard',
            viewData: expect.objectContaining({
                lastBackup: null
            })
        }));
    });
});
