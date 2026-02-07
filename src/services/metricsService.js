const os = require('os');
const fs = require('fs');
const logger = require('../utils/logger');

class MetricsService {
    constructor() {
        this.intervalId = null;
    }

    start(intervalMs = 300000) { // Default 5 minutes
        logger.info('Starting system metrics logging task');

        // Log immediately on start
        this.logMetrics();

        this.intervalId = setInterval(() => {
            this.logMetrics();
        }, intervalMs);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('Stopped system metrics logging task');
        }
    }

    logMetrics() {
        try {
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            const loadAverage = os.loadavg(); // Returns [1, 5, 15] min load averages
            const freeMem = os.freemem();
            const totalMem = os.totalmem();

            // Get disk usage for root directory using statvfs (Node.js 15.7.0+)
            let diskMetrics = { unavailable: true };
            try {
                // Try using fs.statfsSync if available
                if (fs.statfsSync) {
                    const diskStats = fs.statfsSync('/');
                    diskMetrics = {
                        available: this.bytesToGb(diskStats.bavail * diskStats.bsize),
                        total: this.bytesToGb(diskStats.blocks * diskStats.bsize),
                        used: this.bytesToGb((diskStats.blocks - diskStats.bfree) * diskStats.bsize),
                        usagePercent: (((diskStats.blocks - diskStats.bfree) / diskStats.blocks) * 100).toFixed(2),
                    };
                }
            } catch (diskErr) {
                logger.warn('Could not retrieve disk metrics', { error: diskErr.message });
            }

            const metrics = {
                type: 'system_metrics',
                timestamp: new Date().toISOString(),
                memory: {
                    rss: this.bytesToMb(memoryUsage.rss),
                    heapTotal: this.bytesToMb(memoryUsage.heapTotal),
                    heapUsed: this.bytesToMb(memoryUsage.heapUsed),
                    external: this.bytesToMb(memoryUsage.external),
                },
                cpu: {
                    userMs: cpuUsage.user,
                    systemMs: cpuUsage.system,
                    systemLoad1Min: loadAverage[0],
                    systemLoad5Min: loadAverage[1],
                    systemLoad15Min: loadAverage[2],
                },
                disk: diskMetrics,
                os: {
                    freeMemMb: this.bytesToMb(freeMem),
                    totalMemMb: this.bytesToMb(totalMem),
                    memUsagePercent: ((1 - freeMem / totalMem) * 100).toFixed(2),
                },
                uptime: os.uptime(),
            };

            logger.info('System Metrics', { metadata: metrics });
        } catch (error) {
            logger.error('Error logging system metrics', { error: error.message, stack: error.stack });
        }
    }

    bytesToMb(bytes) {
        return (bytes / 1024 / 1024).toFixed(2);
    }

    bytesToGb(bytes) {
        return (bytes / 1024 / 1024 / 1024).toFixed(2);
    }
}

module.exports = new MetricsService();
