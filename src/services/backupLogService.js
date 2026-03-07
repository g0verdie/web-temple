const fs = require('fs');
const path = require('path');

const DEFAULT_LOG_PATH = '/var/log/temple/backups.log';
const DEV_LOG_PATH = path.join(process.cwd(), 'logs/backups.log');

/**
 * Resolves the backup log file path based on environment or defaults.
 * @returns {string} The resolved log path.
 */
function getLogPath() {
    if (process.env.BACKUP_LOG_FILE) return process.env.BACKUP_LOG_FILE;
    if (fs.existsSync(DEFAULT_LOG_PATH)) return DEFAULT_LOG_PATH;
    return DEV_LOG_PATH;
}

/**
 * Reads lines from the end of a file efficiently.
 * @param {string} filePath - Path to the file.
 * @param {number} maxLines - Maximum number of lines to read.
 * @returns {Promise<string[]>} List of lines in reverse chronological order (newest first).
 */
async function readLastLines(filePath, maxLines = 50) {
    if (!fs.existsSync(filePath)) return [];

    const stats = await fs.promises.stat(filePath);
    const fd = await fs.promises.open(filePath, 'r');

    try {
        let buffer = Buffer.alloc(4096);
        let lines = [];
        let position = stats.size;
        let lineBuffer = '';

        while (position > 0 && lines.length < maxLines + 1) { // Read one extra to handle partial lines properly
            const chunkSize = Math.min(position, 4096);
            position -= chunkSize;

            await fd.read(buffer, 0, chunkSize, position);
            const chunk = buffer.slice(0, chunkSize).toString('utf8');

            // Reconstruct lines from the chunk
            const parts = (chunk + lineBuffer).split('\n');
            lineBuffer = parts.shift(); // Save the beginning of the top line for the next chunk

            // Add lines in reverse order
            for (let i = parts.length - 1; i >= 0; i--) {
                const line = parts[i].trim();
                if (line) lines.push(line);
                if (lines.length >= maxLines) break;
            }
        }

        // Add any remaining buffer
        if (lineBuffer.trim() && lines.length < maxLines) {
            lines.push(lineBuffer.trim());
        }

        return lines;
    } finally {
        await fd.close();
    }
}

/**
 * Parses JSON logs defensively.
 * @param {string} line - Log line.
 * @returns {Object|null} Parsed log object or null.
 */
function parseLogLine(line) {
    try {
        return JSON.parse(line);
    } catch (e) {
        return null;
    }
}

/**
 * Gets the most recent backup attempt (success or failure).
 * @returns {Promise<Object|null>} The most recent log entry.
 */
exports.getLastBackupAttempt = async () => {
    const logPath = getLogPath();
    const lines = await readLastLines(logPath, 20); // Check last 20 lines

    // Since readLastLines returns newest first, just take the first valid JSON
    for (const line of lines) {
        const log = parseLogLine(line);
        if (log && log.timestamp) return log;
    }
    return null;
};

/**
 * Gets the most recent SUCCESSFUL backup.
 * @returns {Promise<Object|null>} The most recent success log entry.
 */
exports.getLastSuccessfulBackup = async () => {
    const logPath = getLogPath();
    // Scan deeper for a success, might be buried if failures are frequent
    const lines = await readLastLines(logPath, 100);

    for (const line of lines) {
        const log = parseLogLine(line);
        if (log && log.status === 'SUCCESS') return log;
    }
    return null;
};

/**
 * Gets recent backup history.
 * @param {number} limit - Number of entries to return.
 * @returns {Promise<Object[]>} List of recent log entries.
 */
exports.getBackupHistory = async (limit = 10) => {
    const logPath = getLogPath();
    const lines = await readLastLines(logPath, limit * 2); // Read more to account for skipped lines

    const logs = [];
    for (const line of lines) {
        const log = parseLogLine(line);
        if (log) logs.push(log);
        if (logs.length >= limit) break;
    }
    return logs;
};
