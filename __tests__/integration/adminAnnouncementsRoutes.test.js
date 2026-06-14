const request = require('supertest');
const app = require('../../src/server');
const db = require('../../src/config/db');
const AnnouncementService = require('../../src/services/AnnouncementService');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../../src/services/AnnouncementService');

const mkToken = (role) => jwt.sign(
    { user_id: `${role}-1`, role, email: `${role}@x.com`, token_version: 1 },
    process.env.JWT_SECRET || 'test-jwt-secret'
);

const VALID_ID = '11111111-1111-1111-1111-111111111111';

describe('Admin announcements routes', () => {
    let adminToken;
    let rabbiToken;
    let socialChairToken;
    let memberToken;

    beforeAll(() => {
        adminToken = mkToken('admin');
        rabbiToken = mkToken('rabbi');
        socialChairToken = mkToken('social_chair');
        memberToken = mkToken('member');
    });

    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        // requireAuth token_version check: echo a row matching the requesting user's role.
        db.query.mockImplementation((sql, params) => {
            const id = params && params[0];
            const role = String(id || '').split('-')[0] || 'member';
            return Promise.resolve({ rows: [{ id, token_version: 1, role, email: `${role}@x.com` }] });
        });
        AnnouncementService.create.mockResolvedValue({ id: VALID_ID, title: 'T', recipientCount: 2 });
        AnnouncementService.update.mockResolvedValue({ id: VALID_ID, title: 'T2' });
        AnnouncementService.softDelete.mockResolvedValue(true);
        AnnouncementService.restore.mockResolvedValue({ id: VALID_ID, status: 'published' });
        AnnouncementService.setFeatured.mockResolvedValue({ id: VALID_ID, featured: true });
    });

    describe('access control (POST_ANNOUNCEMENTS gate)', () => {
        it('blocks a member from creating (403)', async () => {
            const res = await request(app)
                .post('/admin/announcements')
                .set('Cookie', [`auth_token=${memberToken}`])
                .send({ title: 'Hi', body: '<p>x</p>' });
            expect(res.status).toBe(403);
            expect(AnnouncementService.create).not.toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('rabbi can create; service called with title/body and actor id (201)', async () => {
            const res = await request(app)
                .post('/admin/announcements')
                .set('Cookie', [`auth_token=${rabbiToken}`])
                .send({ title: 'Shabbat', body: '<p>Join</p>' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(AnnouncementService.create).toHaveBeenCalledWith(
                expect.objectContaining({ title: 'Shabbat', body: '<p>Join</p>' }),
                expect.objectContaining({ userId: 'rabbi-1' })
            );
        });

        it('social_chair can create (FR27)', async () => {
            const res = await request(app)
                .post('/admin/announcements')
                .set('Cookie', [`auth_token=${socialChairToken}`])
                .send({ title: 'Picnic', body: '<p>Fun</p>' });
            expect(res.status).toBe(201);
            expect(AnnouncementService.create).toHaveBeenCalled();
        });

        it('missing title → 400, service not called', async () => {
            const res = await request(app)
                .post('/admin/announcements')
                .set('Cookie', [`auth_token=${rabbiToken}`])
                .send({ body: '<p>x</p>' });
            expect(res.status).toBe(400);
            expect(AnnouncementService.create).not.toHaveBeenCalled();
        });
    });

    describe('feature / delete / restore', () => {
        it('admin feature calls setFeatured with actor id', async () => {
            const res = await request(app)
                .post(`/admin/announcements/${VALID_ID}/feature`)
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ featured: true });
            expect(res.status).toBe(200);
            expect(AnnouncementService.setFeatured).toHaveBeenCalledWith(
                VALID_ID,
                expect.objectContaining({ featured: true }),
                expect.objectContaining({ userId: 'admin-1' })
            );
        });

        it('admin delete calls softDelete with actor id', async () => {
            const res = await request(app)
                .post(`/admin/announcements/${VALID_ID}/delete`)
                .set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(AnnouncementService.softDelete).toHaveBeenCalledWith(
                VALID_ID,
                expect.objectContaining({ userId: 'admin-1' })
            );
        });

        it('admin restore calls restore with actor id', async () => {
            const res = await request(app)
                .post(`/admin/announcements/${VALID_ID}/restore`)
                .set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(AnnouncementService.restore).toHaveBeenCalledWith(
                VALID_ID,
                expect.objectContaining({ userId: 'admin-1' })
            );
        });

        it('member blocked from delete (403)', async () => {
            const res = await request(app)
                .post(`/admin/announcements/${VALID_ID}/delete`)
                .set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(403);
            expect(AnnouncementService.softDelete).not.toHaveBeenCalled();
        });
    });

    describe('edit', () => {
        it('rabbi edit calls update with actor id', async () => {
            const res = await request(app)
                .post(`/admin/announcements/${VALID_ID}`)
                .set('Cookie', [`auth_token=${rabbiToken}`])
                .send({ title: 'Edited', body: '<p>new</p>' });
            expect(res.status).toBe(200);
            expect(AnnouncementService.update).toHaveBeenCalledWith(
                VALID_ID,
                expect.objectContaining({ title: 'Edited', body: '<p>new</p>' }),
                expect.objectContaining({ userId: 'rabbi-1' })
            );
        });
    });
});
