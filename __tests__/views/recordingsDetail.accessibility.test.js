/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.setImmediate = global.setImmediate || process.nextTick;

const request = require('supertest');
const { JSDOM } = require('jsdom');
const { axe, toHaveNoViolations } = require('jest-axe');
const jwt = require('jsonwebtoken');
const app = require('../../src/server');
const db = require('../../src/config/db');
const RecordingService = require('../../src/services/RecordingService');

jest.mock('../../src/config/db', () => ({
    query: jest.fn()
}));
jest.mock('../../src/services/RecordingService');

expect.extend(toHaveNoViolations);

describe('Recording detail page accessibility (WCAG AA, Story 3.5)', () => {
    const VALID_ID = '33333333-3333-4333-8333-333333333333';
    let authToken, dom, document, html;

    beforeAll(async () => {
        authToken = jwt.sign({
            user_id: 'member-123',
            role: 'member',
            email: 'member@example.com',
            token_version: 1
        }, process.env.JWT_SECRET || 'test-jwt-secret');

        db.query.mockResolvedValue({
            rows: [{ id: 'member-123', token_version: 1, role: 'member', email: 'member@example.com' }]
        });

        RecordingService.getPublishedRecordingById.mockResolvedValue({
            id: VALID_ID,
            title: 'Accessible Service Recording',
            description: 'Recording with WebVTT captions',
            provider_video_url: 'https://media.example.com/recording.mp4',
            preview_url: 'https://media.example.com/recording.jpg',
            service_date: '2026-02-14T18:00:00Z',
            torah_portion: 'Yitro',
            service_type: 'Shabbat',
            duration_seconds: 3600,
            publish_state: 'published',
            caption_url: 'https://media.example.com/recording.vtt',
            caption_format: 'webvtt',
            first_name: 'Avi',
            last_name: 'Cohen'
        });

        const res = await request(app)
            .get(`/archive/${VALID_ID}`)
            .set('Cookie', [`auth_token=${authToken}`]);
        html = res.text;
        dom = new JSDOM(html);
        global.window = dom.window;
        global.document = dom.window.document;
        document = dom.window.document;
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('has no WCAG AA violations', async () => {
        const results = await axe(html, {
            runOnly: {
                type: 'tag',
                values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
            }
        });
        expect(results).toHaveNoViolations();
    }, 15000);

    it('has a main landmark and skip link', () => {
        expect(document.querySelector('main')).toBeTruthy();
        expect(document.querySelector('a[href="#main-content"]')).toBeTruthy();
    });

    it('exposes an aria-labelled video player', () => {
        const video = document.getElementById('recording-player');
        expect(video).toBeTruthy();
        expect(video.hasAttribute('controls')).toBe(true);
        expect(video.getAttribute('aria-label')).toBeTruthy();
    });

    it('has accessible playback speed controls', () => {
        const fieldset = document.querySelector('.recording-speed');
        expect(fieldset).toBeTruthy();
        expect(fieldset.querySelector('legend')).toBeTruthy();
        const radios = fieldset.querySelectorAll('input[type="radio"][name="playbackRate"]');
        const values = Array.from(radios).map(r => r.value);
        expect(values).toEqual(expect.arrayContaining(['0.5', '1', '1.5', '2']));
    });

    it('has an accessible captions toggle when WebVTT is present', () => {
        const toggle = document.querySelector('[data-captions-toggle]');
        expect(toggle).toBeTruthy();
        expect(toggle.getAttribute('aria-pressed')).toBeTruthy();
    });

    it('has heading hierarchy without skipped levels', () => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const levels = headings.map(h => parseInt(h.tagName.charAt(1), 10));
        expect(levels.filter(l => l === 1).length).toBeGreaterThanOrEqual(1);
        for (let i = 1; i < levels.length; i++) {
            expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
        }
    });

    it('has language attribute on html element', () => {
        const htmlEl = document.querySelector('html');
        expect(htmlEl.hasAttribute('lang')).toBe(true);
    });
});
