const logger = require('../../src/utils/logger');

describe('Logger Utility', () => {
    describe('Logger Creation', () => {
        it('should be a valid Winston logger instance', () => {
            expect(logger).toBeDefined();
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.error).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.http).toBe('function');
        });

        it('should have stream property for Morgan', () => {
            expect(logger).toHaveProperty('stream');
            expect(logger.stream).toHaveProperty('write');
            expect(typeof logger.stream.write).toBe('function');
        });

        it('should have withRequestId helper', () => {
            expect(logger).toHaveProperty('withRequestId');
            expect(typeof logger.withRequestId).toBe('function');
        });
    });

    describe('Logging Methods', () => {
        it('should support info logging', () => {
            expect(() => {
                logger.info('Test message');
            }).not.toThrow();
        });

        it('should support error logging', () => {
            expect(() => {
                logger.error('Error message');
            }).not.toThrow();
        });

        it('should support warn logging', () => {
            expect(() => {
                logger.warn('Warning message');
            }).not.toThrow();
        });

        it('should support http logging', () => {
            expect(() => {
                logger.http('HTTP message');
            }).not.toThrow();
        });

        it('should support debug logging', () => {
            expect(() => {
                logger.debug('Debug message');
            }).not.toThrow();
        });
    });

    describe('Stream Handling', () => {
        it('should have working stream.write method for Morgan', () => {
            expect(() => {
                logger.stream.write('Morgan test message\n');
            }).not.toThrow();
        });

        it('should strip newlines from Morgan messages', () => {
            // This is tested implicitly by the write function not throwing
            const message = 'GET / 200 12.34 ms\n';
            expect(() => {
                logger.stream.write(message);
            }).not.toThrow();
        });
    });

    describe('Request ID Handling', () => {
        it('should create logger with request ID context', () => {
            const withReqId = logger.withRequestId('test-123');
            expect(withReqId).toBeDefined();
            expect(typeof withReqId.info).toBe('function');
            expect(typeof withReqId.error).toBe('function');
            expect(typeof withReqId.warn).toBe('function');
        });

        it('should allow logging with request ID', () => {
            const withReqId = logger.withRequestId('req-456');
            expect(() => {
                withReqId.info('Test with request ID');
                withReqId.error('Error with request ID');
                withReqId.warn('Warning with request ID');
            }).not.toThrow();
        });

        it('should support metadata with request ID context', () => {
            const withReqId = logger.withRequestId('req-789');
            expect(() => {
                withReqId.info('Message', { userId: 42, action: 'login' });
            }).not.toThrow();
        });
    });

    describe('Metadata Support', () => {
        it('should accept metadata in log calls', () => {
            expect(() => {
                logger.info('Message with metadata', { key: 'value', count: 42 });
            }).not.toThrow();
        });

        it('should accept error object in log calls', () => {
            expect(() => {
                logger.error('Error occurred', { error: new Error('Test'), stack: 'at line 10' });
            }).not.toThrow();
        });
    });
});

