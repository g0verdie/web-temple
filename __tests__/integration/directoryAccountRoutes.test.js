const request = require('supertest');
const app = require('../../src/server');
const db = require('../../src/config/db');
const MemberDirectoryService = require('../../src/services/MemberDirectoryService');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../../src/services/MemberDirectoryService');

const fullProfile = {
    first_name: 'Member', last_name: 'One', email: 'm@x.com',
    listed: false, show_phone: false, show_email: false, show_household: false,
    phone: '', household: '', bio: '', interests: ''
};

describe('Account directory routes', () => {
    let memberToken;

    beforeAll(() => {
        memberToken = jwt.sign(
            { user_id: 'member-1', role: 'member', email: 'm@x.com', token_version: 1 },
            process.env.JWT_SECRET || 'test-jwt-secret'
        );
    });

    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        // requireAuth token_version check
        db.query.mockResolvedValue({ rows: [{ id: 'member-1', token_version: 1, role: 'member', email: 'm@x.com' }] });
    });

    describe('GET /api/account/directory', () => {
        test('returns the caller\'s own profile', async () => {
            MemberDirectoryService.getMyProfile.mockResolvedValue(fullProfile);
            const res = await request(app)
                .get('/api/account/directory')
                .set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(MemberDirectoryService.getMyProfile).toHaveBeenCalledWith('member-1');
        });
    });

    describe('PUT /api/account/directory', () => {
        test('saves the listing and echoes success', async () => {
            MemberDirectoryService.saveMyProfile.mockResolvedValue({ user_id: 'member-1', listed: true });
            const res = await request(app)
                .put('/api/account/directory')
                .set('Cookie', [`auth_token=${memberToken}`])
                .send({ listed: true, bio: 'Hello', show_phone: true });
            expect(res.status).toBe(200);
            expect(MemberDirectoryService.saveMyProfile).toHaveBeenCalledWith(
                'member-1',
                expect.objectContaining({ listed: true, bio: 'Hello', show_phone: true })
            );
        });

        test('maps validation errors to 400', async () => {
            MemberDirectoryService.saveMyProfile.mockRejectedValue(new Error('Bio must be 500 characters or fewer'));
            const res = await request(app)
                .put('/api/account/directory')
                .set('Cookie', [`auth_token=${memberToken}`])
                .send({ bio: 'x'.repeat(600) });
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/Bio must be/);
        });

        test('maps the household-consent error to 400', async () => {
            MemberDirectoryService.saveMyProfile.mockRejectedValue(
                new Error('Household consent acknowledgement is required to show household')
            );
            const res = await request(app)
                .put('/api/account/directory')
                .set('Cookie', [`auth_token=${memberToken}`])
                .send({ show_household: true });
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/consent/i);
        });
    });

    describe('GET /account/directory (edit page renders)', () => {
        test('renders the directory listing form', async () => {
            MemberDirectoryService.getMyProfile.mockResolvedValue(fullProfile);
            const res = await request(app)
                .get('/account/directory')
                .set('Cookie', [`auth_token=${memberToken}`]);
            expect(res.status).toBe(200);
            expect(res.text).toContain('id="directoryForm"');
            expect(res.text).toContain('name="listed"');
            expect(res.text).toContain('name="household_consent"');
            expect(res.text).toContain('/js/directory-listing.js');
        });
    });
});
