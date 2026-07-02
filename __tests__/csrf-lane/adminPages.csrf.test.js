/**
 * CSRF-on lane — admin page writes (meta[name="csrf-token"] → CSRF-Token header transport).
 *
 * Covers R3, R4, R8 and Acceptance Example AE3. The page-editor Save and Publish
 * writes are two of the three historical CSRF regressions this lane exists to
 * catch. Auth keeps its NODE_ENV==='test' admin fallback (no token needed for
 * authorization), so the only gate exercised here is REAL csurf: the positive
 * path must mint the meta-tag token and resend it as a `CSRF-Token` header the
 * way public/js/page-editor.js does; the negative path (no header) must 403.
 */

const request = require('supertest');

jest.mock('../../src/controllers/pageController', () => ({
  getPageForAdmin: jest.fn(),
  getAllPagesForAdmin: jest.fn(),
  getVersionHistory: jest.fn(),
  updatePage: jest.fn(),
  publishPage: jest.fn(),
  restoreVersion: jest.fn()
}));
jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/auditService', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {}
}));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));

const { buildCsrfLaneApp, readCsrfMeta } = require('./csrfLaneApp');
const pageController = require('../../src/controllers/pageController');

const app = buildCsrfLaneApp();
const SLUG = 'about';

// Mint a CSRF token from the admin edit page — the same meta[name="csrf-token"]
// element public/js/page-editor.js reads — reusing the agent's csurf secret cookie.
async function mintTokenFromEditPage(agent) {
  const page = await agent.get(`/admin/pages/${SLUG}`);
  expect(page.status).toBe(200);
  const token = readCsrfMeta(page.text);
  expect(token).toBeTruthy();
  return token;
}

describe('CSRF lane: admin page writes (meta-tag → header transport)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pageController.getPageForAdmin.mockResolvedValue({
      id: 'page-1', slug: SLUG, title: 'About', content: '<p>About</p>',
      published: true, updated_at: new Date('2026-06-01')
    });
    pageController.getVersionHistory.mockResolvedValue([]);
    pageController.updatePage.mockResolvedValue({ id: 'page-1', title: 'About Updated' });
    pageController.publishPage.mockResolvedValue({ id: 'page-1', title: 'About', published: true });
  });

  // R3 / R8 positive — Save accepts the header token.
  test('mint-then-submit: Save with CSRF-Token header → not 403', async () => {
    const agent = request.agent(app);
    const token = await mintTokenFromEditPage(agent);

    const res = await agent
      .post(`/admin/pages/${SLUG}`)
      .set('CSRF-Token', token)
      .set('Accept', 'application/json')
      .send({ title: 'About Updated', content: '<p>New content</p>' });

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true }));
    expect(pageController.updatePage).toHaveBeenCalled();
  });

  // R8 positive — Publish accepts the header token.
  test('mint-then-submit: Publish with CSRF-Token header → not 403', async () => {
    const agent = request.agent(app);
    const token = await mintTokenFromEditPage(agent);

    const res = await agent
      .post(`/admin/pages/${SLUG}/publish`)
      .set('CSRF-Token', token)
      .set('Accept', 'application/json')
      .send({ published: true });

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
    expect(pageController.publishPage).toHaveBeenCalled();
  });

  // AE3 — authorized admin, no CSRF-Token header → 403 (proves real enforcement).
  test('Save with no CSRF-Token header → 403', async () => {
    const res = await request(app)
      .post(`/admin/pages/${SLUG}`)
      .set('Accept', 'application/json')
      .send({ title: 'About Updated', content: '<p>New content</p>' });

    expect(res.status).toBe(403);
    expect(pageController.updatePage).not.toHaveBeenCalled();
  });

  // AE3 (tightened) — a VALID csurf session (secret cookie established by the GET)
  // but the Save POST omits the CSRF-Token header → still 403. Proves enforcement
  // validates the token itself, not merely the presence of a secret session.
  test('valid session but Save omits the CSRF-Token header → 403', async () => {
    const agent = request.agent(app);
    await mintTokenFromEditPage(agent); // establishes the csurf secret cookie

    const res = await agent
      .post(`/admin/pages/${SLUG}`)
      .set('Accept', 'application/json')
      .send({ title: 'About Updated', content: '<p>New content</p>' });

    expect(res.status).toBe(403);
    expect(pageController.updatePage).not.toHaveBeenCalled();
  });
});
