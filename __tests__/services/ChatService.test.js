const db = require('../../src/config/db');
const auditService = require('../../src/services/auditService');

jest.mock('../../src/config/db');
jest.mock('../../src/services/auditService');

describe('ChatService', () => {
    let ChatService;

    beforeAll(() => {
        auditService.AUDIT_ACTIONS = {
            CHAT_MESSAGE_APPROVED: 'CHAT_MESSAGE_APPROVED',
            CHAT_MESSAGE_DELETED: 'CHAT_MESSAGE_DELETED'
        };
        ChatService = require('../../src/services/ChatService');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        db.query.mockResolvedValue({ rows: [] });
        auditService.log.mockResolvedValue(true);
    });

    describe('createMessage', () => {
        it('successfully creates a pending message', async () => {
            const mockMsg = { id: 1, stream_id: 10, display_name: 'David', message_text: 'Hello, World!', status: 'pending' };
            db.query.mockResolvedValueOnce({ rows: [mockMsg] });

            const result = await ChatService.createMessage({
                streamId: 10,
                userId: 'user-uuid',
                displayName: 'David',
                messageText: 'Hello, World!'
            });

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO chat_messages'),
                [10, 'user-uuid', 'David', 'Hello, World!', 'pending']
            );
            expect(result).toEqual(mockMsg);
        });

        it('throws validation error if streamId is missing', async () => {
            await expect(ChatService.createMessage({
                displayName: 'David',
                messageText: 'Hello'
            })).rejects.toThrow('Invalid stream ID');
        });

        it('throws validation error if displayName is empty or too long', async () => {
            await expect(ChatService.createMessage({
                streamId: 10,
                displayName: '',
                messageText: 'Hello'
            })).rejects.toThrow('Display name is required');

            await expect(ChatService.createMessage({
                streamId: 10,
                displayName: 'a'.repeat(51),
                messageText: 'Hello'
            })).rejects.toThrow('Display name must not exceed 50 characters');
        });

        it('throws validation error if messageText is empty or too long', async () => {
            await expect(ChatService.createMessage({
                streamId: 10,
                displayName: 'David',
                messageText: ''
            })).rejects.toThrow('Message text is required');

            await expect(ChatService.createMessage({
                streamId: 10,
                displayName: 'David',
                messageText: 'a'.repeat(501)
            })).rejects.toThrow('Message text must not exceed 500 characters');
        });

        it('marks message as deleted if it matches spam heuristic (all caps >70%)', async () => {
            const mockMsg = { id: 2, stream_id: 10, display_name: 'David', message_text: 'HEY THIS IS SPAM CRYPTO FOR SALE NOW', status: 'deleted' };
            db.query.mockResolvedValueOnce({ rows: [mockMsg] });

            const result = await ChatService.createMessage({
                streamId: 10,
                displayName: 'David',
                messageText: 'HEY THIS IS SPAM CRYPTO FOR SALE NOW'
            });

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO chat_messages'),
                [10, null, 'David', 'HEY THIS IS SPAM CRYPTO FOR SALE NOW', 'deleted']
            );
            expect(result.status).toBe('deleted');
        });

        it('marks message as deleted if it contains suspicious URLs', async () => {
            const mockMsg = { id: 3, stream_id: 10, display_name: 'Spammer', message_text: 'Visit free-gifts.xyz to win!', status: 'deleted' };
            db.query.mockResolvedValueOnce({ rows: [mockMsg] });

            const result = await ChatService.createMessage({
                streamId: 10,
                displayName: 'Spammer',
                messageText: 'Visit free-gifts.xyz to win!'
            });

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO chat_messages'),
                [10, null, 'Spammer', 'Visit free-gifts.xyz to win!', 'deleted']
            );
            expect(result.status).toBe('deleted');
        });
    });

    describe('approveMessage', () => {
        it('approves message, updates DB, and writes audit log', async () => {
            const mockMsg = { id: 5, stream_id: 10, display_name: 'User', message_text: 'Good morning!', status: 'approved' };
            db.query.mockResolvedValueOnce({ rows: [mockMsg] });

            const result = await ChatService.approveMessage(5, 'mod-uuid', '127.0.0.1');

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("SET status = 'approved'"),
                [5]
            );
            expect(auditService.log).toHaveBeenCalledWith({
                user_id: 'mod-uuid',
                action: 'CHAT_MESSAGE_APPROVED',
                entity_type: 'chat_message',
                entity_id: '5',
                ip_address: '127.0.0.1',
                description: expect.stringContaining('Approved chat message from User')
            });
            expect(result).toEqual(mockMsg);
        });

        it('throws error if message not found', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            await expect(ChatService.approveMessage(999, 'mod-uuid', '127.0.0.1')).rejects.toThrow('Message not found');
        });
    });

    describe('deleteMessage', () => {
        it('deletes message, updates DB, and writes audit log', async () => {
            const mockMsg = { id: 6, stream_id: 10, display_name: 'User', message_text: 'Bad word!', status: 'deleted' };
            db.query.mockResolvedValueOnce({ rows: [mockMsg] });

            const result = await ChatService.deleteMessage(6, 'mod-uuid', '127.0.0.1');

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("SET status = 'deleted'"),
                [6]
            );
            expect(auditService.log).toHaveBeenCalledWith({
                user_id: 'mod-uuid',
                action: 'CHAT_MESSAGE_DELETED',
                entity_type: 'chat_message',
                entity_id: '6',
                ip_address: '127.0.0.1',
                description: expect.stringContaining('Deleted chat message from User')
            });
            expect(result).toEqual(mockMsg);
        });
    });

    describe('getApprovedMessagesForStream', () => {
        it('returns approved messages for streamId', async () => {
            const mockList = [
                { id: 1, display_name: 'Alice', message_text: 'Shabbat Shalom' },
                { id: 2, display_name: 'Bob', message_text: 'Good evening' }
            ];
            db.query.mockResolvedValueOnce({ rows: mockList });

            const result = await ChatService.getApprovedMessagesForStream(10);
            expect(result).toEqual(mockList);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("WHERE stream_id = $1 AND status = 'approved'"),
                [10]
            );
        });
    });

    describe('getPendingMessages', () => {
        it('returns all pending messages', async () => {
            const mockList = [{ id: 1, display_name: 'Guest', message_text: 'Help' }];
            db.query.mockResolvedValueOnce({ rows: mockList });

            const result = await ChatService.getPendingMessages();
            expect(result).toEqual(mockList);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("WHERE status = 'pending'")
            );
        });
    });

    describe('getMessagesForRecording', () => {
        it('finds closest stream and returns its approved messages', async () => {
            const serviceDate = '2026-05-22T10:00:00.000Z';
            // Mock scheduled_streams lookup returning streamId = 42
            db.query.mockResolvedValueOnce({ rows: [{ id: 42 }] });
            // Mock getApprovedMessagesForStream query
            db.query.mockResolvedValueOnce({ rows: [{ id: 100, display_name: 'Ann', message_text: 'Amen' }] });

            const result = await ChatService.getMessagesForRecording(serviceDate);

            expect(db.query).toHaveBeenNthCalledWith(1,
                expect.stringContaining('FROM scheduled_streams'),
                [new Date(serviceDate)]
            );
            expect(db.query).toHaveBeenNthCalledWith(2,
                expect.stringContaining("WHERE stream_id = $1 AND status = 'approved'"),
                [42]
            );
            expect(result).toHaveLength(1);
            expect(result[0].message_text).toBe('Amen');
        });

        it('returns empty array if no matching stream is found', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            const result = await ChatService.getMessagesForRecording('2026-05-22T10:00:00.000Z');
            expect(result).toEqual([]);
        });

        it('returns empty array for invalid date', async () => {
            const result = await ChatService.getMessagesForRecording('invalid-date-string');
            expect(result).toEqual([]);
        });
    });
});
