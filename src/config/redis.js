const Redis = require('ioredis');
const winston = require('winston');

let redis;

if (process.env.NODE_ENV === 'test') {
    const EventEmitter = require('events');
    const cache = {};
    redis = new EventEmitter();

    redis.get = jest.fn((key) => {
        if (key.startsWith('session:')) return Promise.resolve(String(Date.now()));
        return Promise.resolve(cache[key] || null);
    });

    redis.set = jest.fn((key, value) => {
        cache[key] = value;
        return Promise.resolve('OK');
    });

    redis.setex = jest.fn((key, ttl, value) => {
        cache[key] = value;
        return Promise.resolve('OK');
    });
    redis.del = jest.fn((keys) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach(k => delete cache[k]);
        return Promise.resolve(keysArray.length);
    });
    redis.keys = jest.fn((pattern) => {
        const regex = new RegExp('^' + pattern.replace('*', '.*'));
        return Promise.resolve(Object.keys(cache).filter(k => regex.test(k)));
    });
    redis.flushall = jest.fn(() => {
        Object.keys(cache).forEach(k => delete cache[k]);
        return Promise.resolve('OK');
    });
    redis.quit = jest.fn(() => Promise.resolve());
    redis.status = 'test';
} else {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(redisUrl, {
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        maxRetriesPerRequest: 3,
    });

    redis.on('connect', () => {
        winston.info('Redis connected successfully');
    });

    redis.on('error', (err) => {
        winston.error('Redis connection error:', err);
    });
}

module.exports = redis;
