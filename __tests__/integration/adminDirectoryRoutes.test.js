const request = require('supertest');
const app = require('../../src/server');
const db = require('../../src/config/db');
const MemberDirectoryService = require('../../src/services/MemberDirectoryService');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../../src/services/MemberDirectoryService');

const mkToken = (role) => jwt.sign(
    { user_id: `${role}-1`, role, email: `${role}@x.com`, token_version: 1 },
    process.env.JWT_SECRET || 'test-jwt-secret'
);

describe('Admin directory routes', () => {
    let adminToken;
    let memberToken;

    beforeAll(() => {
        adminToken = mkToken('admin');
        memberToken = mkToken('member');
    });

    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        db.query.mockImplementation((sql, params) => {
            // requireAuth token_version check: echo a row matching the requesting user's role.
            const id = params && params[0];
            const role = String(id || '').startsWith('admin') ? 'admin' : 'member';
            return Promise.resolve({ rows: [{ id, token_version: 1, role, email: `${role}@x.com` }] });
        });
    });

    describe('access control (R16/R17 gate)', () => {
        it('blocks a member from the admin list (403)', async () => {
            const res = await request(app).get('/admin/directory').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(403);
            expect(MemberDirectoryService.listAllMembersForAdmin).not.toHaveBeenCalled();
        });

        it('blocks a member from moderating (403)', async () => {
            const res = await request(app)
                .post('/admin/directory/moderate')
                .set('Cookie', [`auth_token=${memberToken}`])
                .send({ user_id: 'u2', unlist: 'on' });
            expect(res.status).toBe(403);
            expect(MemberDirectoryService.moderateProfile).not.toHaveBeenCalled();
        });
    });

    describe('admin list', () => {
        it('renders all members, including an unlisted one (AE4 admin side)', async () => {
            MemberDirectoryService.listAllMembersForAdmin.mockResolvedValue({
                members: [
                    { user_id: 'u-listed', first_name: 'Lin', last_name: 'Listed', email: 'lin@x.com', listed: true, has_profile: true },
                    { user_id: 'u-private', first_name: 'Pat', last_name: 'Private', email: 'pat@x.com', listed: false, has_profile: true }
                ],
                totalCount: 2, totalPages: 1, currentPage: 1
            });
            const res = await request(app).get('/admin/directory').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).toContain('Pat'); // unlisted member visible to admin
            expect(res.text).toContain('Lin');
            expect(MemberDirectoryService.listAllMembersForAdmin).toHaveBeenCalledWith(
                expect.objectContaining({ search: '', page: 1, limit: 20 })
            );
        });
    });

    describe('export (item 8)', () => {
        it('blocks a member from CSV export (403) and never reads the dataset', async () => {
            const res = await request(app).get('/admin/directory/export.csv').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(403);
            expect(MemberDirectoryService.listAllForExport).not.toHaveBeenCalled();
        });

        it('blocks a member from JSON export (403)', async () => {
            const res = await request(app).get('/admin/directory/export.json').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(403);
            expect(MemberDirectoryService.listAllForExport).not.toHaveBeenCalled();
        });

        it('admin gets a CSV attachment', async () => {
            MemberDirectoryService.listAllForExport.mockResolvedValue([{ first_name: 'Lin', last_name: 'Listed' }]);
            MemberDirectoryService.toCsv.mockReturnValue('Name,Email\n"Lin Listed",""');
            const res = await request(app).get('/admin/directory/export.csv').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(res.header['content-type']).toMatch(/text\/csv/);
            expect(res.header['content-disposition']).toMatch(/attachment; filename="member-directory\.csv"/);
            expect(res.text).toContain('Lin Listed');
            expect(MemberDirectoryService.listAllForExport).toHaveBeenCalled();
        });

        it('admin gets a JSON attachment', async () => {
            MemberDirectoryService.listAllForExport.mockResolvedValue([{ first_name: 'Lin', last_name: 'Listed' }]);
            MemberDirectoryService.toExportJson.mockReturnValue([{ Name: 'Lin Listed', Email: '' }]);
            const res = await request(app).get('/admin/directory/export.json').set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.status).toBe(200);
            expect(res.header['content-type']).toMatch(/application\/json/);
            expect(res.header['content-disposition']).toMatch(/attachment; filename="member-directory\.json"/);
            expect(JSON.parse(res.text)).toEqual([{ Name: 'Lin Listed', Email: '' }]);
        });
    });

    describe('moderation', () => {
        it('unlists + clears fields and redirects back', async () => {
            MemberDirectoryService.moderateProfile.mockResolvedValue({ moderated: true });
            const res = await request(app)
                .post('/admin/directory/moderate')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ user_id: 'u2', unlist: 'on', clearFields: ['bio', 'household_encrypted'] });
            expect(res.status).toBe(302);
            expect(res.header.location).toBe('/admin/directory');
            expect(MemberDirectoryService.moderateProfile).toHaveBeenCalledWith('u2', expect.objectContaining({
                unlist: true,
                clearFields: ['bio', 'household_encrypted'],
                actorId: 'admin-1'
            }));
        });

        it('400s when no member is specified', async () => {
            const res = await request(app)
                .post('/admin/directory/moderate')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ unlist: 'on' });
            expect(res.status).toBe(400);
            expect(MemberDirectoryService.moderateProfile).not.toHaveBeenCalled();
        });
    });
});
