const { startEmailQueueWorker } = require('../../src/workers/emailQueueWorker');

describe('emailQueueWorker', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('processes email jobs with templates', async () => {
        const queue = {
            process: jest.fn((name, handler) => {
                queue._handler = handler;
            }),
            on: jest.fn(),
            getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, failed: 0, delayed: 0, completed: 0 }),
            close: jest.fn()
        };
        const templateService = {
            renderTemplate: jest.fn().mockReturnValue({
                subject: 'Welcome',
                text: 'Hello',
                html: '<p>Hello</p>'
            })
        };
        const mailer = { sendEmail: jest.fn().mockResolvedValue({}) };
        const queueService = { MAX_ATTEMPTS: 5, alertAdminFailure: jest.fn() };
        const log = { info: jest.fn(), error: jest.fn() };

        const worker = startEmailQueueWorker({
            queue,
            queueService,
            templateService,
            mailer,
            log
        });

        await queue._handler({
            id: 'job-1',
            data: { to: 'test@example.com', template: 'welcome', data: { name: 'Ilya' } }
        });

        expect(templateService.renderTemplate).toHaveBeenCalledWith('welcome', { name: 'Ilya' });
        expect(mailer.sendEmail).toHaveBeenCalledWith({
            to: 'test@example.com',
            subject: 'Welcome',
            text: 'Hello',
            html: '<p>Hello</p>'
        });

        await worker.stop();
    });

    test('alerts admin after max attempts failure', async () => {
        const queue = {
            process: jest.fn(),
            on: jest.fn((event, handler) => {
                if (event === 'failed') {
                    queue._failed = handler;
                }
            }),
            getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, failed: 0, delayed: 0, completed: 0 }),
            close: jest.fn()
        };
        const queueService = { MAX_ATTEMPTS: 5, alertAdminFailure: jest.fn() };
        const log = { info: jest.fn(), error: jest.fn() };

        const worker = startEmailQueueWorker({
            queue,
            queueService,
            templateService: { renderTemplate: jest.fn() },
            mailer: { sendEmail: jest.fn() },
            log
        });

        await queue._failed({ id: 'job-2', attemptsMade: 5 }, new Error('fail'));

        expect(queueService.alertAdminFailure).toHaveBeenCalled();

        await worker.stop();
    });

    test('threads template List-Unsubscribe headers into the outbound payload', async () => {
        const queue = {
            process: jest.fn((name, handler) => { queue._handler = handler; }),
            on: jest.fn(),
            getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, failed: 0, delayed: 0, completed: 0 }),
            close: jest.fn()
        };
        const headers = {
            'List-Unsubscribe': '<https://temple.example.com/unsubscribe?token=z>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        };
        const templateService = {
            renderTemplate: jest.fn().mockReturnValue({ subject: 'A', text: 't', html: '<p>t</p>', headers })
        };
        const mailer = { sendEmail: jest.fn().mockResolvedValue({}) };

        const worker = startEmailQueueWorker({
            queue,
            queueService: { MAX_ATTEMPTS: 5, alertAdminFailure: jest.fn() },
            templateService,
            mailer,
            log: { info: jest.fn(), error: jest.fn() }
        });

        await queue._handler({
            id: 'job-3',
            data: { to: 'a@b.c', template: 'announcement-notification', data: {} }
        });

        // Exact match: headers are present and no unexpected keys leak into the payload.
        expect(mailer.sendEmail).toHaveBeenCalledWith({
            to: 'a@b.c', subject: 'A', text: 't', html: '<p>t</p>', headers
        });

        await worker.stop();
    });

    test('threads headers from a pre-rendered (template-less) job into the payload', async () => {
        const queue = {
            process: jest.fn((name, handler) => { queue._handler = handler; }),
            on: jest.fn(),
            getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, failed: 0, delayed: 0, completed: 0 }),
            close: jest.fn()
        };
        const headers = {
            'List-Unsubscribe': '<https://temple.example.com/unsubscribe?token=t>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        };
        const mailer = { sendEmail: jest.fn().mockResolvedValue({}) };

        const worker = startEmailQueueWorker({
            queue,
            queueService: { MAX_ATTEMPTS: 5, alertAdminFailure: jest.fn() },
            templateService: { renderTemplate: jest.fn() },
            mailer,
            log: { info: jest.fn(), error: jest.fn() }
        });

        // No template — the email was rendered eagerly at the call site (announcements,
        // recordings), so the headers ride on the job payload, not on a fresh render.
        await queue._handler({
            id: 'job-4',
            data: { to: 'a@b.c', subject: 'S', text: 't', html: '<p>h</p>', headers }
        });

        expect(mailer.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ headers }));

        await worker.stop();
    });
});
