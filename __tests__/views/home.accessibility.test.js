/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const request = require('supertest');
const { JSDOM } = require('jsdom');
const { axe, toHaveNoViolations } = require('jest-axe');
const app = require('../../src/server');

expect.extend(toHaveNoViolations);

describe('Home page accessibility (WCAG AA)', () => {
  let dom, document, html;

  beforeAll(async () => {
    const res = await request(app).get('/');
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
    expect(skipLink).toBeTruthy();
    expect(skipLink.textContent.trim()).toContain('Skip to main content');
  });

  it('should have all images with alt attributes', () => {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      expect(img.hasAttribute('alt')).toBe(true);
    });
  });

  it('should have all form inputs with labels', () => {
    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
    inputs.forEach(input => {
      const id = input.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        
        expect(
          label || ariaLabel || ariaLabelledBy
        ).toBeTruthy();
      }
    });
  });

  it('should have proper heading hierarchy', () => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const levels = headings.map(h => parseInt(h.tagName.charAt(1)));
    
    // Should have at least one h1
    expect(levels.filter(l => l === 1).length).toBeGreaterThanOrEqual(1);
    
    // Check that heading levels don't skip (e.g., h1 -> h3)
    for (let i = 1; i < levels.length; i++) {
      const diff = levels[i] - levels[i - 1];
      expect(diff).toBeLessThanOrEqual(1);
    }
  });

  it('should have language attribute on html element', () => {
    const html = document.querySelector('html');
    expect(html.hasAttribute('lang')).toBe(true);
    expect(html.getAttribute('lang')).toBeTruthy();
  });

  it('should have meaningful page title', () => {
    const title = document.querySelector('title');
    expect(title).toBeTruthy();
    expect(title.textContent.length).toBeGreaterThan(0);
  });
});
