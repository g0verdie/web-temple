const logger = require('../utils/logger');
const emailService = require('../services/emailService');
const emailTemplateService = require('../services/emailTemplateService');
const emailQueueService = require('../services/emailQueueService');

const PROCESS_INTERVAL_MS = 30000;

const startEmailQueueWorker = ({
    queue = emailQueueService.queue,
    queueService = emailQueueService,
    templateService = emailTemplateService,
    mailer = emailService,
    log = logger
} = {}) => {
    queue.process('email', async (job) => {
        const { to, subject, text, html, template, data } = job.data;
        const rendered = template ? templateService.renderTemplate(template, data) : { subject, text, html };
        const payload = {
            to,
            subject: subject || rendered.subject,
            text: rendered.text,
            html: rendered.html
        };

        await mailer.sendEmail(payload);
        log.info(`Email job ${job.id} sent`, { jobId: job.id, to: payload.to, template });
        return payload;
    });

    queue.on('failed', async (job, error) => {
        log.error(`Email job ${job.id} failed`, { jobId: job.id, error: error?.message });
        if (job.attemptsMade >= queueService.MAX_ATTEMPTS) {
            await queueService.alertAdminFailure(job, error);
        }
    });

    const interval = setInterval(async () => {
        try {
            const counts = await queue.getJobCounts();
            log.info('Email queue worker tick', counts);
        } catch (error) {
            log.error('Email queue worker tick failed', { error: error?.message });
        }
    }, PROCESS_INTERVAL_MS);

    if (typeof interval.unref === 'function') {
        interval.unref();
    }

    const stop = async () => {
        clearInterval(interval);
        if (queue.close) {
            await queue.close();
        }
    };

    return { stop };
};

module.exports = {
    startEmailQueueWorker,
    PROCESS_INTERVAL_MS
};
