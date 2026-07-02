/**
 * CSRF-on lane — contact submit (meta[name="csrf-token"] → CSRF-Token header transport).
 *
 * Covers R3, R4, R5, R6 and Acceptance Example AE2. GETs a page that renders the
 * layout, reads the token from the exact meta tag the production client JS reads
 * (public/js/contact-form.js:40), then POSTs /contact resending it as a
 * `CSRF-Token` header the same way the client does — with REAL csurf enforcing.
 */

const request = require('supertest');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/emailService', () => ({ sendContactNotification: jest.fn().mockResolvedValue(true) }));
jest.mock('../../src/services/auditService', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { MESSAGE_RECEIVED: 'MESSAGE_RECEIVED' }
}));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));

const { buildCsrfLaneApp, readCsrfMeta } = require('./csrfLaneApp');
const db = require('../../src/config/db');

const app = buildCsrfLaneApp();

const validMessage = {
  name: 'Test Person',
  email: 'person@example.com',
  subject: 'Membership question',
  message: 'This is a long enough message to pass validation.',
  captchaToken: 'test-captcha'
};

describe('CSRF lane: contact submit (meta-tag → header transport)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [{ id: 'msg-1', created_at: new Date() }] });
  });

  // AE2
  test('mint-then-submit: token from meta tag resent as CSRF-Token header → not 403', async () => {
    const agent = request.agent(app);

    const page = await agent.get('/contact');
    expect(page.status).toBe(200);
    const token = readCsrfMeta(page.text);
    expect(token).toBeTruthy();

    const res = await agent
      .post('/contact')
      .set('CSRF-Token', token)
      .set('Accept', 'application/json')
      .send(validMessage);

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(201);
    expect(db.query).toHaveBeenCalled();
  });

  // R4 negative — a valid submission with no CSRF-Token header is rejected.
  test('same submission with no CSRF-Token header → 403', async () => {
    const res = await request(app)
      .post('/contact')
      .set('Accept', 'application/json')
      .send(validMessage);

    expect(res.status).toBe(403);
    expect(db.query).not.toHaveBeenCalled();
  });
});
