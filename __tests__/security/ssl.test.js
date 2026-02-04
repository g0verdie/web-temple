const request = require('supertest');
const app = require('../../src/server');

describe('Security Configuration', () => {
    let originalEnv;

    beforeAll(() => {
        originalEnv = process.env.NODE_ENV;
    });

    afterAll(() => {
        process.env.NODE_ENV = originalEnv;
    });

    describe('HSTS Headers', () => {
        it('should set Strict-Transport-Security header', async () => {
            const res = await request(app).get('/');
            expect(res.headers['strict-transport-security']).toBeDefined();
            expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
            expect(res.headers['strict-transport-security']).toContain('includeSubDomains');
            expect(res.headers['strict-transport-security']).toContain('preload');
        });
    });

    describe('HTTPS Redirection', () => {
        beforeEach(() => {
            jest.resetModules();
            process.env.NODE_ENV = 'production';
        });

        // Note: We need to reload app to pick up NODE_ENV changes if using it at startup
        // But modifying app reference dynamically is hard.
        // Instead, we will simulate the middleware logic if possible, or assume the middleware checks env at request time.

        it('should redirect HTTP to HTTPS in production when using X-Forwarded-Proto', async () => {
            // Redefine NODE_ENV for this test context if middleware checks it dynamically
            process.env.NODE_ENV = 'production';

            const res = await request(app)
                .get('/')
                .set('X-Forwarded-Proto', 'http')
                .set('Host', 'example.com');

            // We expect a 301 or 302 redirect
            expect(res.status).toBeGreaterThanOrEqual(301);
            expect(res.status).toBeLessThan(400);
            expect(res.header.location).toContain('https://example.com/');
        });

        it('should NOT redirect HTTPS requests', async () => {
            process.env.NODE_ENV = 'production';

            const res = await request(app)
                .get('/')
                .set('X-Forwarded-Proto', 'https')
                .set('Host', 'example.com');

            expect(res.status).toBe(200);
        });
    });
});
