const request = require('supertest');
const express = require('express');
const requestIdMiddleware = require('../../src/middleware/requestIdMiddleware');

describe('Request ID Middleware', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(requestIdMiddleware);
        app.get('/', (req, res) => {
            res.json({
                requestId: req.id,
                fromLocals: res.locals.requestId
            });
        });
    });

    it('should generate request ID if not provided', async () => {
        const response = await request(app).get('/').expect(200);

        expect(response.body.requestId).toBeDefined();
        expect(response.body.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(response.headers['x-request-id']).toBe(response.body.requestId);
    });

    it('should use provided X-Request-ID header', async () => {
        const customId = 'custom-request-id-123';
        const response = await request(app)
            .get('/')
            .set('X-Request-ID', customId)
            .expect(200);

        expect(response.body.requestId).toBe(customId);
        expect(response.headers['x-request-id']).toBe(customId);
    });

    it('should use X-Correlation-ID as fallback', async () => {
        const correlationId = 'correlation-456';
        const response = await request(app)
            .get('/')
            .set('X-Correlation-ID', correlationId)
            .expect(200);

        expect(response.body.requestId).toBe(correlationId);
        expect(response.headers['x-request-id']).toBe(correlationId);
    });

    it('should prefer X-Request-ID over X-Correlation-ID', async () => {
        const requestId = 'req-id';
        const correlationId = 'corr-id';
        const response = await request(app)
            .get('/')
            .set('X-Request-ID', requestId)
            .set('X-Correlation-ID', correlationId)
            .expect(200);

        expect(response.body.requestId).toBe(requestId);
    });

    it('should store request ID in res.locals', async () => {
        const customId = 'test-123';
        const response = await request(app)
            .get('/')
            .set('X-Request-ID', customId)
            .expect(200);

        expect(response.body.fromLocals).toBe(customId);
    });

    it('should add X-Request-ID to response headers', async () => {
        const response = await request(app).get('/').expect(200);

        expect(response.headers['x-request-id']).toBeDefined();
        expect(response.headers['x-request-id']).toBe(response.body.requestId);
    });

    it('should maintain same request ID throughout request lifecycle', async () => {
        const customId = 'lifecycle-test-789';
        const response = await request(app)
            .get('/')
            .set('X-Request-ID', customId)
            .expect(200);

        expect(response.body.requestId).toBe(customId);
        expect(response.body.fromLocals).toBe(customId);
        expect(response.headers['x-request-id']).toBe(customId);
    });
});
