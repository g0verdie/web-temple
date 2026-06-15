const request = require('supertest');
const app = require('../../src/server');
const db = require('../../src/config/db');
const EventService = require('../../src/services/EventService');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/EventService');

const mkToken = (role) => jwt.sign(
    { user_id: `${role}-1`, role, email: `${role}@x.com`, token_version: 1 },
    process.env.JWT_SECRET || 'test-jwt-secret'
);

describe('Admin calendar routes (U3)', () => {
    let adminToken, memberToken, socialChairToken;

    beforeAll(() => {
        adminToken = mkToken('admin');
        memberToken = mkToken('member');
        socialChairToken = mkToken('social_chair');
    });

    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        // requireAuth token_version check: echo a row matching the requesting user's role.
        db.query.mockImplementation((sql, params) => {
            const id = params && params[0];
            const idStr = String(id || '');
            let role = 'member';
            if (idStr.startsWith('admin')) role = 'admin';
            else if (idStr.startsWith('social_chair')) role = 'social_chair';
            return Promise.resolve({ rows: [{ id, token_version: 1, role, email: `${role}@x.com` }] });
        });
    });

    describe('access control (MANAGE_CALENDAR gate)', () => {
        it('blocks a member from the admin list (403)', async () => {
            const res = await request(app).get('/admin/calendar').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(403);
            expect(EventService.getEvents).not.toHaveBeenCalled();
        });

        it('blocks a member from creating (403)', async () => {
            const res = await request(app)
                .post('/admin/calendar')
                .set('Cookie', [`auth_token=${memberToken}`])
                .send({ title: 'X', starts_at: '2099-01-01T18:00' });
            expect(res.status).toBe(403);
            expect(EventService.create).not.toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('renders active events for an admin', async () => {
            EventService.getEvents.mockResolvedValue([
                { id: 1, title: 'Shabbat', date: new Date('2099-01-01T18:00:00Z'), visibility: 'public', type: 'service', location: 'Sanctuary' }
            ]);
            const res = await request(app).get('/admin/calendar').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).toContain('Shabbat');
            expect(EventService.getEvents).toHaveBeenCalledWith(true);
        });

        it('renders a usable 500 page with a real message when the service throws (Item 10)', async () => {
            EventService.getEvents.mockRejectedValueOnce(new Error('db down'));
            const res = await request(app).get('/admin/calendar').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(500);
            expect(res.text).toContain('Unable to load calendar events.');
        });
    });

    describe('create', () => {
        it('redirects on success and calls the service with user/ip', async () => {
            EventService.create.mockResolvedValue({ id: 7 });
            const res = await request(app)
                .post('/admin/calendar')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ title: 'New Event', starts_at: '2099-01-01T18:00', visibility: 'public', event_type: 'event' });
            expect(res.status).toBe(302);
            expect(res.header.location).toContain('/admin/calendar?success');
            expect(EventService.create).toHaveBeenCalledWith(
                expect.objectContaining({ title: 'New Event' }),
                'admin-1',
                expect.anything()
            );
        });

        it('re-renders the form (400) with a sticky error on validation failure', async () => {
            EventService.create.mockRejectedValue(new Error('Title is required'));
            const res = await request(app)
                .post('/admin/calendar')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ starts_at: '2099-01-01T18:00' });
            expect(res.status).toBe(400);
            expect(res.text).toContain('Title is required');
        });

        it('allows a social_chair to create a members-only event (single-permission parity)', async () => {
            EventService.create.mockResolvedValue({ id: 9 });
            const res = await request(app)
                .post('/admin/calendar')
                .set('Cookie', [`auth_token=${socialChairToken}`])
                .send({ title: 'Members Mtg', starts_at: '2099-01-01T18:00', visibility: 'members', event_type: 'event' });
            expect(res.status).toBe(302);
            expect(EventService.create).toHaveBeenCalledWith(
                expect.objectContaining({ visibility: 'members' }),
                'social_chair-1',
                expect.anything()
            );
        });
    });

    describe('edit', () => {
        it('renders the edit form prefilled', async () => {
            EventService.getEventById.mockResolvedValue({
                id: 3, title: 'Existing', date: new Date('2099-01-01T18:00:00Z'), visibility: 'public', type: 'event'
            });
            const res = await request(app).get('/admin/calendar/3/edit').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).toContain('Existing');
        });

        it('404s when the event is missing', async () => {
            EventService.getEventById.mockResolvedValue(null);
            const res = await request(app).get('/admin/calendar/999/edit').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(404);
        });

        it('updates and redirects', async () => {
            EventService.update.mockResolvedValue({ id: 3 });
            const res = await request(app)
                .post('/admin/calendar/3')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ title: 'Updated', starts_at: '2099-01-01T18:00', visibility: 'public', event_type: 'event' });
            expect(res.status).toBe(302);
            expect(EventService.update).toHaveBeenCalledWith('3', expect.objectContaining({ title: 'Updated' }), 'admin-1', expect.anything());
        });
    });

    describe('delete + restore', () => {
        it('soft-deletes and redirects', async () => {
            EventService.delete.mockResolvedValue(true);
            const res = await request(app)
                .post('/admin/calendar/4/delete')
                .set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(302);
            expect(EventService.delete).toHaveBeenCalledWith('4', 'admin-1', expect.anything());
        });

        it('renders the archive', async () => {
            EventService.getArchivedEvents.mockResolvedValue([
                { id: 5, title: 'Old Event', date: new Date('2020-01-01T00:00:00Z'), deletedAt: new Date() }
            ]);
            const res = await request(app).get('/admin/calendar/archive').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).toContain('Old Event');
        });

        it('restores and redirects', async () => {
            EventService.restore.mockResolvedValue({ id: 5 });
            const res = await request(app)
                .post('/admin/calendar/5/restore')
                .set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(302);
            expect(res.header.location).toContain('/admin/calendar/archive?success');
            expect(EventService.restore).toHaveBeenCalledWith('5', 'admin-1', expect.anything());
        });
    });
});
