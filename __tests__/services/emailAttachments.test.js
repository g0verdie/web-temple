// NODE_ENV=test makes emailQueueService use its in-memory test queue.
const emailQueueService = require('../../src/services/emailQueueService');
const { startEmailQueueWorker } = require('../../src/workers/emailQueueWorker');

describe('email pipeline carries attachments (donations PDF receipts)', () => {
    test('enqueueEmail includes attachments in the queued job data', async () => {
        const attachments = [{ filename: 'receipt.pdf', content: Buffer.from('%PDF-1.4') }];
        const job = await emailQueueService.enqueueEmail({
            to: 'donor@example.com',
            subject: 'Your receipt',
            html: '<p>thanks</p>',
            text: 'thanks',
            attachments
        });
        expect(job.data.attachments).toEqual(attachments);
    });

    test('worker forwards attachments to the mailer', async () => {
        let handler;
        const fakeQueue = {
            process: (_name, fn) => { handler = fn; },
            on: () => {},
            getJobCounts: async () => ({}),
            close: async () => {}
        };
        const mailer = { sendEmail: jest.fn().mockResolvedValue({}) };
        const log = { info: jest.fn(), error: jest.fn() };

        const worker = startEmailQueueWorker({ queue: fakeQueue, mailer, log });

        const attachments = [{ filename: 'receipt.pdf', content: Buffer.from('%PDF-1.4') }];
        await handler({ id: 'j1', data: { to: 'donor@example.com', subject: 'R', html: '<p>x</p>', text: 'x', attachments } });

        expect(mailer.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ attachments }));
        await worker.stop();
    });

    test('worker omits attachments when none are present (no regression)', async () => {
        let handler;
        const fakeQueue = { process: (_n, fn) => { handler = fn; }, on: () => {}, getJobCounts: async () => ({}), close: async () => {} };
        const mailer = { sendEmail: jest.fn().mockResolvedValue({}) };
        const worker = startEmailQueueWorker({ queue: fakeQueue, mailer, log: { info: jest.fn(), error: jest.fn() } });

        await handler({ id: 'j2', data: { to: 'a@b.com', subject: 'S', html: '<p>x</p>', text: 'x' } });

        expect(mailer.sendEmail).toHaveBeenCalledWith(expect.not.objectContaining({ attachments: expect.anything() }));
        await worker.stop();
    });
});
