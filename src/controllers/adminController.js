const backupLogService = require('../services/backupLogService');

exports.getDashboard = async (req, res) => {
    try {
        const lastBackup = await backupLogService.getLastSuccessfulBackup();
        const latestAttempt = await backupLogService.getLastBackupAttempt();

        res.render('layout', {
            title: 'Admin Dashboard',
            bodyView: 'admin/dashboard',
            viewData: {
                lastBackup,
                latestAttempt
            }
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).render('error', { error });
    }
};
