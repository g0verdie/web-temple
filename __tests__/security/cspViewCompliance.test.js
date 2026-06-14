const fs = require('fs');
const path = require('path');

/**
 * CSP-compliance regression guard (U7).
 * Strict CSP in src/server.js forbids inline <script>/<style>/style=/on*= and any
 * script/link/iframe host not in the allowlist. This test fails if any shipped view
 * reintroduces one of those, so the whole class can't silently regress again.
 *
 * Allowlist mirrors the helmet CSP directives in src/server.js (script/style/frame src).
 */

const VIEWS_DIR = path.join(__dirname, '../../src/views');
// Dev-only page, gated out of production in src/routes/home.js (not shipped) — excluded.
const EXCLUDED = new Set(['responsive-test.ejs']);

const hostAllowed = (host) =>
    /(^|\.)hcaptcha\.com$/.test(host) ||
    host === 'www.facebook.com' ||
    host === 'www.youtube.com' ||
    host === 'www.google.com';

// True when a script/link/iframe URL is self/relative, an EJS expression, or an
// allowlisted absolute host. Only literal absolute http(s)/protocol-relative URLs
// are host-checked; relative paths and `<%= ... %>` expressions pass.
function resourceUrlAllowed(url) {
    if (!/^(https?:)?\/\//i.test(url)) return true; // relative, self, or EJS expr
    let host;
    try {
        host = new URL(url.startsWith('//') ? 'https:' + url : url).host;
    } catch (e) {
        return false;
    }
    return hostAllowed(host);
}

function findViolations(content) {
    const violations = [];
    if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(content)) violations.push('inline <script> (no src)');
    if (/<style[\s>]/i.test(content)) violations.push('<style> block');
    if (/\sstyle\s*=\s*["']/i.test(content)) violations.push('inline style= attribute');
    if (/\son[a-z]+\s*=\s*["']/i.test(content)) violations.push('inline on*= event handler');

    const resourceRe = /<(?:script|iframe)\b[^>]*\bsrc=["']([^"']+)["']|<link\b[^>]*\bhref=["']([^"']+)["']/gi;
    let m;
    while ((m = resourceRe.exec(content)) !== null) {
        const url = m[1] || m[2];
        if (!resourceUrlAllowed(url)) violations.push(`non-allowlisted resource host: ${url}`);
    }
    return violations;
}

function walkViews(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walkViews(full));
        else if (entry.name.endsWith('.ejs') && !EXCLUDED.has(entry.name)) out.push(full);
    }
    return out;
}

describe('CSP view-compliance guard (U7)', () => {
    describe('detector', () => {
        test('flags inline script, style block, style attr, on*= handler, rogue CDN', () => {
            expect(findViolations('<script>alert(1)</script>')).toContain('inline <script> (no src)');
            expect(findViolations('<style>.a{}</style>')).toContain('<style> block');
            expect(findViolations('<div style="color:red"></div>')).toContain('inline style= attribute');
            expect(findViolations('<button onclick="x()">x</button>')).toContain('inline on*= event handler');
            expect(findViolations('<form onsubmit="return f()"></form>')).toContain('inline on*= event handler');
            expect(findViolations('<script src="https://cdn.jsdelivr.net/x.js"></script>'))
                .toContain('non-allowlisted resource host: https://cdn.jsdelivr.net/x.js');
            expect(findViolations('<link rel="stylesheet" href="//evil.com/x.css">'))
                .toContain('non-allowlisted resource host: //evil.com/x.css');
        });

        test('passes self/relative scripts, allowlisted hosts, and data-/aria- attributes', () => {
            expect(findViolations('<script src="/js/x.js"></script>')).toEqual([]);
            expect(findViolations('<link rel="icon" href="/favicon.svg">')).toEqual([]);
            expect(findViolations('<script src="https://js.hcaptcha.com/1/api.js" async defer></script>')).toEqual([]);
            expect(findViolations('<iframe src="https://www.google.com/maps/embed"></iframe>')).toEqual([]);
            expect(findViolations('<button data-onboarding-complete="false" data-confirm="Sure?">x</button>')).toEqual([]);
            expect(findViolations('<iframe src="<%= activeStream.facebookLiveUrl %>"></iframe>')).toEqual([]);
        });
    });

    describe('all shipped views comply', () => {
        const files = walkViews(VIEWS_DIR);

        test('found views to scan', () => {
            expect(files.length).toBeGreaterThan(0);
        });

        test.each(files)('%s has no CSP violations', (file) => {
            const content = fs.readFileSync(file, 'utf8');
            const violations = findViolations(content);
            expect(violations).toEqual([]);
        });
    });
});
