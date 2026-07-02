/**
 * CSRF-on lane — admin email-queue Retry (hidden input[name="_csrf"] body-field transport).
 *
 * Covers R8 — the ADMIN RETRY action, one of the three historical CSRF regressions
 * this lane exists to catch. The real Retry is the failed-email-job form the admin
 * dashboard renders (src/views/admin/dashboard.ejs → POST /admin/email-queue/:id/retry)
 * carrying the token in a hidden BODY field inside an admin-authenticated form. That
 * admin + body-field-transport combination is exercised nowhere else in the lane.
 *
 * Auth keeps its NODE_ENV==='test' admin fallback (no token needed for authorization),
 * so the only gate exercised here is REAL csurf: the positive path mints the hidden
 * `_csrf` field the dashboard emits and resends it in the POST body the way the
 * browser form does; the negative path (field omitted) must 403.
 */

const request = require('supertest');

jest.mock('../../src/config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../../src/services/backupLogService', () => ({
  getLastSuccessfulBackup: jest.fn(),
  getLastBackupAttempt: jest.fn()
}));
jest.mock('../../src/services/emailQueueService', () => ({
  getQueueStats: jest.fn(),
  retryFailedJob: jest.fn()
}));
// Dashboard live-metric reads (all self-guarded in the controller) — mocked only to
// keep the lane's output deterministic and quiet, mirroring adminDashboardRoutes.test.js.
jest.mock('../../src/services/DonationService', () => ({ getMtdTotalCents: jest.fn().mockResolvedValue(0) }));
jest.mock('../../src/services/userService', () => ({ getNewMemberCountThisMonth: jest.fn().mockResolvedValue(0) }));
jest.mock('../../src/services/messageService', () => ({ getNewMessageCount: jest.fn().mockResolvedValue(0) }));
jest.mock('../../src/services/memberAdminService', () => ({ getPendingApprovalCount: jest.fn().mockResolvedValue(0) }));
jest.mock('../../src/services/ChatService', () => ({ getPendingMessageCount: jest.fn().mockResolvedValue(0) }));
jest.mock('../../src/services/StreamingService', () => ({ getPublicEmbedMetadata: jest.fn().mockResolvedValue(null) }));
jest.mock('../../src/services/EventService', () => ({ getUpcomingEvents: jest.fn().mockResolvedValue([]) }));
jest.mock('../../src/services/auditService', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {}
}));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));

const { buildCsrfLaneApp, readCsrfInput } = require('./csrfLaneApp');
const backupLogService = require('../../src/services/backupLogService');
const emailQueueService = require('../../src/services/emailQueueService');

const app = buildCsrfLaneApp();
const JOB_ID = '42';

// Mint the CSRF token from the exact hidden `_csrf` field the dashboard retry form
// renders — the same body-field element the production browser form submits — reusing
// the agent's csurf secret cookie. Requires a failed job so the retry form is present.
async function mintTokenFromDashboard(agent) {
  const page = await agent.get('/admin');
  expect(page.status).toBe(200);
  const token = readCsrfInput(page.text);
  expect(token).toBeTruthy();
  return token;
}

describe('CSRF lane: admin email-queue retry (hidden body-field transport)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    backupLogService.getLastSuccessfulBackup.mockResolvedValue({ timestamp: '2026-06-14T00:00:00Z' });
    backupLogService.getLastBackupAttempt.mockResolvedValue({ timestamp: '2026-06-14T00:00:00Z', status: 'SUCCESS' });
    // A failed job makes the dashboard render the retry form (with its hidden _csrf).
    emailQueueService.getQueueStats.mockResolvedValue({
      counts: { failed: 1 },
      failed: [{ id: JOB_ID, data: { to: 'x@y.com' }, attemptsMade: 3, failedReason: 'boom' }]
    });
    emailQueueService.retryFailedJob.mockResolvedValue(true);
  });

  // R8 positive — Retry accepts the hidden body-field token minted off the dashboard.
  test('mint-then-submit: Retry with _csrf body field → not 403 (redirects to /admin)', async () => {
    const agent = request.agent(app);
    const token = await mintTokenFromDashboard(agent);

    const res = await agent
      .post(`/admin/email-queue/${JOB_ID}/retry`)
      .type('form')
      .send({ _csrf: token });

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/admin');
    expect(emailQueueService.retryFailedJob).toHaveBeenCalledWith(JOB_ID);
  });

  // R8 negative — same authenticated Retry with the _csrf field omitted → 403.
  test('same Retry with the _csrf field omitted → 403', async () => {
    const agent = request.agent(app);
    await agent.get('/admin'); // establishes the csurf secret cookie

    const res = await agent
      .post(`/admin/email-queue/${JOB_ID}/retry`)
      .type('form')
      .send({});

    expect(res.status).toBe(403);
    expect(emailQueueService.retryFailedJob).not.toHaveBeenCalled();
  });
});
