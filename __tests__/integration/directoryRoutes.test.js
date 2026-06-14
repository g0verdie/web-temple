const request = require('supertest');
const app = require('../../src/server');
const db = require('../../src/config/db');
const MemberDirectoryService = require('../../src/services/MemberDirectoryService');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../../src/services/MemberDirectoryService');

describe('Member directory routes', () => {
    let memberToken;

    beforeAll(() => {
        memberToken = jwt.sign(
            { user_id: 'member-1', role: 'member', email: 'm@x.com', token_version: 1 },
            process.env.JWT_SECRET || 'test-jwt-secret'
        );
    });

    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        db.query.mockResolvedValue({ rows: [{ id: 'member-1', token_version: 1, role: 'member', email: 'm@x.com' }] });
    });

    describe('GET /directory', () => {
        it('redirects to login when unauthenticated', async () => {
            const orig = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            const res = await request(app).get('/directory');
            process.env.NODE_ENV = orig;
            expect(res.status).toBe(302);
            expect(res.header.location).toMatch(/\/login/);
        });

        it('renders listed profiles for an authenticated member', async () => {
            MemberDirectoryService.listListedProfiles.mockResolvedValue({
                profiles: [{ user_id: 'u2', first_name: 'Ada', last_name: 'Lovelace', initials: 'AL', bio: 'math', interests: 'Youth Committee', email: 'ada@x.com' }],
                totalCount: 1, totalPages: 1, currentPage: 1
            });
            const res = await request(app).get('/directory').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(200);
            expect(MemberDirectoryService.listListedProfiles).toHaveBeenCalledWith(
                expect.objectContaining({ search: '', page: 1, limit: 20 })
            );
            expect(res.text).toContain('Ada');
            expect(res.text).not.toMatch(/tel:/); // no phone key on the row → never rendered
        });

        it('passes the search term and shows the no-results state', async () => {
            MemberDirectoryService.listListedProfiles.mockResolvedValue({ profiles: [], totalCount: 0, totalPages: 0, currentPage: 1 });
            const res = await request(app).get('/directory?search=choir').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(200);
            expect(MemberDirectoryService.listListedProfiles).toHaveBeenCalledWith(expect.objectContaining({ search: 'choir' }));
            expect(res.text).toMatch(/No members match/);
        });

        it('shows the empty-directory state when nothing is listed and no search', async () => {
            MemberDirectoryService.listListedProfiles.mockResolvedValue({ profiles: [], totalCount: 0, totalPages: 0, currentPage: 1 });
            const res = await request(app).get('/directory').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.text).toMatch(/No members are listed/);
        });

        it('returns 400 for an invalid page', async () => {
            const res = await request(app).get('/directory?page=0').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(400);
            expect(MemberDirectoryService.listListedProfiles).not.toHaveBeenCalled();
        });
    });

    describe('GET /directory/:id', () => {
        it('renders a listed profile with shown contact links', async () => {
            MemberDirectoryService.getListedProfile.mockResolvedValue({
                user_id: 'u2', first_name: 'Ada', last_name: 'Lovelace', initials: 'AL',
                bio: 'b', interests: 'i', email: 'ada@x.com', phone: '555-0001'
            });
            const res = await request(app).get('/directory/u2').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).toContain('mailto:ada@x.com');
            expect(res.text).toContain('tel:555-0001');
        });

        it('404s for a member who is not listed', async () => {
            MemberDirectoryService.getListedProfile.mockResolvedValue(null);
            const res = await request(app).get('/directory/u9').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(404);
        });

        it('never renders a hidden phone (no tel link when phone is absent)', async () => {
            MemberDirectoryService.getListedProfile.mockResolvedValue({
                user_id: 'u2', first_name: 'Ada', last_name: 'Lovelace', initials: 'AL',
                bio: 'b', interests: 'i', email: 'ada@x.com' // no phone key → server-side hidden
            });
            const res = await request(app).get('/directory/u2').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).not.toMatch(/tel:/);
            expect(res.text).toContain('mailto:ada@x.com');
        });
    });

    describe('activation nudge (R20)', () => {
        beforeEach(() => {
            MemberDirectoryService.listListedProfiles.mockResolvedValue({ profiles: [], totalCount: 0, totalPages: 0, currentPage: 1 });
        });

        it('renders the nudge for a not-listed, not-dismissed member', async () => {
            MemberDirectoryService.getNudgeState.mockResolvedValue({ listed: false, dismissed: false, showNudge: true });
            const res = await request(app).get('/directory').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).toMatch(/not listed in the member directory yet/);
        });

        it('hides the nudge when the member is listed or has dismissed it', async () => {
            MemberDirectoryService.getNudgeState.mockResolvedValue({ listed: true, dismissed: false, showNudge: false });
            const res = await request(app).get('/directory').set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).not.toMatch(/not listed in the member directory yet/);
        });

        it('POST /directory/nudge/dismiss persists dismissal and redirects', async () => {
            MemberDirectoryService.dismissNudge.mockResolvedValue(true);
            const res = await request(app)
                .post('/directory/nudge/dismiss')
                .set('Cookie', [`auth_token=${memberToken}`])
                .send({});
            expect(res.status).toBe(302);
            expect(res.header.location).toBe('/directory');
            expect(MemberDirectoryService.dismissNudge).toHaveBeenCalledWith('member-1');
        });
    });
});
