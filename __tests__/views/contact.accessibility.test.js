/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const request = require('supertest');
const { JSDOM } = require('jsdom');
const { axe, toHaveNoViolations } = require('jest-axe');
const app = require('../../src/server');

expect.extend(toHaveNoViolations);

describe('Contact page accessibility', () => {
  it('should have no axe violations on render', async () => {
    const res = await request(app).get('/contact');
    const dom = new JSDOM(res.text);
    global.window = dom.window;
    global.document = dom.window.document;

    const results = await axe(document.body, {
      rules: {
        'color-contrast': { enabled: false }
      }
    });

    expect(results).toHaveNoViolations();
  });
});
