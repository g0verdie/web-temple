const backupLogService = require('../services/backupLogService');
const auditService = require('../services/auditService');

exports.getAuditLogs = async (req, res) => {
    try {
        const { action, userId, entityType, startDate, endDate, limit, offset } = req.query;

        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 1000);
        const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

        const logsData = await auditService.queryLogs({
            action,
            user_id: userId,
            entity_type: entityType,
            startDate,
            endDate,
            limit: parsedLimit,
            offset: parsedOffset
        });

        const totalPages = Math.max(1, Math.ceil(logsData.total / parsedLimit));
        const currentPage = Math.min(Math.floor(parsedOffset / parsedLimit) + 1, totalPages);

        res.render('layout', {
            title: 'Audit Logs',
            bodyView: 'admin/audit-logs',
            viewData: {
                logs: logsData.logs,
                total: logsData.total,
                limit: parsedLimit,
                offset: parsedOffset,
                currentPage,
                totalPages,
                filters: req.query,
                actions: auditService.AUDIT_ACTIONS
            }
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).render('error', { error });
    }
};

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
