const userService = require('../../../src/services/userService');
const db = require('../../../src/config/db');
const { enqueueEmail } = require('../../../src/services/emailQueueService');
const { renderTemplate } = require('../../../src/services/emailTemplateService');
const { logAudit, AUDIT_ACTIONS } = require('../../../src/services/auditService');

jest.mock('../../../src/config/db');
jest.mock('../../../src/services/emailQueueService');
jest.mock('../../../src/services/emailTemplateService');
jest.mock('../../../src/services/auditService', () => {
    const actual = jest.requireActual('../../../src/services/auditService');
    return {
        ...actual,
        logAudit: jest.fn().mockResolvedValue(undefined)
    };
});

describe('userService.completeOnboarding', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should update the database and return true', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 1 }] });

        const result = await userService.completeOnboarding(1);

        expect(db.query).toHaveBeenCalledWith(
            'UPDATE users SET onboarding_complete = true, updated_at = NOW() WHERE id = $1 RETURNING id',
            [1]
        );
        expect(result).toBe(true);
    });

    it('should throw "User not found" if rows are empty', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await expect(userService.completeOnboarding(999)).rejects.toThrow('User not found');
    });

    it('should properly propagate database errors', async () => {
        db.query.mockRejectedValue(new Error('Connection timeout'));

        await expect(userService.completeOnboarding(1)).rejects.toThrow('Connection timeout');
    });
});

describe('userService.getAccountSettings', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns settings with default notification preferences when missing', async () => {
        db.query.mockResolvedValue({
            rows: [{
                id: 'user-1',
                email: 'member@example.com',
                first_name: 'Member',
                last_name: 'User',
                notification_preferences: null
            }]
        });

        const settings = await userService.getAccountSettings('user-1');

        expect(settings.notification_preferences).toEqual({
            announcements: true,
            calendar_events: true,
            messages: true,
            directory_nudge_dismissed: false
        });
    });

    it('throws when user is not found', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await expect(userService.getAccountSettings('missing')).rejects.toThrow('User not found');
    });
});

describe('userService.updateProfile', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('updates first and last name', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'user-1' }] });

        await userService.updateProfile('user-1', { first_name: 'New', last_name: 'Name' });

        expect(db.query).toHaveBeenCalledWith(
            'UPDATE users SET first_name = $1, last_name = $2, updated_at = NOW() WHERE id = $3 RETURNING id',
            ['New', 'Name', 'user-1']
        );
    });

    it('throws when user is not found', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await expect(userService.updateProfile('user-1', { first_name: 'New', last_name: 'Name' }))
            .rejects.toThrow('User not found');
    });
});

describe('userService.updatePreferences', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('merges and updates preferences', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ notification_preferences: { announcements: true } }] })
            .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] });

        const prefs = await userService.updatePreferences('user-1', { messages: false });

        expect(prefs).toEqual({ announcements: true, calendar_events: true, messages: false, directory_nudge_dismissed: false });
        expect(db.query).toHaveBeenCalledWith(
            'UPDATE users SET notification_preferences = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
            [{ announcements: true, calendar_events: true, messages: false, directory_nudge_dismissed: false }, 'user-1']
        );
    });

    it('throws for invalid preference values', async () => {
        await expect(userService.updatePreferences('user-1', { messages: 'nope' }))
            .rejects.toThrow('Invalid preference value');
    });

    // Story 5.6 / FR34: opting out of announcements must persist and merge so the
    // announcement fan-out (KTD4 SQL filter) honors it immediately.
    it('persists announcements:false while preserving other preferences', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ notification_preferences: { announcements: true, calendar_events: true } }] })
            .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] });

        const prefs = await userService.updatePreferences('user-1', { announcements: false });

        expect(prefs.announcements).toBe(false);
        expect(prefs.calendar_events).toBe(true);
        expect(db.query).toHaveBeenCalledWith(
            'UPDATE users SET notification_preferences = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
            [expect.objectContaining({ announcements: false, calendar_events: true }), 'user-1']
        );
    });
});

describe('userService.unsubscribeAll', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('sets all three bulk notification keys to false and returns true', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'user-1' }] });

        const result = await userService.unsubscribeAll('user-1');

        expect(result).toBe(true);
        expect(db.query).toHaveBeenCalledWith(
            'UPDATE users SET notification_preferences = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
            [
                expect.objectContaining({
                    announcements: false,
                    calendar_events: false,
                    messages: false
                }),
                'user-1'
            ]
        );
    });

    it('writes an audit-log entry', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'user-1' }] });

        await userService.unsubscribeAll('user-1');

        expect(logAudit).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 'user-1',
                action: AUDIT_ACTIONS.PREFERENCES_UPDATED,
                entity_type: 'user',
                entity_id: 'user-1'
            })
        );
    });

    it('is idempotent: a second call writes the same all-false preferences', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'user-1' }] });

        await userService.unsubscribeAll('user-1');
        await userService.unsubscribeAll('user-1');

        const calls = db.query.mock.calls;
        expect(calls).toHaveLength(2);
        for (const call of calls) {
            expect(call[1][0]).toEqual(expect.objectContaining({
                announcements: false,
                calendar_events: false,
                messages: false
            }));
        }
    });

    it('returns falsey for an unknown user without throwing', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await expect(userService.unsubscribeAll('missing')).resolves.toBeFalsy();
    });
});

describe('userService.requestEmailChange', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('queues confirmation email for a new address', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'current@example.com' }] })
            .mockResolvedValueOnce({ rows: [] })

        const client = {
            query: jest.fn()
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [] }) // UPDATE
                .mockResolvedValueOnce({ rows: [{ id: 'req-1' }] }) // INSERT
                .mockResolvedValueOnce({ rows: [] }), // COMMIT
            release: jest.fn()
        };
        db.pool = { connect: jest.fn().mockResolvedValue(client) };

        renderTemplate.mockReturnValue({ subject: 'Confirm Email', html: '<p>Confirm</p>', text: 'Confirm' });
        enqueueEmail.mockReturnValue(Promise.resolve({ id: 'job-1' }));

        await userService.requestEmailChange('user-1', 'new@example.com');

        expect(enqueueEmail).toHaveBeenCalled();
        expect(client.query).toHaveBeenCalled();
        expect(client.release).toHaveBeenCalled();
    });

    it('throws when new email matches current', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'user-1', email: 'same@example.com' }] });

        await expect(userService.requestEmailChange('user-1', 'same@example.com'))
            .rejects.toThrow('Email is unchanged');
    });
});

describe('userService.confirmEmailChange', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('confirms email change token', async () => {
        const client = {
            query: jest.fn()
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [{ id: 'req-1', user_id: 'user-1', new_email: 'new@example.com', expires_at: new Date(Date.now() + 60000), used: false }] })
                .mockResolvedValueOnce({ rows: [] }) // Check existing email
                .mockResolvedValueOnce({ rows: [] }) // Check for duplicate requests
                .mockResolvedValueOnce({ rows: [] }) // Update user email
                .mockResolvedValueOnce({ rows: [] }) // Mark request as used
                .mockResolvedValueOnce({ rows: [] }), // COMMIT
            release: jest.fn()
        };

        db.pool = { connect: jest.fn().mockResolvedValue(client) };

        await userService.confirmEmailChange('token-123');

        expect(client.query).toHaveBeenCalled();
        expect(client.release).toHaveBeenCalled();
    });
});
