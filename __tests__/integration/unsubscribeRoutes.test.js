const request = require('supertest');
const app = require('../../src/server');
const userService = require('../../src/services/userService');
const { signUnsubscribeToken } = require('../../src/utils/unsubscribeToken');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../../src/services/userService');

const USER_ID = '11111111-1111-1111-1111-111111111111';

describe('Unsubscribe routes', () => {
    afterEach(() => jest.clearAllMocks());

    describe('GET /unsubscribe', () => {
        it('renders 200 with the token in the hidden input and no inline <script>', async () => {
            const token = signUnsubscribeToken(USER_ID);

            const res = await request(app).get(`/unsubscribe?token=${encodeURIComponent(token)}`);

            expect(res.status).toBe(200);
            expect(res.text).toContain(`id="unsubscribeToken"`);
            expect(res.text).toContain(token);
            // CSP: no inline <script> (script tags must carry a src=).
            expect(res.text).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/i);
        });

        it('renders 200 when no token is supplied', async () => {
            const res = await request(app).get('/unsubscribe');

            expect(res.status).toBe(200);
            expect(res.text).toContain(`id="unsubscribeToken"`);
        });

        it('is reachable (not swallowed by the pages catch-all)', async () => {
            const res = await request(app).get('/unsubscribe');
            expect(res.status).toBe(200);
            expect(res.status).not.toBe(404);
        });
    });

    describe('POST /api/unsubscribe/confirm', () => {
        it('returns 200 {ok:true} and calls unsubscribeAll with the decoded id for a valid token', async () => {
            userService.unsubscribeAll.mockResolvedValue(true);
            const token = signUnsubscribeToken(USER_ID);

            const res = await request(app)
                .post('/api/unsubscribe/confirm')
                .send({ token });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ ok: true });
            expect(userService.unsubscribeAll).toHaveBeenCalledWith(USER_ID);
        });

        it('returns 400 {ok:false} for a tampered token and does not call unsubscribeAll', async () => {
            const token = signUnsubscribeToken(USER_ID);
            const tampered = token.slice(0, -1) + (token.slice(-1) === 'A' ? 'B' : 'A');

            const res = await request(app)
                .post('/api/unsubscribe/confirm')
                .send({ token: tampered });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ ok: false });
            expect(userService.unsubscribeAll).not.toHaveBeenCalled();
        });

        it('returns 400 when the token is missing', async () => {
            const res = await request(app)
                .post('/api/unsubscribe/confirm')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ ok: false });
            expect(userService.unsubscribeAll).not.toHaveBeenCalled();
        });

        it('returns success-shaped (no existence leak) for a valid HMAC over an unknown user', async () => {
            // Valid signature, but the user no longer exists: unsubscribeAll returns false.
            userService.unsubscribeAll.mockResolvedValue(false);
            const token = signUnsubscribeToken(USER_ID);

            const res = await request(app)
                .post('/api/unsubscribe/confirm')
                .send({ token });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ ok: true });
            expect(userService.unsubscribeAll).toHaveBeenCalledWith(USER_ID);
        });
    });
});
