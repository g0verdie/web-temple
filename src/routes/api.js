const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const requireAdmin = require('../middleware/requireAdmin');
const backupLogService = require('../services/backupLogService');

// GET /api/admin/backups/status
router.get('/admin/backups/status', requireAdmin, async (req, res) => {
    try {
        // Use the absolute path defined in script or fallback relative to project root
        // In production, LOG_FILE is /var/log/temple/backups.log
        // In dev, it might be project_root/logs/backups.log

        const latestAttempt = await backupLogService.getLastBackupAttempt();
        const lastSuccess = await backupLogService.getLastSuccessfulBackup();

        if (latestAttempt) {
            let status = 'unknown';
            if (latestAttempt.status === 'SUCCESS') status = 'success';
            else if (latestAttempt.status === 'ERROR') status = 'error';
            else status = latestAttempt.status.toLowerCase();

            // If latest failed, we still might want to know when the last success was
            const response = {
                lastBackup: latestAttempt, // keeping key compatible, but maybe should clarify
                lastSuccess: lastSuccess,
                status: status
            };

            // Adjust response to match previous contract or improve it
            // Previous contract: { lastBackup: { ... }, status: 'success' }
            // If error, it just returned 'no-success-backups'.
            // Let's improve: return last ATTEMPT details, and if it was error, status is error.

            if (latestAttempt.status === 'SUCCESS') {
                res.json({
                    lastBackup: {
                        timestamp: latestAttempt.timestamp,
                        size_bytes: latestAttempt.size_bytes,
                        message: latestAttempt.message
                    },
                    status: 'success'
                });
            } else {
                res.json({
                    lastBackup: { // Return failure details
                        timestamp: latestAttempt.timestamp,
                        message: latestAttempt.message
                    },
                    lastSuccess: lastSuccess ? { timestamp: lastSuccess.timestamp } : null,
                    status: 'error',
                    message: 'Latest backup failed'
                });
            }
        } else {
            res.json({ lastBackup: null, status: 'no-backups' });
        }


    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
