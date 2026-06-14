/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.setImmediate = global.setImmediate || process.nextTick;

const request = require('supertest');
const { JSDOM } = require('jsdom');
const { axe, toHaveNoViolations } = require('jest-axe');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/EventService');

const db = require('../../src/config/db');
const EventService = require('../../src/services/EventService');
const app = require('../../src/server');

expect.extend(toHaveNoViolations);

const axeRun = (html) => axe(html, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
});

describe('Public calendar accessibility (WCAG AA)', () => {
    let html, document;

    beforeAll(async () => {
        db.query.mockResolvedValue({ rows: [] });
        EventService.getEventsInRange.mockResolvedValue([
            { id: 1, title: 'Public Picnic', date: new Date(Date.now() + 86400000), visibility: 'public', description: 'Fun', location: 'Park' }
        ]);
        const res = await request(app).get('/calendar');
        html = res.text;
        document = new JSDOM(html).window.document;
    });

    it('has no WCAG AA violations', async () => {
        expect(await axeRun(html)).toHaveNoViolations();
    });

    it('has a main landmark and a calendar heading', () => {
        expect(document.querySelector('main')).toBeTruthy();
        expect(document.querySelector('#calendar-heading')).toBeTruthy();
    });

    it('has month navigation links', () => {
        expect(document.querySelector('.calendar-month-nav a[rel="prev"]')).toBeTruthy();
        expect(document.querySelector('.calendar-month-nav a[rel="next"]')).toBeTruthy();
    });
});
