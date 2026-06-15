/**
 * U2 — Sentry PII scrub (beforeSend) + captureException passthrough.
 *
 * Crash handlers now forward errors that may carry decrypted donor emails, so
 * beforeSend must redact email-shaped strings from the message, exception
 * values, and breadcrumbs before the event leaves the process.
 */

const Sentry = require('@sentry/node');
const sentry = require('../../src/config/sentry');

describe('sentry beforeSend PII scrub (U2)', () => {
  test('redacts an email-shaped string in the event message', () => {
    const event = { message: 'decrypt failed for donor jane.doe@example.com on row 42' };
    const out = sentry.scrubEvent(event);
    expect(out.message).not.toContain('@');
    expect(out.message).not.toContain('jane.doe@example.com');
    expect(out.message).toContain('[redacted-email]');
    expect(out.message).toContain('row 42');
  });

  test('redacts emails in exception values and breadcrumb messages', () => {
    const event = {
      exception: { values: [{ value: 'error contacting bob@temple.org' }] },
      breadcrumbs: [{ message: 'user alice@gmail.com submitted donation' }]
    };
    const out = sentry.scrubEvent(event);
    expect(out.exception.values[0].value).not.toContain('@');
    expect(out.breadcrumbs[0].message).not.toContain('@');
  });

  test('leaves a non-email message untouched', () => {
    const event = { message: 'plain failure with no PII' };
    expect(sentry.scrubEvent(event).message).toBe('plain failure with no PII');
  });

  test('null/non-object events pass through without throwing', () => {
    expect(() => sentry.scrubEvent(null)).not.toThrow();
    expect(sentry.scrubEvent(null)).toBeNull();
  });
});

describe('captureException passthrough (U2)', () => {
  test('is a no-op (does not call Sentry.captureException) when disabled in test', () => {
    const spy = jest.spyOn(Sentry, 'captureException').mockImplementation(() => {});
    expect(sentry.isEnabled()).toBe(false); // NODE_ENV==='test' → never enabled
    expect(() => sentry.captureException(new Error('boom'))).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
