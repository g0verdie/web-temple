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
});
