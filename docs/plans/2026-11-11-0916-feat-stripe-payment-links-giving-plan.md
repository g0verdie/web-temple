---
title: Stripe Payment Links Giving - Plan
type: feat
date: 2026-11-11
topic: stripe-payment-links-giving
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Stripe Payment Links Giving - Plan

## Goal Capsule

- **Objective:** Members who now give by check can give online by debit card, credit card, or bank transfer (ACH), once or monthly, from the temple's website. The money lands in a Stripe account the treasurer runs himself. This plan covers only the board's donations request; the Temple Merch and About the Rabbi requests are separate work (see How This Work Fits Together).
- **Means:** The public `/donations` page becomes a Give page whose buttons are plain links to Stripe-hosted Payment Links and the Stripe customer portal on the temple's own Stripe account. The never-launched custom checkout is retired.
- **Authority:** the user's decisions in this brainstorm, then the Requirements (R-IDs) below. The board and treasurer own every Stripe-account setting listed under Dependencies.
- **Open blockers:** none for planning. Launch waits on the board's Stripe account setup and its launch decisions (Dependencies / Assumptions).
- **Stop conditions:** stop and ask if the production database holds donation rows that are not demo or test data (Dependencies / Assumptions). Stop and ask if any change would loosen the Content-Security-Policy (R8) or touch an existing migration file (R13).

---

## Product Contract

### Summary

The `/donations` page becomes a Give page that sends donors to Stripe to give once in any amount, or monthly at fixed tiers, and lets monthly donors manage their gift through Stripe. Mailing a check stays on the page as an equal option. The site's own donation form, checkout, receipts, and admin donation screens are retired in favor of the treasurer's Stripe dashboard.

### Problem Frame

Members of Temple B'nai Israel give almost entirely by check, and they have asked to give by card and bank transfer. The website has a donation flow, but it never went live: its payment provider is a demo mock that moves no money, and the PayPal provider it was meant to swap in is a stub that throws on every call (`src/services/payments/PayPalProvider.js`, `src/services/payments/index.js`). Its "Monthly (recurring)" option only labels a single row; nothing charges a second time (`src/services/DonationService.js`).

Finishing that flow on Stripe turned out to be a large build, not the "credential swap" its comments describe. Monthly giving alone needs new records, webhook handling, and a receipt per installment, and someone would maintain keys and webhooks for years. The temple is volunteer-run, the treasurer already knows and likes Stripe, and the board asked for Stripe by name.

<!-- ce-section: work-relationships -->
### How This Work Fits Together

This plan covers online giving only. The board sent three requests together; the other two are the current understanding, not a committed roadmap.

- About the Rabbi page (public)
  - Can proceed independently of this plan.
  - Depends on open PR #7, which drafts Rabbi Tunick's bio inside the About page and grants the Rabbi role CMS access.
  - Still to decide: whether the bio moves to its own `/rabbi` CMS page, as recommended in research.
- Temple Merch page (public)
  - Can proceed independently of this plan.
  - Shares the Stripe-account rule in R15: merch sales must not run through the donations Stripe account.
  - Still to decide: which items are sold and how (research recommends a CMS `/shop` page linking out to print-on-demand, plus pick-up items), and the Alabama sales-tax question for a CPA.

### Actors

- A1. Donor: a member or visitor giving once or monthly, usually a former check-writer.
- A2. Treasurer: runs the temple's Stripe account and dashboard, handles refunds, bank-detail changes, and year-end letters.
- A3. Board: opens the Stripe account through an officer and approves funds, tiers, and receipt wording.
- A4. Staff with donation access: the roles that hold `VIEW_DONATIONS` today (admin, rabbi, treasurer, membership director).
- A5. Stripe: hosts payment pages, the customer portal, receipts, and the dashboard.

### Key Decisions

- **Stripe as the processor, replacing the never-built PayPal path.** The treasurer has used Stripe and likes it, and PayPal was never implemented, so nothing migrates. (session-settled: user-directed — chosen over PayPal: board request backed by the treasurer's Stripe experience; PayPal was only a stub.) Governs R2.
- **Stripe's own hosted tools on the temple's account, not a donation platform and not a custom build.** Lowest fees, neutral branding, and the treasurer works in his own dashboard; Donorbox stays available as a later upgrade on the same Stripe account. (session-settled: user-approved — chosen over Donorbox, which adds a 2.95% fee, and over finishing the custom checkout, which carries a large monthly-giving build and long-term upkeep: least added scope that meets the goal.) Governs R1, R2, R10.
- **No donor tip prompt and no church-branded donor pages.** Rules out Zeffy, Givebutter with tips, and Planning Center's Church Center pages. (session-settled: user-directed — chosen over Planning Center Giving: Church Center branding is not acceptable for a Reform synagogue's members.) Governs R2.
- **Monthly gifts come in fixed tiers.** Stripe's no-code links cannot take a donor-chosen monthly amount without an awkward quantity workaround. (session-settled: user-approved — chosen over the "36 × $1" quantity workaround: fixed tiers are enough at launch.) Governs R4.
- **Retire the custom donation flow rather than keep it dormant.** It never processed real money, and a second, unused payment path is carrying cost. (session-settled: user-approved — chosen over keeping the custom code behind the mock: no live data depends on it.) Governs R11, R12, R13.
- **Anonymous giving, on-site receipts, the major-gift alert, and admin donation figures go away.** Stripe always collects an email and becomes the record of gifts. The treasurer decides who is listed publicly and writes year-end letters from a Stripe export. (session-settled: user-approved — accepted as consequences of the hosted approach, over building replacements now.) Governs R11, R12.
- **Link addresses are developer-set configuration.** No admin settings store exists today, and links change rarely. (session-settled: user-approved — chosen over an admin-editable link setting: changing a fund or tier link takes a deploy.) Governs R10.

### Requirements

**Give page**

- R1. The public `/donations` page offers four ways to give: give once in an amount the donor chooses, give monthly at one of the fixed tiers, manage an existing monthly gift, and mail a check (payee and mailing address shown).
- R2. Every online option is a plain link to a Stripe-hosted page on the temple's own Stripe account; the site itself collects no payment details, amounts, or donor information.
- R3. Online gifts accept debit and credit cards and ACH bank payments, for one-time and monthly gifts.
- R4. Monthly giving offers the board's fixed tier list, each tier its own link; the default proposal is chai multiples ($18, $36, $54, $100 a month).
- R5. Donors choose a fund on the Stripe page from the board's approved list of up to 10 funds.
- R6. Before a donor leaves the site, the page tells them that Stripe processes the payment, that Stripe emails the receipt, that the temple sends a year-end giving letter, how to cancel or change a monthly gift, and that ACH donors contact the treasurer to change bank details.
- R7. The existing Give entry points (the header Give button, the footer Give link, and the About page's "Support Us" link) keep landing on the Give page.
- R8. The Give page works under the current Content-Security-Policy: plain links only, with no third-party scripts, iframes, or embedded widgets.
- R9. When an online link is not configured, its button does not appear and the page still renders; with no links configured, the page shows the check option alone.
- R10. The Stripe link addresses (one-time, each monthly tier, and the customer-portal login link) are deployment configuration set by a developer.

**Retiring the custom donation flow**

- R11. The custom donation flow is removed from the site: the on-site donation form, the checkout and demo-completion pages, the payment webhook receiver, the payment-provider layer, on-site receipt PDFs and receipt emails, and the major-donation alert email.
- R12. Where the admin area shows donation data today (the admin donations screens and the dashboard's donation figures), staff with donation access (A4) see a link to the Stripe dashboard instead; staff without that permission see nothing new.
- R13. Existing donation tables and their migration files stay untouched, and no donation data is dropped.

**Content and accounts**

- R14. The Privacy Policy and Terms of Use text that describes donations is updated to say Stripe processes payments and donor details; this is an admin edit of the CMS pages, not a code change.
- R15. The donations Stripe account takes only tax-deductible donations; merch, dues, tickets, and other sales use a separate account or platform.

### Key Flows

- F1. One-time gift
  - **Trigger:** A donor clicks Give in the header, footer, or About page.
  - **Actors:** A1, A5
  - **Steps:** The Give page explains the options; the donor chooses "Give once"; Stripe's page takes the amount, fund, and card or bank details; Stripe emails a receipt.
  - **Outcome:** The gift appears in the treasurer's Stripe dashboard.
  - **Covered by:** R1, R2, R3, R5, R6, R7
- F2. Monthly gift
  - **Trigger:** A donor chooses a monthly tier on the Give page.
  - **Actors:** A1, A5
  - **Steps:** Stripe's page shows the tier amount per month and the fund choice; the donor pays by card or ACH; Stripe charges monthly and emails a receipt each month.
  - **Outcome:** A Stripe subscription exists on the temple's account.
  - **Covered by:** R2, R3, R4, R5
- F3. Managing a monthly gift
  - **Trigger:** A monthly donor wants to cancel or change their card.
  - **Actors:** A1, A2, A5
  - **Steps:** The donor clicks "Manage my monthly gift"; Stripe emails a login link to the portal; the donor cancels or updates the card there. An ACH donor who needs a new bank account contacts the treasurer instead.
  - **Covered by:** R1, R6, R10
- F4. Year-end letters
  - **Trigger:** The tax year closes.
  - **Actors:** A2
  - **Steps:** The treasurer exports the year's gifts from Stripe and sends each donor a giving letter, alongside the letters for check donors.
  - **Covered by:** R6; the written-acknowledgment decision is under Dependencies / Assumptions.

### Acceptance Examples

- AE1. **Covers R9.** **Given** a deployment with no Stripe links configured, **when** a visitor opens `/donations`, **then** the page renders with the mail-a-check option and no online buttons.
- AE2. **Covers R9.** **Given** only the one-time link is configured, **when** a visitor opens `/donations`, **then** "Give once" and the check option appear, and the monthly and manage-gift buttons do not.
- AE3. **Covers R2, R4, R5.** **Given** all links are configured, **when** a donor clicks the $36 monthly tier, **then** the browser leaves the site for Stripe's page showing $36 a month with the fund choice.
- AE4. **Covers R12.** **Given** the custom flow is retired, **when** the treasurer opens the admin dashboard, **then** a link to the Stripe dashboard appears where the donation figures were; **when** the social chair opens the admin area, **then** no donation link appears.
- AE5. **Covers R8.** **Given** the new Give page, **when** it loads in a browser, **then** no CSP violation is reported and the site's CSP directives are unchanged.

### Scope Boundaries

**Deferred for later**

- Donor-chosen monthly amounts, a fuller donor portal, and automated year-end statements (the Donorbox upgrade on the same Stripe account).
- An admin-editable setting for the Stripe link addresses.
- Showing Stripe donation totals inside the site's admin dashboard.
- Dropping the old donation tables.
- A replacement for the major-donation alert to the rabbi.

**Outside this work**

- PayPal and Venmo giving; Stripe cannot offer either to a US account.
- An anonymous-giving option on the site.
- Embedded or pop-up checkout on the site.
- Merch, dues, or ticket sales (R15).

### Dependencies / Assumptions

- The board designates an officer to open the temple's Stripe account with two-factor sign-in; the developer gets a restricted role, not the owner login.
- The board supplies the legal name, EIN, payout bank account, and the IRS determination letter. Churches are exempt automatically and some never apply for a letter, so confirm one exists before applying for Stripe's nonprofit rate.
- The treasurer applies for Stripe's nonprofit rate (requires that at least 80% of volume is tax-deductible donations; the rate is reported as 2.2% + 30¢ but not published by Stripe).
- The treasurer creates the Payment Links (one-time "customer chooses price" link and one link per monthly tier, each with the fund dropdown and ACH enabled), configures the customer portal for cancel and card updates, turns on Stripe's payment receipt emails, and adds the "no goods or services were provided" statement and EIN to the invoice footer.
- Assumed: the production database holds no real donations, because the only active provider was the no-charge mock; this is checked before the retirement in R11 ships (Goal Capsule stop condition).
- Assumed: Stripe Billing's 0.7% fee on subscriptions applies to monthly gifts (about $3.20 per $100 a month at the nonprofit rate).
- Board and treasurer launch decisions (they do not block planning or code):
  - The fund list (up to 10) and the monthly tier amounts (R4, R5).
  - Written acknowledgment for gifts of $250 or more, which must carry the "no goods or services" statement: Stripe's plain one-time receipts have no free-text field, so either the treasurer's year-end letter serves as that acknowledgment or one-time gifts get Stripe invoice PDFs (0.4% per invoice, capped at $2).
  - Whether to offer donors a way to cover fees; Payment Links have no built-in toggle.

### Outstanding Questions

**Resolve Before Planning**

- None.

**Deferred to Planning**

- What visitors see at the retired checkout and receipt URLs: a redirect to the Give page or the standard not-found page.
- How the admin donations route ends: removed, or kept as a page that links out to Stripe (R12 fixes only what staff see).
- Which donation-specific tests are deleted and which are rewritten for the Give page.

### Sources / Research

- Current donation code: `src/services/payments/` (mock and PayPal stub), `src/controllers/donationController.js`, `src/services/DonationService.js`, `src/services/receiptPdfService.js`, `src/routes/donations.js`, `src/routes/admin/donations.js`, `src/views/donations/`, `src/views/admin/dashboard.ejs`, `src/controllers/adminController.js` (dashboard totals), `src/server.js` (webhook raw-body and CSRF exemption, CSP, sitemap), `src/config/roles-permissions.js` (`VIEW_DONATIONS`).
- Give entry points: `src/views/layout.ejs` (header button and footer link), `src/views/about.ejs` ("Support Us").
- Legal text mentioning donations: `migrations/021_seed_legal_pages.sql` (seeded CMS rows, edited through `/admin/pages/:slug`).
- Earlier donation plans this work supersedes: `docs/plans/2026-06-14-002-feat-donations-plan.md`, `docs/plans/2026-07-02-006-feat-donation-capture-path-plan.md`, `docs/plans/2026-07-02-007-feat-donation-form-rebuild-plan.md`.
- Stripe: Payment Links "customer chooses price" is one-time only (https://docs.stripe.com/payments/checkout/pay-what-you-want); customer portal (https://docs.stripe.com/customer-management); ACH Direct Debit (https://docs.stripe.com/payments/ach-direct-debit); receipts (https://docs.stripe.com/receipts); nonprofit discount eligibility (https://support.stripe.com/questions/fee-discount-for-nonprofit-organizations); PayPal through Stripe is EU/UK-only (https://docs.stripe.com/payments/paypal); pricing (https://stripe.com/pricing).
- Alternatives weighed: Donorbox (https://donorbox.org/pricing), Givebutter, Zeffy, Planning Center Giving (https://www.planningcenter.com/giving).
