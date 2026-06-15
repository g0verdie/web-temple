/**
 * U4 — sitemap.xml fix.
 *
 * /archive is member-gated (302s crawlers to /login) so it must not be in the
 * sitemap; /donations is the top conversion page and must be present. Output
 * stays valid XML.
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

describe('GET /sitemap.xml (U4)', () => {
  test('includes /donations and excludes the member-gated /archive', async () => {
    const res = await request(app).get('/sitemap.xml');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.text).toMatch(/<loc>[^<]*\/donations<\/loc>/);
    expect(res.text).not.toMatch(/<loc>[^<]*\/archive<\/loc>/);
  });

  test('remains valid, well-formed XML with a urlset root', async () => {
    const res = await request(app).get('/sitemap.xml');

    expect(res.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(res.text).toContain('<urlset');
    expect(res.text).toContain('</urlset>');
    // Balanced <url> elements.
    const open = (res.text.match(/<url>/g) || []).length;
    const close = (res.text.match(/<\/url>/g) || []).length;
    expect(open).toBe(close);
    expect(open).toBeGreaterThan(0);
  });
});
