jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn().mockResolvedValue(true),
    AUDIT_ACTIONS: { MEMBER_APPROVED: 'MEMBER_APPROVED', MEMBER_REJECTED: 'MEMBER_REJECTED' }
}));
jest.mock('../../src/services/emailQueueService', () => ({ enqueueEmail: jest.fn().mockResolvedValue(true) }));
jest.mock('../../src/services/emailTemplateService', () => ({ renderTemplate: jest.fn(() => ({ subject: 's', html: 'h', text: 't' })) }));

const db = require('../../src/config/db');
const { enqueueEmail } = require('../../src/services/emailQueueService');
const svc = require('../../src/services/memberAdminService');

beforeEach(() => jest.clearAllMocks());

describe('memberAdminService (item 6 approval queue)', () => {
    test('listPendingApproval queries pending_approval, oldest first', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 'u1' }] });
        const rows = await svc.listPendingApproval();
        expect(rows).toHaveLength(1);
        const sql = db.query.mock.calls[0][0];
        expect(sql).toContain("status = 'pending_approval'");
        expect(sql).toContain('ORDER BY created_at ASC');
    });

    test('getPendingApprovalCount returns the integer count', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ count: 3 }] });
        expect(await svc.getPendingApprovalCount()).toBe(3);
    });

    test('approveMember activates the account and queues the welcome email', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ email: 'a@x.com', first_name: 'A' }] });
        const ok = await svc.approveMember('u1', 'admin1', '127.0.0.1');
        expect(ok).toBe(true);
        const sql = db.query.mock.calls[0][0];
        expect(sql).toContain("status = 'active'");
        expect(sql).toContain("status = 'pending_approval'"); // idempotency guard in WHERE
        expect(enqueueEmail).toHaveBeenCalledTimes(1);
    });

    test('approveMember is a no-op (no email) when the row is not pending approval', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        const ok = await svc.approveMember('u1');
        expect(ok).toBe(false);
        expect(enqueueEmail).not.toHaveBeenCalled();
    });

    test('rejectMember sets status rejected', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ email: 'a@x.com' }] });
        const ok = await svc.rejectMember('u1', 'admin1');
        expect(ok).toBe(true);
        expect(db.query.mock.calls[0][0]).toContain("status = 'rejected'");
    });

    test('rejectMember is a no-op when there is nothing pending', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        expect(await svc.rejectMember('u1')).toBe(false);
    });
});
