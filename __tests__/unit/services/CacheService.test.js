const CacheService = require('../../../src/services/CacheService');
const redis = require('../../../src/config/redis');

jest.mock('../../../src/config/redis', () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    on: jest.fn()
}));

describe('CacheService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('get', () => {
        it('should return parsed value when key exists', async () => {
            const mockData = { test: 'data' };
            redis.get.mockResolvedValue(JSON.stringify(mockData));

            const result = await CacheService.get('testKey');
            expect(redis.get).toHaveBeenCalledWith('cache:testKey');
            expect(result).toEqual(mockData);
        });

        it('should return null when key does not exist', async () => {
            redis.get.mockResolvedValue(null);

            const result = await CacheService.get('testKey');
            expect(result).toBeNull();
        });

        it('should return null and log error when redis fails', async () => {
            redis.get.mockRejectedValue(new Error('Redis error'));

            const result = await CacheService.get('testKey');
            expect(result).toBeNull();
        });
    });

    describe('set', () => {
        it('should set value with default TTL', async () => {
            redis.set.mockResolvedValue('OK');

            const result = await CacheService.set('testKey', { data: 'value' });

            expect(redis.set).toHaveBeenCalledWith(
                'cache:testKey',
                JSON.stringify({ data: 'value' }),
                'EX',
                300
            );
            expect(result).toBe(true);
        });

        it('should set value with custom TTL', async () => {
            redis.set.mockResolvedValue('OK');

            const result = await CacheService.set('testKey', { data: 'value' }, 60);

            expect(redis.set).toHaveBeenCalledWith(
                'cache:testKey',
                JSON.stringify({ data: 'value' }),
                'EX',
                60
            );
            expect(result).toBe(true);
        });

        it('should return false on error', async () => {
            redis.set.mockRejectedValue(new Error('Redis error'));

            const result = await CacheService.set('testKey', { data: 'value' });
            expect(result).toBe(false);
        });
    });

    describe('del', () => {
        it('should delete key', async () => {
            redis.del.mockResolvedValue(1);

            const result = await CacheService.del('testKey');
            expect(redis.del).toHaveBeenCalledWith('cache:testKey');
            expect(result).toBe(true);
        });
    });

    describe('flush', () => {
        it('should flush all keys with prefix', async () => {
            redis.keys.mockResolvedValue(['cache:key1', 'cache:key2']);
            redis.del.mockResolvedValue(2);

            const result = await CacheService.flush();

            expect(redis.keys).toHaveBeenCalledWith('cache:*');
            expect(redis.del).toHaveBeenCalledWith(['cache:key1', 'cache:key2']);
            expect(result).toBe(true);
        });

        it('should do nothing if no keys found', async () => {
            redis.keys.mockResolvedValue([]);

            const result = await CacheService.flush();

            expect(redis.keys).toHaveBeenCalledWith('cache:*');
            expect(redis.del).not.toHaveBeenCalled();
            expect(result).toBe(true);
        });
    });
});
