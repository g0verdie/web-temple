/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.setImmediate = global.setImmediate || process.nextTick;

const request = require('supertest');
const { JSDOM } = require('jsdom');
const { axe, toHaveNoViolations } = require('jest-axe');

jest.mock('../../src/config/redis', () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([])
}));
jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));

const app = require('../../src/server');

expect.extend(toHaveNoViolations);
const AXE = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } };

describe('Auth pages accessibility (WCAG AA)', () => {
    test('login page has no violations', async () => {
        const res = await request(app).get('/login');
        expect(res.status).toBe(200);
        expect(await axe(res.text, AXE)).toHaveNoViolations();
    }, 15000);

    test('register page has no violations', async () => {
        const res = await request(app).get('/register');
        expect(res.status).toBe(200);
        expect(await axe(res.text, AXE)).toHaveNoViolations();
    }, 15000);

    test('login form inputs are associated with labels', async () => {
        const res = await request(app).get('/login');
        const document = new JSDOM(res.text).window.document;

        expect(document.querySelector('main')).toBeTruthy();
        expect(document.querySelector('a[href="#main-content"]')).toBeTruthy();

        const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
        inputs.forEach(input => {
            if (input.id) {
                const label = document.querySelector(`label[for="${input.id}"]`);
                expect(label || input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')).toBeTruthy();
            }
        });
    }, 15000);

    test('register form inputs are associated with labels', async () => {
        const res = await request(app).get('/register');
        const document = new JSDOM(res.text).window.document;

        const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
        inputs.forEach(input => {
            if (input.id) {
                const label = document.querySelector(`label[for="${input.id}"]`);
                expect(label || input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')).toBeTruthy();
            }
        });

        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        expect(headings.filter(h => h.tagName === 'H1').length).toBeGreaterThanOrEqual(1);
    }, 15000);
});
