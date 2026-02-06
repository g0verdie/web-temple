/**
 * scripts/alert_backup.js
 * Sends email alert on backup failure
 * Usage: node scripts/alert_backup.js <log_file_path> <error_message>
 */

require('dotenv').config();
const { sendEmail } = require('../src/services/emailService');
const fs = require('fs');

const sendAlert = async (logFilePath, errorMsg) => {
    try {
        const logFile = logFilePath || process.argv[2];
        const errorMessage = errorMsg || process.argv[3] || 'Unknown error';

        const adminEmail = process.env.ADMIN_EMAIL || 'admin@temple.org';
        const timestamp = new Date().toISOString();

        console.log(`Sending backup failure alert to ${adminEmail}...`);

        const subject = `[URGENT] Temple Backup Failed - ${timestamp}`;
        let logTail = 'No log file available.';

        if (logFile && fs.existsSync(logFile)) {
            // Read last 20 lines of log
            const content = fs.readFileSync(logFile, 'utf8');
            const lines = content.split('\n');
            logTail = lines.slice(-20).join('\n');
        }

        const html = `
            <h2>Backup Failure Alert</h2>
            <p><strong>Time:</strong> ${timestamp}</p>
            <p><strong>Error:</strong> ${errorMessage}</p>
            <h3>Log Output (Last 20 lines):</h3>
            <pre style="background: #f4f4f4; padding: 10px;">${logTail}</pre>
            <p>Please check the server immediately.</p>
        `;

        await sendEmail({
            to: adminEmail,
            subject: subject,
            html: html,
            text: `Backup Failure: ${errorMessage}\n\nTimestamp: ${timestamp}\n\nCheck logs for details.`
        });

        console.log('Alert sent successfully.');
    } catch (error) {
        console.error('Failed to send alert:', error);
        if (require.main === module) process.exit(1);
        throw error;
    }
};

if (require.main === module) {
    sendAlert();
}

module.exports = { sendAlert };
