const logger = require('../utils/logger');
const emailService = require('./emailService');

const BACKOFF_SCHEDULE_MS = [60000, 300000, 900000, 3600000, 21600000];
const MAX_ATTEMPTS = BACKOFF_SCHEDULE_MS.length;

const getBackoffDelay = (attemptsMade) => {
    const index = Math.max(0, Math.min(attemptsMade - 1, BACKOFF_SCHEDULE_MS.length - 1));
    return BACKOFF_SCHEDULE_MS[index];
};

const createTestQueue = () => {
    const jobs = new Map();
    const failedJobs = new Map();

    return {
        add: async (name, data, opts) => {
            const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            const job = {
                id,
                name,
                data,
                opts,
                attemptsMade: 0,
                failedReason: null,
                retry: async () => {
                    failedJobs.delete(id);
                    return true;
                }
            };
            jobs.set(id, job);
            return job;
        },
        getJobCounts: async () => ({ waiting: 0, active: 0, failed: failedJobs.size, delayed: 0, completed: 0 }),
        getFailed: async () => Array.from(failedJobs.values()),
        getJob: async (id) => jobs.get(id) || failedJobs.get(id) || null,
        close: async () => true
    };
};

const createQueue = () => {
    if (process.env.NODE_ENV === 'test') {
        return createTestQueue();
    }

    const Queue = require('bull');
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    return new Queue('email-queue', redisUrl, {
        settings: {
            backoffStrategies: {
                emailBackoff: getBackoffDelay
            }
        }
    });
};

const queue = createQueue();

const enqueueEmail = async ({ to, subject, text, html, template, data, attachments, priority }) => {
    if (!to) {
        throw new Error('Email recipient is required');
    }

    return queue.add('email', {
        to,
        subject,
        text,
        html,
        template,
        data,
        attachments
    }, {
        attempts: MAX_ATTEMPTS,
        backoff: { type: 'emailBackoff' },
        removeOnComplete: true,
        removeOnFail: false,
        priority
    });
};

const getQueueStats = async () => {
    const counts = await queue.getJobCounts();
    const failed = await queue.getFailed();

    return {
        counts,
        failed: failed.map(job => ({
            id: job.id,
            attemptsMade: job.attemptsMade,
            failedReason: job.failedReason,
            data: job.data
        }))
    };
};

const retryFailedJob = async (jobId) => {
    const job = await queue.getJob(jobId);
    if (!job) {
        return false;
    }
    await job.retry();
    return true;
};

const alertAdminFailure = async (job, error) => {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL || process.env.SMTP_USER;
    if (!adminEmail) {
        logger.warn('Admin alert skipped: no admin email configured');
        return false;
    }

    const reason = error?.message || job.failedReason || 'Unknown error';

    try {
        await emailService.sendEmail({
            to: adminEmail,
            subject: '[Web Temple] Email delivery failure',
            text: `Email job ${job.id} failed after ${job.attemptsMade} attempts.\nReason: ${reason}`,
            html: `<p>Email job <strong>${job.id}</strong> failed after ${job.attemptsMade} attempts.</p><p>Reason: ${reason}</p>`
        });
        return true;
    } catch (emailError) {
        logger.error('Failed to send admin alert email', {
            jobId: job.id,
            alertError: emailError.message,
            originalError: reason
        });
        return false;
    }
};

module.exports = {
    queue,
    enqueueEmail,
    getQueueStats,
    retryFailedJob,
    alertAdminFailure,
    BACKOFF_SCHEDULE_MS,
    MAX_ATTEMPTS,
    getBackoffDelay
};
