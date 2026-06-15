const db = require('../../src/config/db');
const CacheService = require('../../src/services/CacheService');
const emailQueueService = require('../../src/services/emailQueueService');
const emailTemplateService = require('../../src/services/emailTemplateService');
const auditService = require('../../src/services/auditService');
const { verifyUnsubscribeToken } = require('../../src/utils/unsubscribeToken');

jest.mock('../../src/config/db');
jest.mock('../../src/services/CacheService');
jest.mock('../../src/services/emailQueueService');
jest.mock('../../src/services/emailTemplateService');
jest.mock('../../src/services/auditService');

describe('AnnouncementService', () => {
    let AnnouncementService;
    let client;

    beforeAll(() => {
        auditService.AUDIT_ACTIONS = {
            ANNOUNCEMENT_CREATED: 'ANNOUNCEMENT_CREATED',
            ANNOUNCEMENT_UPDATED: 'ANNOUNCEMENT_UPDATED',
            ANNOUNCEMENT_DELETED: 'ANNOUNCEMENT_DELETED',
            ANNOUNCEMENT_FEATURED: 'ANNOUNCEMENT_FEATURED'
        };
        AnnouncementService = require('../../src/services/AnnouncementService');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        client = { query: jest.fn(), release: jest.fn() };
        db.query.mockResolvedValue({ rows: [] });
        db.pool = { connect: jest.fn().mockResolvedValue(client) };
        CacheService.get.mockResolvedValue(null);
        CacheService.set.mockResolvedValue(true);
        CacheService.invalidatePattern.mockResolvedValue(true);
        emailTemplateService.renderTemplate.mockReturnValue({
            subject: 'New Announcement: Test',
            html: '<p>body</p>',
            text: 'body'
        });
        emailQueueService.enqueueEmail.mockResolvedValue({ id: 'job-1' });
        auditService.logAudit.mockResolvedValue(true);
    });

    const insertedRow = (overrides = {}) => ({
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Shabbat Notice',
        body_html: '<p>Hello</p>',
        body_text: 'Hello',
        status: 'published',
        featured: false,
        featured_until: null,
        published_at: new Date('2026-06-14T00:00:00Z'),
        updated_at: new Date('2026-06-14T00:00:00Z'),
        deleted_at: null,
        ...overrides
    });

    describe('create (happy path + fan-out)', () => {
        it('inserts once, enqueues only to opted-in members, audits, invalidates cache', async () => {
            client.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [insertedRow()] }) // INSERT
                .mockResolvedValueOnce({ rows: [ // opted-in members SELECT
                    { id: 'm1', email: 'a@x.com', first_name: 'A' },
                    { id: 'm2', email: 'b@x.com', first_name: 'B' }
                ] })
                .mockResolvedValueOnce({}); // COMMIT

            const result = await AnnouncementService.create(
                { title: 'Shabbat Notice', body: '<p>Hello</p>' },
                { userId: 'rabbi-1', ipAddress: '127.0.0.1' }
            );

            // One INSERT into announcements.
            const insertCall = client.query.mock.calls.find(c => /INSERT INTO announcements/.test(c[0]));
            expect(insertCall).toBeTruthy();

            // Recipients filtered at SQL layer on announcements pref.
            const memberCall = client.query.mock.calls.find(c => /notification_preferences->>'announcements'/.test(c[0]));
            expect(memberCall).toBeTruthy();

            // Exactly two enqueues (the two opted-in members).
            expect(emailQueueService.enqueueEmail).toHaveBeenCalledTimes(2);
            const recipients = emailQueueService.enqueueEmail.mock.calls.map(c => c[0].to).sort();
            expect(recipients).toEqual(['a@x.com', 'b@x.com']);

            // Each rendered template now carries a signed unsubscribe token
            // (previously absent) that verifies back to the recipient's id.
            const m1Render = emailTemplateService.renderTemplate.mock.calls
                .find(c => c[1] && c[1].memberName === 'A')[1];
            expect(m1Render.unsubscribeToken).toBeTruthy();
            expect(verifyUnsubscribeToken(m1Render.unsubscribeToken)).toBe('m1');

            expect(auditService.logAudit).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'ANNOUNCEMENT_CREATED', entity_type: 'announcement' })
            );
            expect(CacheService.invalidatePattern).toHaveBeenCalledWith('announcement:*');
            expect(result.recipientCount).toBe(2);
        });

        it('rejects a blank title before opening a transaction', async () => {
            await expect(
                AnnouncementService.create({ title: '   ', body: 'x' }, { userId: 'rabbi-1' })
            ).rejects.toThrow('Title is required');
            expect(db.pool.connect).not.toHaveBeenCalled();
        });
    });

    describe('sanitization (security crux, KTD2)', () => {
        it('strips <script>, onclick, and javascript: hrefs from body_html', () => {
            const { bodyHtml } = AnnouncementService.sanitizeBody(
                '<p onclick="evil()">ok</p><script>alert(1)</script><a href="javascript:alert(1)">link</a>'
            );
            expect(bodyHtml).not.toMatch(/script/i);
            expect(bodyHtml).not.toMatch(/onclick/i);
            expect(bodyHtml).not.toMatch(/javascript:/i);
            expect(bodyHtml).toContain('<p>ok</p>');
        });

        it('keeps allowlisted formatting, http links, and images with alt', () => {
            const { bodyHtml } = AnnouncementService.sanitizeBody(
                '<strong>bold</strong> <a href="https://x.com">x</a> <img src="https://x.com/a.png" alt="A pic">'
            );
            expect(bodyHtml).toContain('<strong>bold</strong>');
            expect(bodyHtml).toContain('href="https://x.com"');
            expect(bodyHtml).toContain('alt="A pic"');
        });

        it('drops <img> that has no alt text (a11y)', () => {
            const { bodyHtml } = AnnouncementService.sanitizeBody('<img src="https://x.com/a.png">');
            expect(bodyHtml).not.toMatch(/<img/i);
        });
    });

    describe('update (edit)', () => {
        it('preserves published_at, does not enqueue email, audits before/after', async () => {
            const id = '11111111-1111-1111-1111-111111111111';
            db.query
                .mockResolvedValueOnce({ rows: [{ id, title: 'Old', body_html: '<p>old</p>', body_text: 'old' }] }) // before
                .mockResolvedValueOnce({ rows: [insertedRow({ title: 'New', body_html: '<p>new</p>', body_text: 'new' })] }); // UPDATE

            await AnnouncementService.update(id, { title: 'New', body: '<p>new</p>' }, { userId: 'rabbi-1' });

            const updateCall = db.query.mock.calls.find(c => /UPDATE announcements/.test(c[0]));
            expect(updateCall[0]).not.toMatch(/published_at/);
            expect(emailQueueService.enqueueEmail).not.toHaveBeenCalled();
            expect(auditService.logAudit).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'ANNOUNCEMENT_UPDATED',
                    before_state: expect.objectContaining({ title: 'Old' }),
                    after_state: expect.objectContaining({ title: 'New' })
                })
            );
            expect(CacheService.invalidatePattern).toHaveBeenCalledWith('announcement:*');
        });

        it('throws not found for a missing published row', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            await expect(
                AnnouncementService.update('11111111-1111-1111-1111-111111111111', { title: 'X', body: 'y' }, { userId: 'r' })
            ).rejects.toThrow('not found');
        });
    });

    describe('setFeatured (one-at-a-time, 30-day expiry)', () => {
        it('clears other featured rows then sets this row with ~30d expiry', async () => {
            const id = '11111111-1111-1111-1111-111111111111';
            client.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({}) // clear others
                .mockResolvedValueOnce({ rows: [insertedRow({ featured: true })] }) // set this
                .mockResolvedValueOnce({}); // COMMIT

            await AnnouncementService.setFeatured(id, { featured: true }, { userId: 'admin-1' });

            const clearCall = client.query.mock.calls.find(c => /SET featured = false WHERE featured = true AND id <> \$1/.test(c[0]));
            expect(clearCall).toBeTruthy();

            const setCall = client.query.mock.calls.find(c => /SET featured = \$2/.test(c[0]));
            expect(setCall[1][1]).toBe(true);
            const until = new Date(setCall[1][2]).getTime();
            const expected = Date.now() + 30 * 24 * 60 * 60 * 1000;
            expect(Math.abs(until - expected)).toBeLessThan(60000);

            expect(auditService.logAudit).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'ANNOUNCEMENT_FEATURED' })
            );
        });
    });

    describe('softDelete + restore', () => {
        it('soft delete sets status=deleted, audits full content, invalidates', async () => {
            const id = '11111111-1111-1111-1111-111111111111';
            db.query
                .mockResolvedValueOnce({ rows: [{ id, title: 'Bye', body_html: '<p>bye</p>', body_text: 'bye', status: 'published' }] })
                .mockResolvedValueOnce({});

            await AnnouncementService.softDelete(id, { userId: 'admin-1' });

            const delCall = db.query.mock.calls.find(c => /SET status = 'deleted'/.test(c[0]));
            expect(delCall).toBeTruthy();
            expect(auditService.logAudit).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'ANNOUNCEMENT_DELETED', before_state: expect.objectContaining({ title: 'Bye' }) })
            );
            expect(CacheService.invalidatePattern).toHaveBeenCalledWith('announcement:*');
        });

        it('restore brings a deleted row back to published', async () => {
            const id = '11111111-1111-1111-1111-111111111111';
            db.query.mockResolvedValueOnce({ rows: [insertedRow({ status: 'published' })] });

            await AnnouncementService.restore(id, { userId: 'admin-1' });

            const restoreCall = db.query.mock.calls.find(c => /SET status = 'published', deleted_at = NULL/.test(c[0]));
            expect(restoreCall).toBeTruthy();
            expect(CacheService.invalidatePattern).toHaveBeenCalledWith('announcement:*');
        });
    });

    describe('getHomepageAnnouncements (cache)', () => {
        it('queries DB on miss, caches, and decorates rows', async () => {
            db.query.mockResolvedValueOnce({
                rows: [insertedRow({ featured: true, featured_until: new Date(Date.now() + 86400000) })]
            });

            const list = await AnnouncementService.getHomepageAnnouncements(5);

            expect(db.query).toHaveBeenCalledTimes(1);
            expect(list[0].isFeatured).toBe(true);
            expect(CacheService.set).toHaveBeenCalledWith('announcement:homepage', expect.any(Array), 120);
        });

        it('returns cached payload without a DB query on hit', async () => {
            CacheService.get.mockResolvedValueOnce([{ id: 'cached', title: 'C', isFeatured: false }]);
            const list = await AnnouncementService.getHomepageAnnouncements(5);
            expect(list[0].id).toBe('cached');
            expect(db.query).not.toHaveBeenCalled();
        });
    });

    describe('fan-out failure isolation (U7)', () => {
        it('one rejected enqueue does not abort the others or throw', async () => {
            client.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [insertedRow()] }) // INSERT
                .mockResolvedValueOnce({ rows: [
                    { id: 'm1', email: 'a@x.com', first_name: 'A' },
                    { id: 'm2', email: 'b@x.com', first_name: 'B' },
                    { id: 'm3', email: 'c@x.com', first_name: 'C' }
                ] })
                .mockResolvedValueOnce({}); // COMMIT

            emailQueueService.enqueueEmail
                .mockResolvedValueOnce({ id: 'job-1' })
                .mockRejectedValueOnce(new Error('bad address'))
                .mockResolvedValueOnce({ id: 'job-3' });

            await expect(
                AnnouncementService.create({ title: 'T', body: '<p>x</p>' }, { userId: 'rabbi-1' })
            ).resolves.toBeTruthy();

            expect(emailQueueService.enqueueEmail).toHaveBeenCalledTimes(3);
        });

        it('zero opted-in members → no enqueues, still created + cache busted', async () => {
            client.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [insertedRow()] }) // INSERT
                .mockResolvedValueOnce({ rows: [] }) // no members
                .mockResolvedValueOnce({}); // COMMIT

            const result = await AnnouncementService.create({ title: 'T', body: '<p>x</p>' }, { userId: 'rabbi-1' });
            expect(emailQueueService.enqueueEmail).not.toHaveBeenCalled();
            expect(result.recipientCount).toBe(0);
            expect(CacheService.invalidatePattern).toHaveBeenCalledWith('announcement:*');
        });
    });
});
