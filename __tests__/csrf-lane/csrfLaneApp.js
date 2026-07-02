/**
 * CSRF-on critical-path test lane — app factory.
 *
 * The default Jest suite runs with the load-bearing `NODE_ENV==='test'` CSRF
 * bypass in `src/server.js` (line 142), so no test ever exercises the real
 * mint-token-then-submit flow. This factory boots a SEPARATE Express instance
 * that mounts the real routers behind REAL `csurf` enforcement — it never
 * requires the `src/server.js` singleton and never touches that bypass, so the
 * global hatch stays byte-for-byte identical for every other test.
 *
 * Every other test hatch is left on: this app still runs under `NODE_ENV==='test'`,
 * so `src/config/db` stays mocked, `src/config/redis` returns its in-memory stub,
 * no workers start, and `requireAuth`/`requireRbac` keep their test-admin fallback.
 * Only the CSRF short-circuit is replaced with genuine enforcement.
 *
 * The middleware chain mirrors the CSRF-relevant slice of `src/server.js` in the
 * same order (body parsers → cookies → csrf → token-to-locals → view globals →
 * routers → EBADCSRFTOKEN handler), swapping `conditionalCsrf` for a bare
 * `csrfProtection` configured identically to `src/server.js:129`.
 */

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');

const { Permissions, hasPermission } = require('../../src/config/roles-permissions');
const { formatEventDateTime, formatEventTime } = require('../../src/utils/templeTime');

function buildCsrfLaneApp() {
  const app = express();
  app.set('trust proxy', 1);

  // View engine + locals — mirror src/server.js so the real views render.
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../../src/views'));
  app.locals.formatEventDate = formatEventDateTime;
  app.locals.formatEventTime = formatEventTime;

  // Body parsing + cookies (same order as src/server.js).
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Real CSRF enforcement — the whole point of the lane. Config is identical to
  // src/server.js:129, but with NO NODE_ENV==='test' short-circuit wrapping it,
  // so the token contract is actually verified here.
  const csrfProtection = csurf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    }
  });
  app.use(csrfProtection);

  // Expose the token to views exactly as src/server.js:155 does — this feeds the
  // meta[name="csrf-token"] tag in layout.ejs and the hidden input in the views.
  app.use((req, res, next) => {
    res.locals.csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : null;
    next();
  });

  // Minimal view globals the shared layout/partials read (src/server.js sets
  // these via its global middleware). Scoped to what the covered views touch.
  app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.hasPermission = (permission) => hasPermission(req.user, permission);
    res.locals.Permissions = Permissions;
    res.locals.currentPath = req.path;
    res.locals.baseUrl = '';
    res.locals.chrome = { liveNow: false, watchUrl: '/watch', serviceTimes: null };
    next();
  });

  // Real routers under test — the exact modules src/server.js mounts, in the same
  // relative order (`/admin` dashboard before `/admin/pages`, matching src/server.js:309-310;
  // the dashboard router only owns /, /email-queue/:id/retry, etc., so it falls
  // through to the pages router for /admin/pages/*).
  app.use('/contact', require('../../src/routes/contact'));
  app.use('/donations', require('../../src/routes/donations'));
  app.use('/admin', require('../../src/routes/admin/dashboard'));
  app.use('/admin/pages', require('../../src/routes/admin/pages'));

  // Mirror the CSRF branch of the src/server.js error handler: a bad/missing
  // token becomes a 403, which is what the lane asserts on the negative path.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
      return res.status(403).json({
        success: false,
        message: 'Invalid CSRF token. Please refresh the page and try again.'
      });
    }
    return next(err);
  });

  return app;
}

/**
 * Read the CSRF token from the hidden body field the donation views emit
 * (`input[name="_csrf"]`) — the exact element the production client reads for
 * the body-field transport. Returns null when the field is absent (e.g. a
 * regression removed it), which drives the negative path.
 */
function readCsrfInput(html) {
  const match = /name="_csrf"\s+value="([^"]*)"/.exec(html);
  return match ? match[1] : null;
}

/**
 * Read the CSRF token from `meta[name="csrf-token"]` in the rendered layout —
 * the exact element the production client JS reads before resending it as a
 * `CSRF-Token` header. Returns null when the tag is absent.
 */
function readCsrfMeta(html) {
  const match = /<meta name="csrf-token" content="([^"]*)">/.exec(html);
  return match ? match[1] : null;
}

module.exports = { buildCsrfLaneApp, readCsrfInput, readCsrfMeta };
