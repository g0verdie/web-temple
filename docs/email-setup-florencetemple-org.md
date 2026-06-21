# Email setup for `@florencetemple.org` (backlog item 15)

**Status:** runbook / decision record. **No application code change is required.**

## TL;DR

The app already sends mail through generic **SMTP (nodemailer)** and already defaults its
`From` address to `"Temple B'nai Israel" <no-reply@florencetemple.org>`. To "set up a custom
email server with address `@florencetemple.org`" you do **not** need to write or change code —
you need a **mail provider for the `florencetemple.org` domain plus DNS records**, then set a
handful of environment variables the code already reads.

Decision (confirmed): **use a hosted provider** (e.g. Google Workspace), not a self-hosted
mail server.

## Why hosted, not self-hosted

| | Hosted provider (Google Workspace / M365 / Fastmail) | Self-hosted (Postfix/Dovecot, Mailcow) |
|---|---|---|
| Deliverability / reputation | Managed for you; high inbox placement | You own IP warmup, blocklists, feedback loops |
| Security patching, backups, uptime | Provider's responsibility | Yours, 24/7 |
| Real mailboxes (`info@`, `rabbi@`) | Yes, with webmail + mobile | Yes, but you run IMAP too |
| Cost | ~$6–7 / user / month | "Free" software, real ops + server cost |
| Setup effort | Low (MX + auth DNS) | High and ongoing |

For a temple, a hosted provider satisfies the goal (a real `@florencetemple.org` mailbox plus
reliable outbound from the website) with far less operational risk. A self-hosted server is a
valid option but is heavy and not recommended here.

## What the app already assumes (no code change)

- Transport: `src/services/emailService.js` builds a nodemailer SMTP transport from env vars.
  If `SMTP_HOST` is **unset**, it falls back to a **mock that only logs** — so today, with no
  SMTP configured, no real mail is sent.
- From address: `process.env.SMTP_FROM || '"Temple B\'nai Israel" <no-reply@florencetemple.org>'`.
- Outbound is queued (Bull/Redis) with retries for most senders (welcome, password reset,
  verification, announcements, donation receipts, reminders). The contact-form notification is
  the one direct (non-queued) send — see "Optional polish" below.

So the work is **configuration + DNS**, not architecture.

## Step 1 — Provision the provider

1. Create a Google Workspace (or M365 / Fastmail) account for the `florencetemple.org` domain
   and verify domain ownership (a TXT record the provider supplies).
2. Create the mailboxes / addresses you want, e.g.:
   - `info@florencetemple.org` — receives contact-form submissions (`CONTACT_EMAIL`).
   - `no-reply@florencetemple.org` — outbound `From` for transactional mail (`SMTP_FROM`).
   - optionally `rabbi@florencetemple.org`, `admin@florencetemple.org`.
3. Create an **app password** (or SMTP credential) for the website's outbound account — do
   **not** use a human's primary password. Google: enable 2FA, then create an App Password;
   M365: create an app credential / SMTP AUTH user.

## Step 2 — DNS records on `florencetemple.org`

The provider supplies the exact values; you add them at your DNS registrar:

- **MX** — route inbound mail to the provider (e.g. Google's `ASPMX.L.GOOGLE.COM`, etc.).
- **SPF** (TXT) — authorize the provider to send for the domain, e.g.
  `v=spf1 include:_spf.google.com ~all`.
- **DKIM** (TXT) — the provider gives a selector + public key; enables signed mail.
- **DMARC** (TXT at `_dmarc`) — start in monitoring, e.g.
  `v=DMARC1; p=none; rua=mailto:dmarc@florencetemple.org`, then tighten to `p=quarantine`/`p=reject`
  once SPF+DKIM are confirmed aligned.

SPF + DKIM + DMARC are what keep the temple's mail out of spam — do not skip them.

## Step 3 — Environment variables (already read by the code)

Set these in the deployment environment / `.env` (see `.env.example` for the documented surface):

| Var | Purpose |
|---|---|
| `SMTP_HOST` | Provider SMTP host (e.g. `smtp.gmail.com`). **Setting this flips the app off the mock-logger path.** |
| `SMTP_PORT` | `587` (STARTTLS) or `465` (implicit TLS). Default 587. |
| `SMTP_SECURE` | `true` for 465, `false` for 587. |
| `SMTP_USER` / `SMTP_PASS` | The outbound account + app password from Step 1. |
| `SMTP_FROM` | `"Temple B'nai Israel" <no-reply@florencetemple.org>` (matches the code default). |
| `CONTACT_EMAIL` | Destination for contact-form submissions (e.g. `info@florencetemple.org`). |
| `ADMIN_EMAIL` | Admin alerts (failed email jobs, repeated donation failures). |
| `RABBI_EMAIL` | Major-donation alerts (falls back to `ADMIN_EMAIL` → `CONTACT_EMAIL`). |

Redis must be reachable (`REDIS_URL`) for the outbound queue/worker in production.

## Step 4 — Verify

1. Restart the app so it picks up the env (with `SMTP_HOST` set it stops mock-logging).
2. Trigger real sends and confirm delivery + inbox placement (not spam):
   - **Registration** (item 6) → the **verification email** must arrive (the whole two-gate
     signup is blocked until a user can verify).
   - **Contact form** (items 9 & 12) → a copy lands at `CONTACT_EMAIL`; the message also appears
     in the on-site inbox at `/admin/messages` regardless of email success.
   - Password reset, a test announcement, a donation receipt.
3. Check the provider's / Google Postmaster Tools DMARC reports for SPF/DKIM alignment, then
   tighten DMARC to `p=quarantine` and later `p=reject`.

## Cross-references

- **Item 6 (two-gate registration)** depends on working outbound email for the verification +
  approval/welcome messages. In dev they no-op to the log; in production they need this setup.
- **Items 9 & 12 (contact)** — the inbox persists every message on the website (durable record),
  and the email copy to `CONTACT_EMAIL` is best-effort on top.

## Optional polish (not required)

The contact-form notification (`emailService.sendContactNotification`) is the only sender that
bypasses the Bull queue (direct, fire-and-forget). Moving it onto `enqueueEmail` with a template
would give it the same retry/backoff as every other sender. It is **not** required: the contact
inbox already guarantees no message is lost even if the email send fails.
