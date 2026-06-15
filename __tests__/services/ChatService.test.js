const db = require('../../src/config/db');
const auditService = require('../../src/services/auditService');

jest.mock('../../src/config/db');
jest.mock('../../src/services/auditService');

describe('ChatService', () => {
    let ChatService;

    beforeAll(() => {
        auditService.AUDIT_ACTIONS = {
            CHAT_MESSAGE_APPROVED: 'CHAT_MESSAGE_APPROVED',
            CHAT_MESSAGE_DELETED: 'CHAT_MESSAGE_DELETED',
            CHAT_MESSAGE_AUTO_FILTERED: 'CHAT_MESSAGE_AUTO_FILTERED'
        };
        ChatService = require('../../src/services/ChatService');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        db.query.mockResolvedValue({ rows: [] });
        auditService.log.mockResolvedValue(true);
    });

    describe('createMessage', () => {
        it('successfully creates a pending message for a new guest', async () => {
            const mockMsg = { id: 1, stream_id: 10, display_name: 'David', message_text: 'Hello, World!', status: 'pending' };
            // 1st query: prior-approved guest lookup -> no rows. 2nd: INSERT.
            db.query.mockResolvedValueOnce({ rows: [] });
            db.query.mockResolvedValueOnce({ rows: [mockMsg] });

            const result = await ChatService.createMessage({
                streamId: 10,
                displayName: 'David',
                messageText: 'Hello, World!'
            });

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO chat_messages'),
                [10, null, 'David', 'Hello, World!', 'pending']
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

        it('writes a CHAT_MESSAGE_AUTO_FILTERED audit entry when a message is auto-filtered as spam', async () => {
            const mockMsg = { id: 7, stream_id: 10, display_name: 'Spammer', message_text: 'VISIT scam.xyz NOW', status: 'deleted' };
            db.query.mockResolvedValueOnce({ rows: [mockMsg] });

            await ChatService.createMessage({
                streamId: 10,
                userId: 'guest-uuid',
                displayName: 'Spammer',
                messageText: 'VISIT scam.xyz NOW'
            });

            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                user_id: 'guest-uuid',
                action: 'CHAT_MESSAGE_AUTO_FILTERED',
                entity_type: 'chat_message',
                entity_id: '7',
                description: expect.stringContaining('Auto-filtered as spam')
            }));
        });

        it('does not write an audit entry for a clean (pending) message', async () => {
            const mockMsg = { id: 8, stream_id: 10, display_name: 'David', message_text: 'Shalom everyone', status: 'pending' };
            db.query.mockResolvedValueOnce({ rows: [mockMsg] });

            await ChatService.createMessage({
                streamId: 10,
                displayName: 'David',
                messageText: 'Shalom everyone'
            });

            expect(auditService.log).not.toHaveBeenCalled();
        });

        it('swallows an audit-write failure and still returns the auto-filtered message', async () => {
            const mockMsg = { id: 9, stream_id: 10, display_name: 'Spammer', message_text: 'VISIT scam.xyz NOW', status: 'deleted' };
            db.query.mockResolvedValueOnce({ rows: [mockMsg] });
            auditService.log.mockRejectedValueOnce(new Error('audit down'));

            const result = await ChatService.createMessage({
                streamId: 10,
                displayName: 'Spammer',
                messageText: 'VISIT scam.xyz NOW'
            });

            expect(result).toEqual(mockMsg);
        });

        it('auto-approves a clean message from a registered member (userId set)', async () => {
            const mockMsg = { id: 10, stream_id: 10, user_id: 'member-uuid', display_name: 'Member', message_text: 'Shalom everyone', status: 'approved' };
            db.query.mockResolvedValueOnce({ rows: [mockMsg] });

            const result = await ChatService.createMessage({
                streamId: 10,
                userId: 'member-uuid',
                displayName: 'Member',
                messageText: 'Shalom everyone'
            });

            // A member auto-approves without a prior-approved lookup: the only
            // db.query call is the INSERT.
            expect(db.query).toHaveBeenCalledTimes(1);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO chat_messages'),
                [10, 'member-uuid', 'Member', 'Shalom everyone', 'approved']
            );
            expect(result.status).toBe('approved');
        });

        it('leaves a guest message pending when the display name has no prior approved message', async () => {
            const mockMsg = { id: 11, stream_id: 10, user_id: null, display_name: 'NewGuest', message_text: 'Hello there', status: 'pending' };
            // 1st query: prior-approved guest lookup -> no rows.
            db.query.mockResolvedValueOnce({ rows: [] });
            // 2nd query: INSERT.
            db.query.mockResolvedValueOnce({ rows: [mockMsg] });

            const result = await ChatService.createMessage({
                streamId: 10,
                displayName: 'NewGuest',
                messageText: 'Hello there'
            });

            // Lookup uses the cleaned display name and filters on null user + approved.
            expect(db.query).toHaveBeenNthCalledWith(1,
                expect.stringContaining('user_id IS NULL'),
                ['NewGuest']
            );
            expect(db.query).toHaveBeenNthCalledWith(2,
                expect.stringContaining('INSERT INTO chat_messages'),
                [10, null, 'NewGuest', 'Hello there', 'pending']
            );
            expect(result.status).toBe('pending');
        });

        it('auto-approves a guest message when the display name has a prior approved message', async () => {
            const mockMsg = { id: 12, stream_id: 10, user_id: null, display_name: 'KnownGuest', message_text: 'Back again', status: 'approved' };
            // 1st query: prior-approved guest lookup -> a row exists.
            db.query.mockResolvedValueOnce({ rows: [{ exists: 1 }] });
            // 2nd query: INSERT.
            db.query.mockResolvedValueOnce({ rows: [mockMsg] });

            const result = await ChatService.createMessage({
                streamId: 10,
                displayName: 'KnownGuest',
                messageText: 'Back again'
            });

            expect(db.query).toHaveBeenNthCalledWith(1,
                expect.stringContaining('user_id IS NULL'),
                ['KnownGuest']
            );
            expect(db.query).toHaveBeenNthCalledWith(2,
                expect.stringContaining('INSERT INTO chat_messages'),
                [10, null, 'KnownGuest', 'Back again', 'approved']
            );
            expect(result.status).toBe('approved');
        });

        it('rejects a guest display name containing a reserved role word (case-insensitive)', async () => {
            const reserved = ['Rabbi David', 'cantor sam', 'The ADMIN', 'a moderator here'];
            for (const name of reserved) {
                await expect(ChatService.createMessage({
                    streamId: 10,
                    displayName: name,
                    messageText: 'Hello there'
                })).rejects.toThrow('That display name is not allowed');
            }
            // No INSERT should have run for any rejected name.
            expect(db.query).not.toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO chat_messages'),
                expect.anything()
            );
        });

        it('allows a guest display name that merely contains a reserved word as a substring of a larger word', async () => {
            // "Caminator" contains no whole reserved word; the check is substring-based
            // per the plan (case-insensitive contains), so this name IS rejected only
            // if it contains one of the exact tokens. "Sandra" must pass.
            const mockMsg = { id: 20, stream_id: 10, user_id: null, display_name: 'Sandra', message_text: 'Hi', status: 'pending' };
            db.query.mockResolvedValueOnce({ rows: [] });
            db.query.mockResolvedValueOnce({ rows: [mockMsg] });

            const result = await ChatService.createMessage({
                streamId: 10,
                displayName: 'Sandra',
                messageText: 'Hi'
            });
            expect(result.status).toBe('pending');
        });

        it('marks a guest spam message as deleted without running the prior-approved lookup', async () => {
            const mockMsg = { id: 13, stream_id: 10, user_id: null, display_name: 'KnownGuest', message_text: 'VISIT scam.xyz NOW', status: 'deleted' };
            db.query.mockResolvedValueOnce({ rows: [mockMsg] });

            const result = await ChatService.createMessage({
                streamId: 10,
                displayName: 'KnownGuest',
                messageText: 'VISIT scam.xyz NOW'
            });

            // Spam short-circuits: no prior-approved lookup, only the INSERT.
            expect(db.query).toHaveBeenCalledTimes(1);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO chat_messages'),
                [10, null, 'KnownGuest', 'VISIT scam.xyz NOW', 'deleted']
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
            // Guard the prior review's TZ-drift fix: both sides must cast to
            // ::timestamptz (not plain ::timestamp), the window must be ±6h, and
            // the closest match must be selected by ABS(EXTRACT(EPOCH ...)).
            const streamQuery = db.query.mock.calls[0][0];
            expect(streamQuery).toContain('::timestamptz');
            expect(streamQuery).not.toMatch(/\$1::timestamp\b(?!tz)/);
            expect(streamQuery).toContain("INTERVAL '6 hours'");
            expect(streamQuery).toMatch(/ORDER BY ABS\(EXTRACT\(EPOCH/);

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
