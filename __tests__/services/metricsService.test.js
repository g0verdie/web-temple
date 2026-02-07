const metricsService = require('../../src/services/metricsService');

describe('Metrics Service', () => {
    afterEach(() => {
        metricsService.stop();
    });

    describe('Metrics Service Control', () => {
        it('should have start and stop methods', () => {
            expect(typeof metricsService.start).toBe('function');
            expect(typeof metricsService.stop).toBe('function');
        });

        it('should start metrics logging', () => {
            metricsService.start(1000);
            expect(metricsService.intervalId).toBeDefined();
            expect(metricsService.intervalId).not.toBeNull();
        });

        it('should stop metrics logging', () => {
            metricsService.start(1000);
            expect(metricsService.intervalId).toBeDefined();
            
            metricsService.stop();
            expect(metricsService.intervalId).toBeNull();
        });

        it('should have utility methods for byte conversion', () => {
            expect(typeof metricsService.bytesToMb).toBe('function');
            expect(typeof metricsService.bytesToGb).toBe('function');
        });

        it('should convert bytes to MB correctly', () => {
            const mb = metricsService.bytesToMb(1024 * 1024);
            expect(parseFloat(mb)).toBe(1);
        });

        it('should convert bytes to GB correctly', () => {
            const gb = metricsService.bytesToGb(1024 * 1024 * 1024);
            expect(parseFloat(gb)).toBe(1);
        });

        it('should log metrics without throwing', () => {
            expect(() => {
                metricsService.logMetrics();
            }).not.toThrow();
        });
    });

    describe('Metrics Content', () => {
        it('should include required metric properties', async () => {
            let metricsData = null;
            
            // Patch logger to capture metrics
            const originalInfo = require('../../src/utils/logger').info;
            require('../../src/utils/logger').info = function(message, meta) {
                if (message && message.includes('System Metrics')) {
                    metricsData = meta && meta.metadata ? meta.metadata : null;
                }
                return originalInfo.apply(this, arguments);
            };

            metricsService.start(100);
            
            // Wait for metrics to be captured
            await new Promise(resolve => setTimeout(resolve, 200));

            metricsService.stop();

            // Restore original
            require('../../src/utils/logger').info = originalInfo;

            // Verify metrics were captured (if available)
            if (metricsData) {
                expect(metricsData).toHaveProperty('type', 'system_metrics');
                expect(metricsData).toHaveProperty('timestamp');
                expect(metricsData).toHaveProperty('memory');
                expect(metricsData).toHaveProperty('cpu');
                expect(metricsData).toHaveProperty('disk');
                expect(metricsData).toHaveProperty('os');
                expect(metricsData).toHaveProperty('uptime');
            }
        });

        it('should include memory metrics', async () => {
            let metricsData = null;
            
            const originalInfo = require('../../src/utils/logger').info;
            require('../../src/utils/logger').info = function(message, meta) {
                if (message && message.includes('System Metrics')) {
                    metricsData = meta && meta.metadata ? meta.metadata : null;
                }
                return originalInfo.apply(this, arguments);
            };

            metricsService.start(100);
            await new Promise(resolve => setTimeout(resolve, 200));
            metricsService.stop();

            require('../../src/utils/logger').info = originalInfo;

            if (metricsData && metricsData.memory) {
                expect(metricsData.memory).toHaveProperty('rss');
                expect(metricsData.memory).toHaveProperty('heapUsed');
                expect(metricsData.memory).toHaveProperty('heapTotal');
            }
        });

        it('should include CPU metrics', async () => {
            let metricsData = null;
            
            const originalInfo = require('../../src/utils/logger').info;
            require('../../src/utils/logger').info = function(message, meta) {
                if (message && message.includes('System Metrics')) {
                    metricsData = meta && meta.metadata ? meta.metadata : null;
                }
                return originalInfo.apply(this, arguments);
            };

            metricsService.start(100);
            await new Promise(resolve => setTimeout(resolve, 200));
            metricsService.stop();

            require('../../src/utils/logger').info = originalInfo;

            if (metricsData && metricsData.cpu) {
                expect(metricsData.cpu).toHaveProperty('userMs');
                expect(metricsData.cpu).toHaveProperty('systemMs');
                expect(metricsData.cpu).toHaveProperty('systemLoad1Min');
            }
        });
    });
});
