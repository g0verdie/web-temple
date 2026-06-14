const request = require('supertest');
const express = require('express');
const path = require('path');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));

describe('responsive-test route gating (U6)', () => {
    test('dev/test env: GET /responsive-test is served (200)', async () => {
        const app = require('../../src/server'); // NODE_ENV=test → route registered
        const res = await request(app).get('/responsive-test');
        expect(res.status).toBe(200);
    });

    test('production env: /responsive-test route is not registered (404)', async () => {
        const prev = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        let router;
        jest.isolateModules(() => { router = require('../../src/routes/home'); });
        process.env.NODE_ENV = prev;

        const app = express();
        app.set('view engine', 'ejs');
        app.set('views', path.join(__dirname, '../../src/views'));
        app.use('/', router);
        app.use((req, res) => res.status(404).send('not found'));

        const res = await request(app).get('/responsive-test');
        expect(res.status).toBe(404);
    });
});
