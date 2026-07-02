/**
 * Shared EJS component kit + action-color contract (I15).
 *
 * Turns the plan's Acceptance Examples into executable checks:
 *   AE1 (R2/R5/R6) — button variants render; destructive red traces to --color-danger.
 *   AE2 (R4/R14)   — zero-member directory pages render the empty-state partial.
 *   AE3 (R8/R11)   — admin directory Apply/Search route through the kit (no bare buttons).
 *   AE4 (R3/R12)   — admin directory Export link is navigational, not UA-blue .btn-link.
 * Plus R13 — a real admin Delete row action carries the destructive class.
 *
 * Renders partials/views directly with ejs.render (filename set so includes
 * resolve the Express way), matching __tests__/views/announcementsAdmin.*.
 */
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const VIEWS = path.join(__dirname, '../../src/views');
const CSS = path.join(__dirname, '../../public/css');

const renderPartial = (name, data) => {
    const filename = path.join(VIEWS, `partials/${name}.ejs`);
    return ejs.render(fs.readFileSync(filename, 'utf8'), data, { filename });
};
const renderView = (rel, data) => {
    const filename = path.join(VIEWS, `${rel}.ejs`);
    return ejs.render(fs.readFileSync(filename, 'utf8'), data, { filename });
};
const readCss = (f) => fs.readFileSync(path.join(CSS, f), 'utf8');

// Body of the *base* rule for a selector (ignores :hover/:focus variants, which
// carry a `:` before `{` and so fail the `\s*\{` match).
const ruleBody = (css, selector) => {
    const re = new RegExp(selector.replace(/[.\-]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
    const m = css.match(re);
    return m ? m[1] : null;
};

describe('button partial — semantic variant taxonomy (AE1: R2, R5, R6)', () => {
    it('destructive variant carries the destructive class', () => {
        const html = renderPartial('button', { variant: 'destructive', label: 'Delete' });
        expect(html).toContain('c-btn--destructive');
        expect(html).toContain('Delete');
    });

    it('primary variant renders primary and never destructive/red', () => {
        const html = renderPartial('button', { variant: 'primary', label: 'Give' });
        expect(html).toContain('c-btn--primary');
        expect(html).not.toContain('c-btn--destructive');
    });

    it('navigational variant carries the navigational class', () => {
        const html = renderPartial('button', { variant: 'navigational', label: 'Next' });
        expect(html).toContain('c-btn--navigational');
    });

    it('renders <button type="submit"> by default and <a> when href is given', () => {
        const asButton = renderPartial('button', { variant: 'primary', label: 'Save' });
        expect(asButton).toMatch(/<button[^>]*type="submit"/);
        const asLink = renderPartial('button', { variant: 'navigational', label: 'Go', href: '/somewhere' });
        expect(asLink).toMatch(/<a[^>]*href="\/somewhere"/);
        expect(asLink).not.toMatch(/<button/);
    });

    it('an unknown variant falls back to primary (red is never reachable by accident)', () => {
        const html = renderPartial('button', { variant: 'decorative', label: 'x' });
        expect(html).toContain('c-btn--primary');
        expect(html).not.toContain('c-btn--destructive');
    });
});

describe('action-color contract — red only via destructive (R5, R6, R7)', () => {
    const components = readCss('components.css');
    const main = readCss('main.css');

    it('defines a --color-danger token (and hover) in the shared :root', () => {
        expect(main).toMatch(/--color-danger\s*:/);
        expect(main).toMatch(/--color-danger-hover\s*:/);
    });

    it('destructive is the only variant whose red comes from --color-danger', () => {
        expect(ruleBody(components, '.c-btn--destructive')).toMatch(/var\(--color-danger\)/);
        expect(ruleBody(components, '.c-btn--primary')).not.toMatch(/--color-danger/);
        expect(ruleBody(components, '.c-btn--navigational')).not.toMatch(/--color-danger/);
    });

    it('primary maps to the I9 gold and navigational to the navy nav', () => {
        expect(ruleBody(components, '.c-btn--primary')).toMatch(/var\(--color-gold\)/);
        expect(ruleBody(components, '.c-btn--navigational')).toMatch(/var\(--color-primary\)/);
    });

    it('the base button removes the UA underline so navigational links are not blue-underlined', () => {
        expect(ruleBody(components, '.c-btn')).toMatch(/text-decoration:\s*none/);
    });
});

describe('native control reset is scoped to the kit — bare buttons keep affordance (AE3: R8, R9)', () => {
    const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
    const components = readCss('components.css');

    it('the kit never targets the bare <button> element, so an unconverted native submit is not stripped to text', () => {
        // The kit is loaded site-wide via layout.ejs. Every "button" mention must live
        // in a comment; no element-level selector may reset native chrome, or a
        // not-yet-converted <button> collapses to affordance-less text on live pages.
        expect(stripComments(components)).not.toMatch(/\bbutton\b/);
    });

    it('the appearance reset is carried by the .c-btn kit class', () => {
        expect(ruleBody(components, '.c-btn')).toMatch(/appearance:\s*none/);
    });

    it('the kit stylesheet is linked globally in layout.ejs', () => {
        const layout = fs.readFileSync(path.join(VIEWS, 'layout.ejs'), 'utf8');
        expect(layout).toContain('href="/css/components.css"');
    });
});

describe('flagged bare admin submits routed through the kit (blast-radius regression)', () => {
    const messagesData = { filterStatus: '', messages: [], totalPages: 1, currentPage: 1 };
    const donationsData = {
        metrics: {
            totalAllTimeCents: 0, totalYtdCents: 0, totalMtdCents: 0,
            identifiedDonorCount: 0, anonymousGiftCount: 0,
            recurringDonorCount: 0, monthlyRecurringRevenueCents: 0
        },
        filters: { type: '', anon: '', startDate: '', endDate: '' },
        donations: [], totalPages: 1, currentPage: 1
    };

    it('admin messages-list "Apply" carries the kit class, not a bare native submit', () => {
        const html = renderView('admin/messages/list', messagesData);
        expect(html).toMatch(/<button[^>]*class="[^"]*c-btn[^"]*"[^>]*>Apply<\/button>/);
        expect(html).not.toMatch(/<button type="submit">\s*Apply/);
    });

    it('admin donations "Filter" carries the kit class, not a bare native submit', () => {
        const html = renderView('admin/donations', donationsData);
        expect(html).toMatch(/<button[^>]*class="[^"]*c-btn[^"]*"[^>]*>Filter<\/button>/);
        expect(html).not.toMatch(/<button type="submit">\s*Filter/);
    });
});

describe('empty-state partial (AE2: R4)', () => {
    it('renders the message inside the shared empty-state block', () => {
        const html = renderPartial('empty-state', { message: 'Nothing here yet.' });
        expect(html).toContain('empty-state');
        expect(html).toContain('Nothing here yet.');
    });

    it('renders an optional navigational action link', () => {
        const html = renderPartial('empty-state', { message: 'Empty.', actionHref: '/go', actionLabel: 'Add one' });
        expect(html).toMatch(/href="\/go"/);
        expect(html).toContain('Add one');
        expect(html).toContain('c-btn--navigational');
    });
});

describe('directory empty states routed through the partial (AE2: R14)', () => {
    it('public directory (nothing listed) uses empty-state, not a bespoke <p class="directory-empty">', () => {
        const html = renderView('directory/index', { profiles: [], filters: { search: '' } });
        expect(html).toContain('empty-state');
        expect(html).toMatch(/No members are listed/);
        expect(html).not.toContain('class="directory-empty"');
    });

    it('public directory (no search match) uses empty-state and keeps the copy', () => {
        const html = renderView('directory/index', { profiles: [], filters: { search: 'choir' } });
        expect(html).toContain('empty-state');
        expect(html).toMatch(/No members match/);
    });

    it('admin directory (no members) uses empty-state, not a bespoke <p class="directory-empty">', () => {
        const html = renderView('admin/directory', {
            members: [], filters: { search: '' }, totalPages: 1, currentPage: 1, csrfToken: 't'
        });
        expect(html).toContain('empty-state');
        expect(html).toContain('No members found');
        expect(html).not.toContain('class="directory-empty"');
    });
});

describe('admin directory row actions routed through the kit (AE3/AE4: R11, R12)', () => {
    const render = () => renderView('admin/directory', {
        members: [{ user_id: 'u1', first_name: 'Pat', last_name: 'Q', email: 'p@x.com', listed: true, has_profile: true }],
        filters: { search: '' }, totalPages: 1, currentPage: 1, csrfToken: 't'
    });

    it('the destructive moderation Apply submit carries the destructive class', () => {
        expect(render()).toContain('c-btn--destructive');
    });

    it('no row action renders as a bare unclassed native submit button', () => {
        const html = render();
        expect(html).not.toMatch(/<button type="submit">\s*(Search|Apply)/);
    });

    it('Export CSV routes through the navigational variant, not a bare .btn-link', () => {
        const html = render();
        expect(html).toMatch(/href="\/admin\/directory\/export\.csv"/);
        expect(html).toContain('c-btn--navigational');
        expect(html).not.toContain('btn-link');
    });
});

describe('a real admin Delete row action is token-backed danger (R13)', () => {
    const render = () => renderView('admin/calendar/list', {
        events: [{ id: 1, title: 'Shabbat', date: '2026-06-01', visibility: 'public', type: 'service', location: 'Main' }],
        csrfToken: 't', formatEventDate: () => 'Jun 1'
    });

    it('calendar list Delete carries the destructive class, not the hardcoded admin.css hex', () => {
        const html = render();
        expect(html).toContain('c-btn--destructive');
        expect(html).toContain('Delete');
        expect(html).not.toContain('btn-danger');
    });

    it('the sibling Edit link is kit-styled too (admin.css is not loaded on this route)', () => {
        const html = render();
        expect(html).toMatch(/<a[^>]*class="[^"]*c-btn[^"]*"[^>]*>Edit<\/a>/);
        expect(html).not.toContain('btn-outline');
    });
});

describe('page-header partial (R1)', () => {
    it('renders the title and optional subtitle in the shared header', () => {
        const html = renderPartial('page-header', { title: 'My Page', subtitle: 'A subtitle' });
        expect(html).toContain('page-header');
        expect(html).toContain('My Page');
        expect(html).toContain('A subtitle');
    });

    it('admin directory uses the page-header partial in place of a bespoke header', () => {
        const html = renderView('admin/directory', {
            members: [], filters: { search: '' }, totalPages: 1, currentPage: 1, csrfToken: 't'
        });
        expect(html).toContain('page-header');
        expect(html).toContain('Member Directory — Admin');
    });
});
