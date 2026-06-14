const backupLogService = require('../services/backupLogService');
const auditService = require('../services/auditService');
const emailQueueService = require('../services/emailQueueService');

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
        const emailQueue = await emailQueueService.getQueueStats();

        const StreamingService = require('../services/StreamingService');
        const chatSocketServer = require('../services/chatSocketServer');

        let activeStream = null;
        let activeChatUsers = 0;
        try {
            const embedMeta = await StreamingService.getPublicEmbedMetadata();
            if (embedMeta && embedMeta.status === 'live' && embedMeta.id) {
                activeStream = embedMeta;
                activeChatUsers = chatSocketServer.getActiveConnectionCount(embedMeta.id);
            }
        } catch (e) {
            // Ignore stream/chat count retrieval errors gracefully
        }

        res.render('layout', {
            title: 'Admin Dashboard',
            bodyView: 'admin/dashboard',
            viewData: {
                lastBackup,
                latestAttempt,
                emailQueue,
                activeStream,
                activeChatUsers
            }
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).render('error', { error });
    }
};

exports.retryEmailJob = async (req, res) => {
    try {
        const { id } = req.params;
        const success = await emailQueueService.retryFailedJob(id);

        if (!success) {
            return res.status(404).render('error', { error: 'Email job not found' });
        }

        return res.redirect('/admin');
    } catch (error) {
        console.error('Error retrying email job:', error);
        res.status(500).render('error', { error });
    }
};
