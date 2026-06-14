jest.mock('../../src/config/db', () => ({ query: jest.fn() }));

const db = require('../../src/config/db');
const ChatService = require('../../src/services/ChatService');
const messageService = require('../../src/services/messageService');
const userService = require('../../src/services/userService');

describe('dashboard metric count helpers', () => {
    afterEach(() => jest.clearAllMocks());

    test('ChatService.getPendingMessageCount counts pending chat messages', async () => {
        db.query.mockResolvedValue({ rows: [{ count: 5 }] });
        const n = await ChatService.getPendingMessageCount();
        expect(n).toBe(5);
        const sql = db.query.mock.calls[0][0];
        expect(sql).toContain('COUNT(*)');
        expect(sql).toContain('chat_messages');
        expect(sql).toContain("status = 'pending'");
    });

    test('messageService.getNewMessageCount counts new contact messages', async () => {
        db.query.mockResolvedValue({ rows: [{ count: 2 }] });
        const n = await messageService.getNewMessageCount();
        expect(n).toBe(2);
        const sql = db.query.mock.calls[0][0];
        expect(sql).toContain('COUNT(*)');
        expect(sql).toContain('FROM messages');
        expect(sql).toContain("status = 'new'");
    });

    test('userService.getNewMemberCountThisMonth counts members since the month start', async () => {
        db.query.mockResolvedValue({ rows: [{ count: 7 }] });
        const n = await userService.getNewMemberCountThisMonth();
        expect(n).toBe(7);
        const [sql, params] = db.query.mock.calls[0];
        expect(sql).toContain('COUNT(*)');
        expect(sql).toContain('FROM users');
        expect(sql).toContain('created_at >= $1');
        // boundary computed in JS and passed as a Date param (tz-safe), 1st of the month
        expect(params[0]).toBeInstanceOf(Date);
        expect(params[0].getDate()).toBe(1);
    });

    test('count helpers default to 0 when no row is returned', async () => {
        db.query.mockResolvedValue({ rows: [] });
        expect(await ChatService.getPendingMessageCount()).toBe(0);
        expect(await messageService.getNewMessageCount()).toBe(0);
        expect(await userService.getNewMemberCountThisMonth()).toBe(0);
    });
});
