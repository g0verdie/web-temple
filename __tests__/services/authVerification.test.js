jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/utils/authHelper', () => ({ hashPassword: jest.fn(), comparePassword: jest.fn() }));
jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn().mockResolvedValue(true),
    AUDIT_ACTIONS: { USER_LOGIN: 'USER_LOGIN', EMAIL_VERIFIED: 'EMAIL_VERIFIED', VERIFICATION_RESENT: 'VERIFICATION_RESENT' }
}));
jest.mock('../../src/services/emailQueueService', () => ({ enqueueEmail: jest.fn().mockResolvedValue(true) }));
jest.mock('../../src/services/emailTemplateService', () => ({ renderTemplate: jest.fn(() => ({ subject: 's', html: 'h', text: 't' })) }));

const db = require('../../src/config/db');
const { comparePassword } = require('../../src/utils/authHelper');
const { enqueueEmail } = require('../../src/services/emailQueueService');
const { authenticateUser, verifyEmailToken, resendVerification } = require('../../src/services/authService');

const baseUser = (over = {}) => ({
    id: 'u1', email: 'a@x.com', password_hash: 'h', role: 'member',
    first_name: 'A', last_name: 'B', token_version: 1, onboarding_complete: false,
    failed_login_attempts: 0, lockout_until: null, status: 'active', ...over
});

beforeEach(() => jest.clearAllMocks());

describe('authenticateUser two-gate status gate (item 6)', () => {
    test('active account logs in', async () => {
        db.query.mockResolvedValueOnce({ rows: [baseUser()] }).mockResolvedValueOnce({ rows: [] });
        comparePassword.mockResolvedValueOnce(true);
        const u = await authenticateUser({ email: 'a@x.com', password: 'x' });
        expect(u.id).toBe('u1');
    });

    test('pending_verification is blocked with a "verify your email" message', async () => {
        db.query.mockResolvedValueOnce({ rows: [baseUser({ status: 'pending_verification' })] });
        comparePassword.mockResolvedValueOnce(true);
        await expect(authenticateUser({ email: 'a@x.com', password: 'x' })).rejects.toThrow(/verify your email/i);
    });

    test('pending_approval is blocked with an "awaiting approval" message', async () => {
        db.query.mockResolvedValueOnce({ rows: [baseUser({ status: 'pending_approval' })] });
        comparePassword.mockResolvedValueOnce(true);
        await expect(authenticateUser({ email: 'a@x.com', password: 'x' })).rejects.toThrow(/awaiting approval/i);
    });

    test('rejected is blocked', async () => {
        db.query.mockResolvedValueOnce({ rows: [baseUser({ status: 'rejected' })] });
        comparePassword.mockResolvedValueOnce(true);
        await expect(authenticateUser({ email: 'a@x.com', password: 'x' })).rejects.toThrow(/not approved/i);
    });

    test('legacy null status is treated as active', async () => {
        db.query.mockResolvedValueOnce({ rows: [baseUser({ status: null })] }).mockResolvedValueOnce({ rows: [] });
        comparePassword.mockResolvedValueOnce(true);
        const u = await authenticateUser({ email: 'a@x.com', password: 'x' });
        expect(u.id).toBe('u1');
    });

    test('a wrong password never reaches the gate (generic message, no status leak)', async () => {
        db.query.mockResolvedValueOnce({ rows: [baseUser({ status: 'pending_verification' })] }).mockResolvedValueOnce({ rows: [] });
        comparePassword.mockResolvedValueOnce(false);
        await expect(authenticateUser({ email: 'a@x.com', password: 'x' })).rejects.toThrow('Invalid email or password');
    });
});

describe('verifyEmailToken (Gate 1)', () => {
    const okClient = () => ({ query: jest.fn().mockResolvedValue({ rowCount: 1 }), release: jest.fn() });

    test('valid token flips pending_verification -> pending_approval and commits', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 'ev1', user_id: 'u1', expires_at: new Date(Date.now() + 3600000), used: false, status: 'pending_verification' }] });
        const client = okClient();
        db.pool.connect.mockResolvedValueOnce(client);
        const res = await verifyEmailToken({ token: 'tok' });
        expect(res.status).toBe('verified');
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("status = 'pending_approval'"), ['u1']);
        expect(client.query).toHaveBeenCalledWith('COMMIT');
    });

    test('concurrent consume (UPDATE matches 0 rows) returns "already" rather than a misleading "verified"', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 'ev1', user_id: 'u1', expires_at: new Date(Date.now() + 3600000), used: false, status: 'pending_verification' }] });
        const client = { query: jest.fn().mockResolvedValue({ rowCount: 0 }), release: jest.fn() };
        db.pool.connect.mockResolvedValueOnce(client);
        const res = await verifyEmailToken({ token: 'tok' });
        expect(res.status).toBe('already');
    });

    test('unknown token throws an opaque error', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await expect(verifyEmailToken({ token: 'nope' })).rejects.toThrow(/invalid or expired/i);
    });

    test('already-verified account is idempotent (returns "already", no transaction)', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 'ev1', user_id: 'u1', expires_at: new Date(Date.now() + 3600000), used: true, status: 'active' }] });
        const res = await verifyEmailToken({ token: 'tok' });
        expect(res.status).toBe('already');
        expect(db.pool.connect).not.toHaveBeenCalled();
    });

    test('expired token throws', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 'ev1', user_id: 'u1', expires_at: new Date(Date.now() - 1000), used: false, status: 'pending_verification' }] });
        await expect(verifyEmailToken({ token: 'old' })).rejects.toThrow(/invalid or expired/i);
    });

    test('missing token throws without a DB call', async () => {
        await expect(verifyEmailToken({ token: '' })).rejects.toThrow(/invalid or expired/i);
        expect(db.query).not.toHaveBeenCalled();
    });
});

describe('resendVerification (opaque response)', () => {
    const opaque = /if an unverified account exists/i;

    test('unknown email returns opaque message and sends nothing', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        const r = await resendVerification({ email: 'no@x.com' });
        expect(r.message).toMatch(opaque);
        expect(enqueueEmail).not.toHaveBeenCalled();
    });

    test('already-active email returns opaque message and sends nothing', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 'u1', first_name: 'A', status: 'active' }] });
        const r = await resendVerification({ email: 'a@x.com' });
        expect(r.message).toMatch(opaque);
        expect(enqueueEmail).not.toHaveBeenCalled();
    });

    test('pending_verification email issues a fresh token + sends an email', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 'u1', first_name: 'A', status: 'pending_verification' }] }) // SELECT user
            .mockResolvedValueOnce({ rows: [] })  // UPDATE invalidate prior tokens
            .mockResolvedValueOnce({ rows: [] }); // INSERT new token
        const r = await resendVerification({ email: 'a@x.com' });
        expect(r.message).toMatch(opaque);
        expect(enqueueEmail).toHaveBeenCalledTimes(1);
    });

    test('missing email returns opaque message without a DB call', async () => {
        const r = await resendVerification({});
        expect(r.message).toMatch(opaque);
        expect(db.query).not.toHaveBeenCalled();
    });
});
