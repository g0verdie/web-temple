---
title: Provider-Authoritative Capture Path + Conformance Suite - Plan
type: feat
date: 2026-07-02
topic: provider-authoritative-capture-path
execution: code
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# Provider-Authoritative Capture Path + Conformance Suite - Plan

## Goal Capsule

Objective: build and test the OWASP-shaped provider-authoritative donation path now — a hardened mock that decides outcomes server-side, a signature-verified webhook receiver with idempotent finalize and server-side amount recompute, and a conformance suite that freezes the port — so real-money go-live becomes a credential swap rather than a security build under Board deadline.

Product authority: idea I1 in `docs/ideation/2026-07-01-full-project-review-ideation.html:197`, narrowed by the owner scope decision of 2026-07-02 (build the path + conformance suite; defer the real PayPal SDK and credentials).

Open blockers: the mock's server-side outcome rule for the demo, and the sync-vs-async completion UX, are unresolved and gate planning (see Outstanding Questions). The mock stays the active provider; no real money, no PayPal credentials.

## Product Contract

### Summary

Today the completion flow trusts the client. `completeCheckout` reads `outcome` from `req.body` (`src/controllers/donationController.js:103`) and passes it straight into `MockPaymentProvider.capture()`, whose only logic is to echo that outcome back as a terminal status (`src/services/payments/MockPaymentProvider.js:22`). There is no webhook receiver anywhere in the donation routes (`src/routes/donations.js:20`). The one thing that is already safe is `finalize`: a single conditional `UPDATE ... WHERE id = $1 AND status = 'pending'` (`src/services/DonationService.js:110`) makes finalize atomic and idempotent per donation row, but it never recomputes or checks the amount — it only flips status. This work moves the outcome decision to the server, routes finalize behind a signature-verified receiver that revalidates the amount, and locks the contract with a conformance suite.

### Problem Frame

The mock echoes a client-chosen outcome, so a hand-crafted POST can fabricate a completed donation (subject only to the ownership cookie and per-IP rate limit). The gap is not "the mock is fake" — it is that the capture path itself is not provider-authoritative, so security-critical code (signature verification, amount recompute, replay defense) does not exist yet and would otherwise be written after the Board says yes, with real money riding on unproven code.

### Key Decisions

Build the path against the hardened mock and a stubbed provider; do not wire the PayPal SDK or credentials. The mock delivers its server-decided result through the same signature-verified receiver a real provider would call, so the mock exercises the real verification code — not a bypass. Genuine provider failures use `ProviderError` (`src/errors/index.js:76`); webhook rejections (bad signature, amount mismatch, unknown transaction) are non-finalizing rejects, not 502s.

### Requirements

Provider-authoritative outcome

R1. `capture()` determines the terminal status (completed / failed / cancelled) and the transaction id from server-side logic only; it must not read an outcome, amount, or status from the client request or any client-controlled input.

R2. The browser completion request may signal only intent to finalize; it must not carry or influence the terminal status, amount, or transaction id used to finalize.

R3. The mock's server-side decision must still exercise the success, failure, and cancel paths for the Board demo without trusting client input (for example a deterministic or sentinel-amount rule); the exact rule is an open question below.

Signed webhook receiver

R4. Add a webhook receiver route on the donation surface that finalizes a donation only after verifying an internal HMAC-SHA256 signature computed over the RAW, unparsed request body.

R5. Signature verification uses constant-time comparison with a length guard, mirroring `src/utils/unsubscribeToken.js:41`; a missing, malformed, or non-matching signature is rejected and the donation stays PENDING.

R6. The receiver enforces idempotency keyed on the provider transaction id: a duplicate or replayed callback finalizes the donation at most once and re-runs no side-effects (receipt email, major-donation alert, metrics cache bust).

R7. Before finalizing, the receiver recomputes and validates the amount server-side by comparing the callback amount against the authoritative PENDING row (`DonationService.getById` returns the decrypted `amountCents`, `src/services/DonationService.js:103`); any mismatch is rejected without finalizing.

R8. The receiver is exempt from global CSRF the same way the one-click unsubscribe endpoint is (`src/server.js:157`), because it carries no browser session or CSRF token; the exemption must not create a route that finalizes without a valid signature.

R9. The receiver captures the raw request body for HMAC verification despite the global `express.json()` mount, which currently has no `verify` hook (`src/server.js:133`).

Signed callback delivery (hardened mock)

R10. The hardened mock delivers its server-decided result to the receiver via an internal signed callback (simulating a provider webhook), so finalize is driven by a signature-verified message rather than a client report.

R11. The internal callback signs the identical raw-body HMAC contract the receiver verifies, so the mock runs the same verification code a real provider would trigger.

Provider conformance suite

R12. Add a provider conformance suite encoding the OWASP third-party-gateway rules as executable assertions: server-side amount recompute, provider-authoritative status, idempotent finalize, and signature-verified callbacks.

R13. The suite is written to the OWASP contract rather than to the mock's current shape, and `MockPaymentProvider` passes it today.

R14. The suite references `PayPalProvider` as the future implementation that MUST pass the same assertions, without requiring it to be wired.

PayPal stub

R15. Add `PayPalProvider` as a STUB behind the existing `PaymentProvider` interface (`src/services/payments/PaymentProvider.js:14`) and selectable via `PAYMENT_PROVIDER`, not wired to any PayPal SDK or credentials.

R16. The mock stays the ACTIVE provider (`PAYMENT_PROVIDER` defaults to `mock`, `src/services/payments/index.js:14`); no real PayPal credentials, no real money.

Error typing

R17. Genuine provider-path failures (provider unavailable, capture could not complete) raise `ProviderError` (`src/errors/index.js:76`); webhook rejections (bad signature, amount mismatch, unknown transaction) are non-finalizing rejections that never surface as success and are logged via `src/utils/logger.js`.

Security and idempotency test coverage

R18. A test proves a duplicate or replayed valid callback finalizes at most once — no second completed row, no repeated receipt or alert.

R19. A test proves a bad or absent HMAC signature is rejected and the donation stays PENDING.

R20. A test proves an amount-mismatch callback is rejected and the donation stays PENDING.

R21. A test proves `capture()` ignores any client-supplied outcome or amount (provider-authoritative status).

R22. Tests follow the existing conventions: CSRF short-circuit under `NODE_ENV === 'test'` (`src/server.js:151`), the donation rate limiter skipped in test (`src/routes/donations.js:15`), and `src/config/db` mocked per the integration pattern.

### Acceptance Examples

AE1. Covers-R6, R18: given a donation finalized by transaction T, when the same signed callback for T is replayed, then the donation is completed exactly once and no second receipt or major-donation alert is queued.

AE2. Covers-R4, R5, R19: given a callback whose HMAC does not match its raw body, when posted to the receiver, then the request is rejected and the donation remains PENDING.

AE3. Covers-R7, R20: given a PENDING donation of $50 and a validly signed callback claiming $5, when posted to the receiver, then it is rejected and the donation remains PENDING.

AE4. Covers-R1, R2, R21: given a completion request carrying `outcome=success` while the mock's server-side rule declines, then the donation is not completed and the client-supplied outcome is ignored.

AE5. Covers-R6: given two concurrent valid callbacks for the same PENDING donation, then exactly one finalize succeeds because the conditional UPDATE (`src/services/DonationService.js:110`) admits a single pending-to-completed transition.

### Success Criteria

Go-live reduces to setting `PAYMENT_PROVIDER=paypal` plus a credential swap, with no from-scratch security work. The conformance suite is green for the mock and referenced (unwired) for PayPal. No code path lets a client-reported outcome or amount finalize a donation.

### Scope Boundaries

In scope: harden `MockPaymentProvider`, add the signed webhook receiver, route the mock's result through an internal signed callback, write the conformance suite, add the `PayPalProvider` stub, apply `ProviderError` to provider failures, and add the security and idempotency tests.

Out of scope: wiring the real PayPal SDK, sandbox, or live credentials; any real money; the circuit-breaker wrapper (deferred with PayPal per `src/services/payments/index.js:6`); a recurring monthly-charge engine; and the I1 companion "honest MRR label" dashboard relabel, which the owner scope decision did not select.

Adjacent, not owned here: the I10 donation-form rebuild edits the same `src/controllers/donationController.js` and `src/routes/donations.js`; this work shares that stream and must be sequenced with I10 rather than duplicating or conflicting on the controller.

### Dependencies / Assumptions

The `ProviderError` taxonomy is present on dev (`src/errors/index.js:76`) and maps to 502 via `mapError`.

A constant-time HMAC pattern already exists to mirror (`src/utils/unsubscribeToken.js:18`), including the length guard before `timingSafeEqual`.

`finalize` is already atomic and idempotent per row via the conditional UPDATE (`src/services/DonationService.js:110`); the receiver builds on that rather than reimplementing it, adding transaction-id-level idempotency and amount recompute on top.

The internal callback secret is assumed to come from an env var (pattern like `UNSUBSCRIBE_TOKEN_SECRET` falling back to `JWT_SECRET`, `src/utils/unsubscribeToken.js:16`); the exact variable is an open question.

This work overlaps I10 on `donationController.js` and `donations.js`; the two must run as one sequence or coordinated stream to avoid merge conflict.

### Outstanding Questions

Resolve before planning:

What server-side rule does the hardened mock use to still demonstrate success, failure, and cancel for the Board without trusting client input (sentinel amount, config flag, or deterministic rule)? This shapes R3 and the demo script.

Does completion finalize synchronously (an in-process signed callback before the thank-you redirect) or asynchronously (the checkout page polls for the webhook result)? Moving finalize behind a webhook changes the current synchronous redirect at `src/controllers/donationController.js:110` and overlaps the I10 checkout UX.

Which secret signs the internal callback — a new dedicated env var, or reuse of an existing one?

Deferred:

Real PayPal sandbox and live integration, the circuit-breaker wrapper, the recurring-charge engine, and the MRR relabel companion.

### Sources / Research

`docs/ideation/2026-07-01-full-project-review-ideation.html:197` — idea I1, provider-authoritative capture path.
`src/services/payments/MockPaymentProvider.js:22` — `capture()` echoes the client-supplied `outcome`.
`src/services/payments/PaymentProvider.js:14` — interface; integrity contract comment states a real provider must derive outcome from provider authority.
`src/services/payments/index.js:14` — provider selection; default `mock`; circuit breaker deferred with PayPal.
`src/controllers/donationController.js:103` — `outcome` sourced from `req.body` then passed to `capture()` at line 104.
`src/routes/donations.js:20` — donation routes; no webhook receiver exists; limiter skipped in test at line 15.
`src/services/DonationService.js:110` — finalize is an atomic, idempotent conditional UPDATE; does not recompute amount.
`src/services/DonationService.js:103` — `getById` returns the decrypted authoritative `amountCents` for server-side recompute.
`src/errors/index.js:76` — `ProviderError` maps to 502 through `mapError`.
`src/utils/unsubscribeToken.js:18` — HMAC-SHA256 + constant-time compare pattern to mirror for signature verification.
`src/server.js:133` — global `express.json()` with no `verify` hook (raw body not captured today).
`src/server.js:157` — `/unsubscribe` CSRF exemption precedent for a server-to-server webhook.
`__tests__/services/payments/MockPaymentProvider.test.js` — existing provider test location for the conformance suite to sit beside.
