/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.setImmediate = global.setImmediate || process.nextTick;

const request = require('supertest');
const { JSDOM } = require('jsdom');
const { axe, toHaveNoViolations } = require('jest-axe');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/EventService');

const db = require('../../src/config/db');
const EventService = require('../../src/services/EventService');
const app = require('../../src/server');

expect.extend(toHaveNoViolations);

const adminToken = jwt.sign(
    { user_id: 'admin-1', role: 'admin', email: 'admin@x.com', token_version: 1 },
    process.env.JWT_SECRET || 'test-jwt-secret'
);

const axeRun = (html) => axe(html, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
});

const getAdmin = (path) => request(app).get(path).set('Cookie', [`auth_token=${adminToken}`]);

beforeEach(() => {
    db.query.mockResolvedValue({ rows: [{ id: 'admin-1', token_version: 1, role: 'admin', email: 'admin@x.com' }] });
});

afterEach(() => jest.clearAllMocks());

describe('Admin calendar accessibility (WCAG AA)', () => {
    it('list page has no violations and labelled controls', async () => {
        EventService.getEvents.mockResolvedValue([
            { id: 1, title: 'Shabbat', date: new Date(Date.now() + 86400000), visibility: 'public', type: 'service', location: 'Sanctuary' }
        ]);
        const res = await getAdmin('/admin/calendar');
        expect(res.status).toBe(200);
        expect(await axeRun(res.text)).toHaveNoViolations();
    });

    it('new-event form page has no violations and every input has a label', async () => {
        const res = await getAdmin('/admin/calendar/new');
        expect(res.status).toBe(200);
        expect(await axeRun(res.text)).toHaveNoViolations();

        const document = new JSDOM(res.text).window.document;
        const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
        inputs.forEach((input) => {
            if (!input.id) return;
            const label = document.querySelector(`label[for="${input.id}"]`);
            const ariaLabel = input.getAttribute('aria-label');
            expect(label || ariaLabel).toBeTruthy();
        });
    });

    it('edit-event form page has no violations and prefills', async () => {
        EventService.getEventById.mockResolvedValue({
            id: 3, title: 'Existing Event', date: new Date(Date.now() + 86400000), visibility: 'members', type: 'event', location: 'Hall'
        });
        const res = await getAdmin('/admin/calendar/3/edit');
        expect(res.status).toBe(200);
        expect(res.text).toContain('Existing Event');
        expect(await axeRun(res.text)).toHaveNoViolations();
    });

    it('archive page has no violations', async () => {
        EventService.getArchivedEvents.mockResolvedValue([
            { id: 5, title: 'Old Event', date: new Date('2020-01-01T00:00:00Z'), deletedAt: new Date() }
        ]);
        const res = await getAdmin('/admin/calendar/archive');
        expect(res.status).toBe(200);
        expect(await axeRun(res.text)).toHaveNoViolations();
    });
});
