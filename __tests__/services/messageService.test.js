jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
const db = require('../../src/config/db');
const svc = require('../../src/services/messageService');

const UUID = '550e8400-e29b-41d4-a716-446655440000';

beforeEach(() => jest.clearAllMocks());

describe('messageService (contact inbox, item 9)', () => {
    test('getNewMessageCount counts new messages', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ count: 4 }] });
        expect(await svc.getNewMessageCount()).toBe(4);
        expect(db.query.mock.calls[0][0]).toContain("status = 'new'");
    });

    test('listMessages filters by status and paginates newest-first', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ count: 1 }] })
            .mockResolvedValueOnce({ rows: [{ id: 'm1', name: 'A', email: 'a@x.com', subject: 'Hi', message: 'Hello', status: 'new', created_at: new Date() }] });
        const res = await svc.listMessages({ status: 'new', page: 1, limit: 20 });
        expect(res.messages).toHaveLength(1);
        expect(res.totalCount).toBe(1);
        expect(db.query.mock.calls[1][0]).toContain('ORDER BY created_at DESC');
        expect(db.query.mock.calls[1][1]).toEqual(['new', 20, 0]);
    });

    test('listMessages ignores an invalid status filter (no WHERE)', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ count: 0 }] }).mockResolvedValueOnce({ rows: [] });
        await svc.listMessages({ status: 'bogus' });
        expect(db.query.mock.calls[1][1]).toEqual([20, 0]);
    });

    test('getMessageById returns null for a non-UUID id without querying', async () => {
        expect(await svc.getMessageById('not-a-uuid')).toBeNull();
        expect(db.query).not.toHaveBeenCalled();
    });

    test('getMessageById fetches a valid UUID', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: UUID, subject: 'Hi' }] });
        expect((await svc.getMessageById(UUID)).subject).toBe('Hi');
    });

    test('updateStatus rejects an invalid status', async () => {
        await expect(svc.updateStatus(UUID, 'bogus')).rejects.toThrow(/Invalid status/);
    });

    test('updateStatus updates a valid status', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 'm1' }] });
        expect(await svc.updateStatus(UUID, 'replied')).toBe(true);
        expect(db.query.mock.calls[0][0]).toContain('UPDATE messages SET status');
    });

    test('deleteMessage removes a row by valid UUID', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 'm1' }] });
        expect(await svc.deleteMessage(UUID)).toBe(true);
        expect(db.query.mock.calls[0][0]).toContain('DELETE FROM messages');
    });

    test('deleteMessage returns false for a non-UUID id without querying', async () => {
        expect(await svc.deleteMessage('x')).toBe(false);
        expect(db.query).not.toHaveBeenCalled();
    });
});
