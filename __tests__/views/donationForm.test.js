/**
 * Donation entry form as one coherent, accessible money page (I10).
 *
 * Turns the plan's Acceptance Examples into executable checks against the
 * rendered entry form (src/views/donations/index.ejs) and its page-scoped
 * rules (public/css/donations.css):
 *   AE1 (R6/R7) — the receipt-email label carries the red required marker and the
 *                 input reports aria-required (the JS lockstep toggle lives in
 *                 __tests__/public/donations.test.js).
 *   AE2 (R9)    — the custom-amount / email inputs fill the form column, not the
 *                 ~130px native default.
 *   AE3 (R11/R12) — the amount pill gains a visible focus ring and a selected state
 *                 beyond the native radio dot, using the site focus tokens.
 *   R2/R3       — the fields reuse the shared .form-group / .form-control convention.
 *   R4          — the Donate submit routes through the kit button partial (gold
 *                 primary), not the local .btn-primary.
 *   R5          — the title/subtitle route through the shared page-header partial.
 *   R14         — the required red comes from the token set (--color-danger).
 *   R16         — the CSRF and amount_cents hidden inputs survive the restructure.
 *
 * Renders the view directly with ejs.render (filename set so partial includes
 * resolve the Express way), matching __tests__/views/componentKit.test.js.
 */
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const VIEWS = path.join(__dirname, '../../src/views');
const CSS = path.join(__dirname, '../../public/css');

const renderView = (rel, data) => {
    const filename = path.join(VIEWS, `${rel}.ejs`);
    return ejs.render(fs.readFileSync(filename, 'utf8'), data, { filename });
};
const readCss = (f) => fs.readFileSync(path.join(CSS, f), 'utf8');

// Body of a CSS rule for an arbitrary selector (handles the `:has(...)` pills).
const ruleBody = (css, selector) => {
    const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
    const m = css.match(re);
    return m ? m[1] : null;
};

const render = () => renderView('donations/index', { csrfToken: 't' });

describe('donation entry form — shared page-header (R5)', () => {
    it('renders the title and subtitle through the page-header partial', () => {
        const html = render();
        expect(html).toContain('page-header__title');
        expect(html).toMatch(/Support Temple B(?:&#39;|')nai Israel/);
        expect(html).toContain('page-header__subtitle');
        expect(html).toMatch(/generosity sustains/);
    });

    it('no longer emits a bespoke <h1> + .subtitle for the page title', () => {
        const html = render();
        expect(html).not.toMatch(/<h1>Support Temple/);
        expect(html).not.toMatch(/<p class="subtitle">/);
    });
});

describe('donation entry form — Donate submit via the kit button (R4)', () => {
    it('renders the primary (gold) kit button, not the local .btn-primary', () => {
        const html = render();
        expect(html).toMatch(/c-btn c-btn--primary/);
        expect(html).toContain('Donate Now');
        expect(html).not.toMatch(/class="btn-primary"/);
    });
});

describe('donation entry form — one input system (R2, R3)', () => {
    it('the custom-amount, designation, and email inputs share the .form-control class', () => {
        const html = render();
        expect(html).toMatch(/id="custom_amount"[^>]*class="form-control"|class="form-control"[^>]*id="custom_amount"/);
        expect(html).toMatch(/id="designation"[^>]*class="form-control"|class="form-control"[^>]*id="designation"/);
        expect(html).toMatch(/id="donor_email"[^>]*class="form-control"|class="form-control"[^>]*id="donor_email"/);
    });

    it('wraps the fields in the shared .form-group convention', () => {
        expect(render()).toContain('form-group');
    });
});

describe('donation entry form — required receipt-email marker (AE1: R6, R7)', () => {
    it('the email label carries the red required marker', () => {
        const html = render();
        // The marker sits inside the email label, matching contact.ejs.
        expect(html).toMatch(/receipt[\s\S]*?<span class="required">\*<\/span>|<span class="required">\*<\/span>[\s\S]*?receipt/i);
    });

    it('the email input reports the required signal to assistive tech by default', () => {
        expect(render()).toMatch(/id="donor_email"[^>]*aria-required="true"|aria-required="true"[^>]*id="donor_email"/);
    });
});

describe('donation entry form — preserved plumbing (R16)', () => {
    it('keeps the CSRF and amount_cents hidden inputs', () => {
        const html = render();
        expect(html).toMatch(/name="_csrf"/);
        expect(html).toMatch(/id="amount_cents"/);
        expect(html).toMatch(/name="amount_cents"/);
    });
});

describe('donation form CSS — inputs fill the column on mobile (AE2: R9, R13)', () => {
    const css = readCss('donations.css');

    it('scopes a full-width .form-control so no field collapses to ~130px', () => {
        const body = ruleBody(css, '.donation-form .form-control');
        expect(body).not.toBeNull();
        expect(body).toMatch(/width:\s*100%/);
    });

    it('the .form-control meets the 44px minimum touch target', () => {
        expect(ruleBody(css, '.donation-form .form-control')).toMatch(/min-height:\s*44px/);
    });
});

describe('donation form CSS — visible pill focus + selected state (AE3: R11, R12, R14)', () => {
    const css = readCss('donations.css');

    it('the amount pill shows a keyboard focus ring using the site focus tokens', () => {
        const body = ruleBody(css, '.amount-level:has(input:focus-visible)');
        expect(body).not.toBeNull();
        expect(body).toMatch(/var\(--focus-outline\)/);
    });

    it('the selected pill has a distinct state beyond the native radio dot', () => {
        expect(css).toContain('.amount-level:has(input:checked)');
    });

    it('the required marker red comes from the token set, adding no new colour', () => {
        expect(ruleBody(css, '.donation-form .required')).toMatch(/var\(--color-danger\)/);
    });
});
