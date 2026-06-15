/**
 * U4 — noindex for error pages (and the admin-path setter).
 *
 * The 404/error standalone views read the `noindex` local that server.js passes;
 * a public page does not get it. (Admin pages render through layout.ejs, whose
 * `noindex` reader is added by Stream B/U7 — the server.js middleware here is the
 * setter; per KTD3 the convention is fail-open, so this stream tests the setter
 * via the standalone error views it can fully render.)
 */

const request = require('supertest');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { end: jest.fn() } }));
jest.mock('../../src/config/redis', () => ({
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn()
}));

const app = require('../../src/server');

describe('noindex on error pages (U4)', () => {
  test('a 404 response renders the noindex robots meta', async () => {
    const res = await request(app).get('/this-route-does-not-exist-xyz');

    expect(res.status).toBe(404);
    expect(res.text).toContain('<meta name="robots" content="noindex">');
  });

  test('the error view does NOT render the noindex meta when the local is absent (conditional, not unconditional)', (done) => {
    // Render the standalone error view directly with no `noindex` local: proves
    // the robots meta is genuinely conditional and defaults to indexed.
    app.render('error', { title: 'X', message: 'Y' }, (err, html) => {
      expect(err).toBeNull();
      expect(html).not.toContain('content="noindex"');
      done();
    });
  });
});
