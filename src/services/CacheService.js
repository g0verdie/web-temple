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
