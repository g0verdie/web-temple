const winston = require('winston');
require('winston-daily-rotate-file');
const fs = require('fs');
const path = require('path');

// Ensure log directories exist
const logDir = 'logs';
const archiveDir = path.join(logDir, 'archive');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}
if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir);
}

// Define severity levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define level based on environment
const level = () => {
    const env = process.env.NODE_ENV || 'development';
    return env === 'development' ? 'debug' : 'info'; // Set to info for test to write logs
};

// Define colors for console logs
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

// Tell winston about colors
winston.addColors(colors);

// Custom format for console logging
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
);

// Custom format for file logging (JSON)
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format((info) => {
        // Add requestId to every log
        info.requestId = info.requestId || 'N/A';
        return info;
    })(),
    winston.format.json()
);

const transports = [
    // Error log file (30-day online retention)
    new winston.transports.DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
        format: fileFormat,
    }),
    // Application log file (30-day online retention)
    new winston.transports.DailyRotateFile({
        filename: 'logs/application-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        format: fileFormat,
    }),
];

// Add console transport if not in test environment
if (process.env.NODE_ENV !== 'test') {
    transports.push(
        new winston.transports.Console({
            format: consoleFormat,
        })
    );
}

const logger = winston.createLogger({
    level: level(), // Set default level
    levels,
    transports,
});

/**
 * Create a stream object that Morgan can write to with request ID context.
 * Morgan writes to 'stream.write' method.
 * Request ID is injected via middleware and accessed from the logger context.
 */
logger.stream = {
    write: (message) => {
        // Morgan adds a newline character, so we remove it
        logger.http(message.trim());
    },
};

/**
 * Log with request ID context
 * @param {string} requestId - The request ID
 * @returns {object} Logger methods with request ID context
 */
logger.withRequestId = (requestId) => ({
    error: (message, meta = {}) => logger.error(message, { ...meta, requestId }),
    warn: (message, meta = {}) => logger.warn(message, { ...meta, requestId }),
    info: (message, meta = {}) => logger.info(message, { ...meta, requestId }),
    http: (message, meta = {}) => logger.http(message, { ...meta, requestId }),
    debug: (message, meta = {}) => logger.debug(message, { ...meta, requestId }),
});

module.exports = logger;
