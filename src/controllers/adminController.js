const backupLogService = require('../services/backupLogService');
const auditService = require('../services/auditService');
const emailQueueService = require('../services/emailQueueService');
const logger = require('../utils/logger');

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

// Format an uptime duration (seconds) into a compact human string for the tile.
const formatUptime = (seconds) => {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

// Gather the auto-refreshing dashboard metrics. Each metric is independently
// guarded so one failing query degrades to a safe default instead of blanking
// (or 500-ing) the whole dashboard (Story 9.1, NFR-P6). Returns plain numbers
// plus the live-stream object for the chat card.
const gatherLiveMetrics = async () => {
    const DonationService = require('../services/DonationService');
    const userService = require('../services/userService');
    const messageService = require('../services/messageService');
    const ChatService = require('../services/ChatService');
    const StreamingService = require('../services/StreamingService');
    const chatSocketServer = require('../services/chatSocketServer');

    const safe = async (label, fn, fallback) => {
        try {
            return await fn();
        } catch (err) {
            logger.error(`Dashboard metric '${label}' failed: ${err.message}`);
            return fallback;
        }
    };

    // Use the lightweight MTD-only query (decrypts just this month's donations) on
    // the 30s-polled path — not the full all-time dashboard aggregator.
    const donationsMtdCents = await safe('donations', () => DonationService.getMtdTotalCents(), 0);
    const newMembersThisMonth = await safe('newMembers', () => userService.getNewMemberCountThisMonth(), 0);
    const pendingMessages = await safe('pendingMessages', () => messageService.getNewMessageCount(), 0);
    const pendingChat = await safe('pendingChat', () => ChatService.getPendingMessageCount(), 0);

    let activeStream = null;
    let activeChatUsers = 0;
    try {
        const embedMeta = await StreamingService.getPublicEmbedMetadata();
        if (embedMeta && embedMeta.status === 'live' && embedMeta.id) {
            activeStream = embedMeta;
            activeChatUsers = chatSocketServer.getActiveConnectionCount(embedMeta.id);
        }
    } catch (e) {
        // stream/chat count is best-effort
    }

    return {
        newMembersThisMonth,
        donationsMtdCents,
        activeChatUsers,
        pendingMessages,
        pendingChat,
        serverUptimeSeconds: Math.floor(process.uptime()),
        activeStream
    };
};

exports.getDashboard = async (req, res) => {
    try {
        // Backup + email-queue reads can throw → surfaced as a 500 (they back the
        // status cards and preserve the existing error-handling contract).
        const lastBackup = await backupLogService.getLastSuccessfulBackup();
        const latestAttempt = await backupLogService.getLastBackupAttempt();
        const emailQueue = await emailQueueService.getQueueStats();

        const m = await gatherLiveMetrics();

        // Today's Priorities (Story 9.3): upcoming events in the next 7 days.
        let upcomingEvents = [];
        try {
            const EventService = require('../services/EventService');
            const evts = await EventService.getUpcomingEvents(20);
            const cutoff = Date.now() + 7 * 24 * 60 * 60 * 1000;
            upcomingEvents = evts.filter(e => e.date && e.date.getTime() <= cutoff);
        } catch (err) {
            logger.error(`Dashboard upcoming-events failed: ${err.message}`);
        }

        const alerts = {
            backupFailed: !!(latestAttempt && latestAttempt.status !== 'SUCCESS'),
            failedEmailJobs: (emailQueue && emailQueue.counts && emailQueue.counts.failed) || 0
        };

        res.render('layout', {
            title: 'Admin Dashboard',
            bodyView: 'admin/dashboard',
            viewData: {
                lastBackup,
                latestAttempt,
                emailQueue,
                activeStream: m.activeStream,
                activeChatUsers: m.activeChatUsers,
                metrics: {
                    newMembersThisMonth: m.newMembersThisMonth,
                    donationsMtdCents: m.donationsMtdCents,
                    activeChatUsers: m.activeChatUsers,
                    pendingMessages: m.pendingMessages,
                    pendingChat: m.pendingChat,
                    serverUptime: formatUptime(m.serverUptimeSeconds),
                    lastBackupAt: lastBackup ? lastBackup.timestamp : null
                },
                priorities: {
                    pendingChat: m.pendingChat,
                    pendingMessages: m.pendingMessages,
                    upcomingEvents,
                    alerts
                }
            }
        });
    } catch (error) {
        logger.error(`Error loading dashboard: ${error.message}`);
        res.status(500).render('error', { error });
    }
};

// JSON metrics for the 30s client-side auto-refresh (Story 9.1). Fully guarded —
// a polling endpoint degrades to defaults, never 500. RBAC (admin/rabbi) is
// enforced by the route middleware.
exports.getDashboardMetricsJson = async (req, res) => {
    try {
        const m = await gatherLiveMetrics();
        let lastBackupAt = null;
        try {
            const lastBackup = await backupLogService.getLastSuccessfulBackup();
            lastBackupAt = lastBackup ? lastBackup.timestamp : null;
        } catch (e) {
            // best-effort
        }
        res.json({
            newMembersThisMonth: m.newMembersThisMonth,
            donationsMtdCents: m.donationsMtdCents,
            activeChatUsers: m.activeChatUsers,
            pendingMessages: m.pendingMessages,
            pendingChat: m.pendingChat,
            serverUptime: formatUptime(m.serverUptimeSeconds),
            lastBackupAt
        });
    } catch (error) {
        logger.error(`Error loading dashboard metrics JSON: ${error.message}`);
        res.status(200).json({});
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
