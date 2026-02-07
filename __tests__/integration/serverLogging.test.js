const request = require('supertest');
const app = require('../../src/server');

describe('Server Logging Integration', () => {
    it('should handle requests without logging errors', async () => {
        const response = await request(app).get('/').expect(200);
        expect(response).toBeDefined();
    });

    it('should set X-Request-ID header on responses', async () => {
        const response = await request(app).get('/');
        expect(response.headers['x-request-id']).toBeDefined();
        expect(response.headers['x-request-id'].length).toBeGreaterThan(0);
    });

    it('should preserve provided X-Request-ID in response headers', async () => {
        const customId = 'custom-request-123';
        const response = await request(app)
            .get('/')
            .set('X-Request-ID', customId);
        
        expect(response.headers['x-request-id']).toBe(customId);
    });

    it('should log 404 responses', async () => {
        const response = await request(app).get('/non-existent-route');
        expect(response.status).toBe(404);
    });

    it('should handle multiple requests with different request IDs', async () => {
        const ids = ['req-1', 'req-2', 'req-3'];
        
        for (const id of ids) {
            const response = await request(app)
                .get('/')
                .set('X-Request-ID', id);
            expect(response.headers['x-request-id']).toBe(id);
        }
    });

    it('should generate unique request IDs when not provided', async () => {
        const response1 = await request(app).get('/');
        const response2 = await request(app).get('/');
        
        const id1 = response1.headers['x-request-id'];
        const id2 = response2.headers['x-request-id'];
        
        expect(id1).toBeDefined();
        expect(id2).toBeDefined();
        expect(id1).not.toBe(id2);
    });

    it('should support X-Correlation-ID header as fallback', async () => {
        const correlationId = 'correlation-789';
        const response = await request(app)
            .get('/')
            .set('X-Correlation-ID', correlationId);
        
        expect(response.headers['x-request-id']).toBe(correlationId);
    });

    it('should prefer X-Request-ID over X-Correlation-ID', async () => {
        const reqId = 'req-id';
        const corrId = 'corr-id';
        const response = await request(app)
            .get('/')
            .set('X-Request-ID', reqId)
            .set('X-Correlation-ID', corrId);
        
        expect(response.headers['x-request-id']).toBe(reqId);
    });
});
