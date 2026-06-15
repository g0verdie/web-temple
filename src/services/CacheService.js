const redis = require('../config/redis');
const winston = require('winston');

class CacheService {
    constructor() {
        this.defaultTTL = 300; // 5 minutes default
        this.prefix = 'cache:';
        this.metrics = {
            hits: 0,
            misses: 0
        };
    }

    async get(key) {
        try {
            const value = await redis.get(this.prefix + key);
            if (value) {
                this.metrics.hits++;
                winston.debug(`Cache HIT for key ${key}`, { hitRate: this.getHitRate() });
                return JSON.parse(value);
            } else {
                this.metrics.misses++;
                winston.debug(`Cache MISS for key ${key}`, { hitRate: this.getHitRate() });
                return null;
            }
        } catch (error) {
            winston.error(`Cache get error for key ${key}:`, error);
            this.metrics.misses++;
            return null;
        }
    }

    async set(key, value, ttl = this.defaultTTL) {
        try {
            await redis.set(this.prefix + key, JSON.stringify(value), 'EX', ttl);
            return true;
        } catch (error) {
            winston.error(`Cache set error for key ${key}:`, error);
            return false;
        }
    }

    async del(key) {
        try {
            await redis.del(this.prefix + key);
            return true;
        } catch (error) {
            winston.error(`Cache del error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Atomically set a key only if absent (SET key value NX EX ttl). Returns true
     * when this caller set the key ("won"), false when it already existed. Used as a
     * single-flight refresh lock and a fire-once alert guard.
     *
     * On a backend error the result depends on the desired failure mode:
     *  - default (fail OPEN, returns true): correct for the refresh lock — a Redis
     *    outage should let the caller proceed and fetch rather than stall.
     *  - { failClosed: true } (returns false): correct for the alert dedupe — a Redis
     *    outage must NOT be read as "first alert" or every request would email the
     *    operator during an incident.
     */
    async acquireLock(key, ttlSeconds, options = {}) {
        try {
            const result = await redis.set(this.prefix + key, '1', 'EX', ttlSeconds, 'NX');
            return result === 'OK';
        } catch (error) {
            winston.error(`Cache acquireLock error for key ${key}:`, error);
            return options.failClosed ? false : true;
        }
    }

    async flush() {
        try {
            const keys = await redis.keys(this.prefix + '*');
            if (keys && keys.length > 0) {
                await redis.del(keys);
            }
            return true;
        } catch (error) {
            winston.error('Cache flush error:', error);
            return false;
        }
    }

    async invalidatePattern(pattern) {
        try {
            const keys = await redis.keys(this.prefix + pattern);
            if (keys.length > 0) {
                await redis.del(keys);
                winston.info(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
            }
            return true;
        } catch (error) {
            winston.error(`Cache invalidate pattern error for ${pattern}:`, error);
            return false;
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            hitRate: this.getHitRate(),
            total: this.metrics.hits + this.metrics.misses
        };
    }

    getHitRate() {
        const total = this.metrics.hits + this.metrics.misses;
        return total === 0 ? 0 : ((this.metrics.hits / total) * 100).toFixed(2);
    }

    resetMetrics() {
        this.metrics.hits = 0;
        this.metrics.misses = 0;
    }
}

module.exports = new CacheService();
