/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.setImmediate = global.setImmediate || process.nextTick;
const request = require('supertest');
const { JSDOM } = require('jsdom');
const { axe, toHaveNoViolations } = require('jest-axe');

jest.mock('../../src/controllers/pageController', () => ({
  getPublishedPage: jest.fn().mockResolvedValue(null)
}));

const app = require('../../src/server');

expect.extend(toHaveNoViolations);

describe('About page accessibility (WCAG AA)', () => {
  let dom, document, html;

  beforeAll(async () => {
    const res = await request(app).get('/about');
    html = res.text;
    dom = new JSDOM(html);
    global.window = dom.window;
    global.document = dom.window.document;
    document = dom.window.document;
  });

  it('should have no WCAG AA violations', async () => {
    const results = await axe(html, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
      }
    });

    expect(results).toHaveNoViolations();
  });

  it('should have proper document structure with main landmark', () => {
    const main = document.querySelector('main');
    expect(main).toBeTruthy();
  });

  it('should have skip-to-main-content link', () => {
    const skipLink = document.querySelector('a[href="#main-content"]');
    if (!skipLink) console.log("HTML that failed:", html);
    expect(skipLink).toBeTruthy();
  });

  it('should have all images with alt attributes', () => {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      expect(img.hasAttribute('alt')).toBe(true);
    });
  });

  it('should have language attribute on html element', () => {
    const html = document.querySelector('html');
    expect(html.hasAttribute('lang')).toBe(true);
  });
});
