const backupLogService = require('../services/backupLogService');
const auditService = require('../services/auditService');
const emailQueueService = require('../services/emailQueueService');
const logger = require('../utils/logger');
const { formatEventDateTime } = require('../utils/templeTime');

// Next-step guidance for any non-OK operator status. An entry links only when a
// genuinely relevant destination exists; a next step with no `href` renders as plain
// guidance text (a link that explains nothing is worse than no link). Email delivery
// is checked and retried in the Email Queue card lower on this same page (#email-queue).
// "How to set up backups" has no in-app destination — backups are configured
// server-side — so it stays plain text until an operator runbook lands.
const NEXT_STEP = {
    backupsSetup: { text: 'How to set up backups' },
    backupsFailing: { href: '/admin/audit-logs', text: 'Review backup activity' },
    email: { href: '/admin#email-queue', text: 'How to check email delivery' },
    chat: { href: '/admin/chat-moderation', text: 'Open chat moderation' }
};

// Derive plain-language operator status for the System Status card from the raw
// service signals (plan 009). Never leaks pipeline internals; every non-OK state
// carries a next step. level ∈ {ok, warning, danger} drives non-alarm vs alarm
// styling, and any degraded infrastructure read is flagged as a banner (R5/R7).
const buildOperatorStatus = ({ lastBackup, latestAttempt, emailOk, emailFailedCount, chatReachable, streamLive }) => {
    let backups;
    if (!latestAttempt && !lastBackup) {
        backups = {
            key: 'backups', level: 'warning', label: 'Backups: not configured',
            detail: 'No backup has run yet. Set up automatic backups to protect the site’s data.',
            next: NEXT_STEP.backupsSetup
        };
    } else if (latestAttempt && latestAttempt.status !== 'SUCCESS') {
        backups = {
            key: 'backups', level: 'danger', label: 'Backups: last attempt failed',
            detail: lastBackup
                ? `Last successful backup ${formatEventDateTime(lastBackup.timestamp)}.`
                : 'No successful backup is on record.',
            next: NEXT_STEP.backupsFailing
        };
    } else {
        backups = {
            key: 'backups', level: 'ok', label: 'Backups: OK',
            detail: lastBackup ? `Last backup ${formatEventDateTime(lastBackup.timestamp)}.` : '',
            next: null
        };
    }

    let email;
    if (!emailOk) {
        email = {
            key: 'email', level: 'warning', label: 'Email sending: degraded',
            detail: 'The email service could not be reached, so delivery status is unknown right now.',
            next: NEXT_STEP.email, banner: true
        };
    } else if (emailFailedCount > 0) {
        email = {
            key: 'email', level: 'warning',
            label: `Email sending: ${emailFailedCount} message${emailFailedCount === 1 ? '' : 's'} failed`,
            detail: 'Some emails could not be delivered. Review and retry them in the Email Queue below.',
            next: NEXT_STEP.email
        };
    } else {
        email = {
            key: 'email', level: 'ok', label: 'Email sending: OK',
            detail: 'Emails are being delivered normally.', next: null
        };
    }

    let chat;
    if (!chatReachable) {
        chat = {
            key: 'chat', level: 'warning', label: 'Live chat: degraded',
            detail: 'The live-chat service could not be reached.',
            next: NEXT_STEP.chat, banner: true
        };
    } else if (streamLive) {
        chat = {
            key: 'chat', level: 'ok', label: 'Live chat: OK',
            detail: 'A stream is live and chat is connected.', next: null
        };
    } else {
        chat = {
            key: 'chat', level: 'ok', label: 'Live chat: OK',
            detail: 'Ready. No stream is broadcasting right now.', next: null
        };
    }

    const items = [backups, chat, email];
    return { items, banners: items.filter((i) => i.banner) };
};

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
            stylesheets: ['/css/admin.css'],
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
        logger.error('Error fetching audit logs', { error });
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load audit logs.' });
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
    const memberAdminService = require('../services/memberAdminService');
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

    // Stream/chat count is best-effort; resolve it as a unit so it can run alongside
    // the other metrics without one failure blanking the rest.
    const safeStream = async () => {
        try {
            const embedMeta = await StreamingService.getPublicEmbedMetadata();
            if (embedMeta && embedMeta.status === 'live' && embedMeta.id) {
                return { activeStream: embedMeta, activeChatUsers: chatSocketServer.getActiveConnectionCount(embedMeta.id), reachable: true };
            }
        } catch (e) {
            // A read error (vs a genuine "no live stream") is surfaced as a degraded
            // live-chat status in the operator panel rather than swallowed silently.
            return { activeStream: null, activeChatUsers: 0, reachable: false };
        }
        return { activeStream: null, activeChatUsers: 0, reachable: true };
    };

    // Each metric is independently guarded, so these run concurrently (NFR-P6 <2s).
    // Use the lightweight MTD-only query (decrypts just this month's donations) on
    // the 30s-polled path — not the full all-time dashboard aggregator.
    const [donationsMtdCents, newMembersThisMonth, pendingMessages, pendingApprovals, pendingChat, stream] = await Promise.all([
        safe('donations', () => DonationService.getMtdTotalCents(), 0),
        safe('newMembers', () => userService.getNewMemberCountThisMonth(), 0),
        safe('pendingMessages', () => messageService.getNewMessageCount(), 0),
        safe('pendingApprovals', () => memberAdminService.getPendingApprovalCount(), 0),
        safe('pendingChat', () => ChatService.getPendingMessageCount(), 0),
        safeStream()
    ]);

    return {
        newMembersThisMonth,
        donationsMtdCents,
        activeChatUsers: stream.activeChatUsers,
        pendingMessages,
        pendingApprovals,
        pendingChat,
        serverUptimeSeconds: Math.floor(process.uptime()),
        activeStream: stream.activeStream,
        chatReachable: stream.reachable
    };
};

exports.getDashboard = async (req, res) => {
    try {
        // Today's Priorities (Story 9.3): upcoming events in the next 7 days.
        // Self-degrading to [] so it can run alongside the status-card reads.
        const upcomingEventsPromise = (async () => {
            try {
                const EventService = require('../services/EventService');
                const evts = await EventService.getUpcomingEvents(20);
                const cutoff = Date.now() + 7 * 24 * 60 * 60 * 1000;
                return evts.filter(e => e.date && e.date.getTime() <= cutoff);
            } catch (err) {
                logger.error(`Dashboard upcoming-events failed: ${err.message}`);
                return [];
            }
        })();

        // The email-queue read self-degrades to a status marker (plan 009 R5/R12):
        // a Redis / queue outage must surface as an honest on-page banner with a 200,
        // not a swallowed log line or a whole-dashboard 500. Backup reads stay strict
        // (their failure keeps the existing 500 contract).
        const emailQueuePromise = (async () => {
            try {
                return { ok: true, stats: await emailQueueService.getQueueStats() };
            } catch (err) {
                logger.error(`Dashboard email-queue read failed: ${err.message}`);
                return { ok: false, stats: null };
            }
        })();

        // The independent reads run concurrently to meet NFR-P6 (<2s dashboard load).
        const [lastBackup, latestAttempt, emailRead, m, upcomingEvents] = await Promise.all([
            backupLogService.getLastSuccessfulBackup(),
            backupLogService.getLastBackupAttempt(),
            emailQueuePromise,
            gatherLiveMetrics(),
            upcomingEventsPromise
        ]);

        const emailQueue = emailRead.ok ? emailRead.stats : null;
        const failedEmailJobs = (emailQueue && emailQueue.counts && emailQueue.counts.failed) || 0;

        const operatorStatus = buildOperatorStatus({
            lastBackup,
            latestAttempt,
            emailOk: emailRead.ok,
            emailFailedCount: failedEmailJobs,
            chatReachable: m.chatReachable,
            streamLive: !!m.activeStream
        });

        const alerts = {
            backupFailed: !!(latestAttempt && latestAttempt.status !== 'SUCCESS'),
            failedEmailJobs
        };

        res.render('layout', {
            title: 'Admin Dashboard',
            bodyView: 'admin/dashboard',
            stylesheets: ['/css/admin.css'],
            viewData: {
                lastBackup,
                latestAttempt,
                emailQueue,
                operatorStatus,
                activeStream: m.activeStream,
                activeChatUsers: m.activeChatUsers,
                metrics: {
                    newMembersThisMonth: m.newMembersThisMonth,
                    donationsMtdCents: m.donationsMtdCents,
                    activeChatUsers: m.activeChatUsers,
                    pendingMessages: m.pendingMessages,
                    pendingApprovals: m.pendingApprovals,
                    pendingChat: m.pendingChat
                },
                priorities: {
                    pendingChat: m.pendingChat,
                    pendingMessages: m.pendingMessages,
                    pendingApprovals: m.pendingApprovals,
                    upcomingEvents,
                    alerts
                }
            }
        });
    } catch (error) {
        logger.error(`Error loading dashboard: ${error.message}`);
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to load the dashboard.' });
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
            pendingApprovals: m.pendingApprovals,
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
            return res.status(404).render('error', { title: '404 - Not Found', message: 'Email job not found.' });
        }

        return res.redirect('/admin');
    } catch (error) {
        logger.error('Error retrying email job', { error });
        res.status(500).render('error', { title: '500 - Server Error', message: 'Unable to retry the email job.' });
    }
};
