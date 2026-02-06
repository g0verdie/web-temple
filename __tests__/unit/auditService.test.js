const auditService = require('../../src/services/auditService');
const db = require('../../src/config/db');

// Mock db
jest.mock('../../src/config/db', () => ({
    query: jest.fn(),
}));

describe('AuditService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('log', () => {
        it('should insert an audit log entry', async () => {
            const logData = {
                userId: 'user-123',
                action: 'TEST_ACTION',
                entityType: 'test_entity',
                entityId: 'entity-123',
                description: 'Test description',
                ipAddress: '127.0.0.1',
                beforeState: { status: 'old' },
                afterState: { status: 'new' }
            };

            db.query.mockResolvedValue({ rowCount: 1 });

            await auditService.log(logData);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO audit_logs'),
                expect.arrayContaining([
                    logData.userId,
                    logData.action,
                    logData.entityType,
                    logData.entityId,
                    JSON.stringify(logData.beforeState),
                    JSON.stringify(logData.afterState),
                    logData.description,
                    logData.ipAddress
                ])
            );
        });

        it('should handle optional fields and snake_case', async () => {
            const logData = {
                action: 'SIMPLE_ACTION',
                user_id: 'user-456'
            };

            db.query.mockResolvedValue({ rowCount: 1 });

            await auditService.log(logData);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO audit_logs'),
                expect.arrayContaining(['user-456', 'SIMPLE_ACTION', null])
            );
        });

        it('should not throw on error (fail-open)', async () => {
            const logData = { action: 'FAIL_ACTION' };
            db.query.mockRejectedValue(new Error('DB Error'));

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            await expect(auditService.log(logData)).resolves.not.toThrow();

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('queryLogs', () => {
        it('should query logs with filters', async () => {
            const filters = {
                action: 'TEST_ACTION',
                userId: 'user-123',
                limit: 10
            };

            db.query
                .mockResolvedValueOnce({ rows: [{ id: 1, action: 'TEST_ACTION' }] }) // logs
                .mockResolvedValueOnce({ rows: [{ count: 1 }] }); // count

            const result = await auditService.queryLogs(filters);

            expect(db.query).toHaveBeenCalledTimes(2);
            expect(result.logs).toHaveLength(1);
            expect(result.total).toBe(1);
        });

        it('should accept camelCase filter aliases', async () => {
            const filters = {
                userId: 'user-456',
                entityType: 'message'
            };

            db.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: 0 }] });

            await auditService.queryLogs(filters);

            const [querySql, queryValues] = db.query.mock.calls[0];
            expect(querySql).toContain('user_id');
            expect(querySql).toContain('entity_type');
            expect(queryValues).toEqual(expect.arrayContaining(['user-456', 'message']));
        });
    });
});
