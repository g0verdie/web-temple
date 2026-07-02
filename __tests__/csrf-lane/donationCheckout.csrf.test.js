/**
 * CSRF-on lane — donation checkout (hidden input[name="_csrf"] body-field transport).
 *
 * Covers R3, R4, R5, R7 and Acceptance Examples AE1 + AE4. Drives the real
 * mint-then-submit flow: GET /donations, read the token from the exact hidden
 * field the production client reads, then POST /donations/checkout carrying it
 * in the body the way the browser form does — with REAL csurf enforcing.
 */

const request = require('supertest');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/DonationService');
jest.mock('../../src/services/payments');
jest.mock('../../src/services/receiptPdfService');
jest.mock('../../src/services/emailQueueService');
jest.mock('../../src/services/auditService', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {}
}));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));

const { buildCsrfLaneApp, readCsrfInput } = require('./csrfLaneApp');
const DonationService = require('../../src/services/DonationService');
const payments = require('../../src/services/payments');

const app = buildCsrfLaneApp();

const validCheckoutBody = {
  amount_cents: '3600',
  donation_type: 'one-time',
  donor_email: 'donor@example.com'
};

describe('CSRF lane: donation checkout (body-field transport)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    payments.getProvider.mockReturnValue({
      createCheckout: jest.fn().mockResolvedValue({ checkoutId: 'don-1', providerRef: 'MOCK-1' }),
      capture: jest.fn()
    });
    DonationService.createPending.mockResolvedValue({ id: 'don-1', created_at: new Date() });
  });

  // AE1
  test('mint-then-submit: token from input[name="_csrf"] → checkout starts (not 403)', async () => {
    const agent = request.agent(app);

    const page = await agent.get('/donations');
    expect(page.status).toBe(200);
    const token = readCsrfInput(page.text);
    expect(token).toBeTruthy();

    const res = await agent
      .post('/donations/checkout')
      .type('form')
      .send({ _csrf: token, ...validCheckoutBody });

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/donations/checkout/don-1');
    expect(DonationService.createPending).toHaveBeenCalled();
  });

  // AE4 — garbage token proves enforcement is real (not silently bypassed).
  test('same request with a garbage _csrf value → 403', async () => {
    const agent = request.agent(app);
    await agent.get('/donations'); // establishes the csurf secret cookie

    const res = await agent
      .post('/donations/checkout')
      .type('form')
      .send({ _csrf: 'not-a-real-token', ...validCheckoutBody });

    expect(res.status).toBe(403);
    expect(DonationService.createPending).not.toHaveBeenCalled();
  });

  // AE4 — omitted token.
  test('same request with the _csrf field omitted → 403', async () => {
    const res = await request(app)
      .post('/donations/checkout')
      .type('form')
      .send(validCheckoutBody);

    expect(res.status).toBe(403);
    expect(DonationService.createPending).not.toHaveBeenCalled();
  });
});
