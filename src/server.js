require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./utils/logger');
const metricsService = require('./services/metricsService');
const StreamingService = require('./services/StreamingService');
const EventService = require('./services/EventService');
const requestIdMiddleware = require('./middleware/requestIdMiddleware');
const errorHandler = require('./middleware/errorHandler');
const { startEmailQueueWorker } = require('./workers/emailQueueWorker');
const { startReminderWorker } = require('./workers/reminderWorker');

const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const jwt = require('jsonwebtoken');
const sessionTimeout = require('./middleware/sessionTimeout');

// Downstream resources + chat-socket teardown, used by graceful shutdown (U1)
// and the /ready deep-health probe (U3).
const db = require('./config/db');
const { pool } = db;
const redis = require('./config/redis');
const { closeAllConnections } = require('./services/chatSocketServer');
const { runPreflight } = require('./config/preflight');
const { acquireSingleProcessLock, releaseSingleProcessLock } = require('./config/singleProcessLock');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Error monitoring — no-ops unless SENTRY_DSN is set and not in test (see config/sentry.js)
const sentry = require('./config/sentry');
sentry.initSentry();

// Trust proxy (required for secure cookies and rate limiting behind Nginx).
// Pinned to 1 hop: a single reverse proxy (Nginx) sits in front per the deploy
// plan. Trusting *all* proxies (app.enable) lets clients spoof X-Forwarded-For
// to bypass the per-IP rate limiters. Bump to 2 if a CDN (e.g. Cloudflare) is
// added in front of Nginx.
app.set('trust proxy', 1);

// Start system metrics logging
if (process.env.NODE_ENV !== 'test') {
  metricsService.start();
}

// Worker stop handles, captured for graceful shutdown. Absent under
// NODE_ENV==='test' (workers aren't started), so shutdown no-ops on undefined.
let emailWorker;
let reminderWorker;

// Start the background workers. Called from the production boot path ONLY after
// the single-process advisory lock is held (R4/R5): a lock-less or lock-losing
// process must never register the hourly reminder repeatable job or the email
// consumer. The NODE_ENV!=='test' guards are retained (load-bearing) even though
// the sole call site is already gated on NODE_ENV!=='test'.
function startBackgroundWorkers() {
  if (process.env.NODE_ENV !== 'test' && process.env.EMAIL_WORKER_ENABLED !== 'false') {
    emailWorker = startEmailQueueWorker();
  }

  if (process.env.NODE_ENV !== 'test' && process.env.REMINDER_WORKER_ENABLED !== 'false') {
    reminderWorker = startReminderWorker();
  }
}

// Request ID middleware - must be first
app.use(requestIdMiddleware);

// HTTPS Redirection Middleware
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
  }
  next();
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Removed 'unsafe-inline' - check views for compatibility if broken
      scriptSrc: ["'self'", "https://js.hcaptcha.com", "https://*.hcaptcha.com"],
      styleSrc: ["'self'", "https://js.hcaptcha.com", "https://*.hcaptcha.com"],
      imgSrc: ["'self'", "data:", "https:", "https://*.hcaptcha.com"],
      connectSrc: ["'self'", "ws:", "wss:", "https://*.hcaptcha.com", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:"],
      frameSrc: ["'self'", "https://www.facebook.com", "https://www.youtube.com", "https://www.google.com", "https://js.hcaptcha.com", "https://*.hcaptcha.com"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
}));

// Request logging with Morgan and Winston - includes response time and request ID
// Format: REQUEST_ID METHOD URL STATUS RESPONSE_TIME
const morganFormat = ':req[x-request-id] :method :url :status :response-time ms';
app.use(morgan(morganFormat, {
  stream: logger.stream,
  skip: (req) => process.env.NODE_ENV === 'test'
}));

// Compression middleware
app.use(compression());

// Static files. A 1h max-age lets browsers cache assets without a revalidation
// round-trip each request (the default is max-age=0). Kept conservative — and
// without `immutable` — because filenames are not content-hashed, so ETag/
// Last-Modified must still revalidate stale CSS/JS after a deploy.
app.use(express.static(path.join(__dirname, '../public'), { maxAge: '1h' }));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Helper functions for views — event/stream times route through the one
// temple-timezone formatter (utils/templeTime) so every surface agrees.
const { formatEventDateTime, formatEventTime } = require('./utils/templeTime');
app.locals.formatEventDate = formatEventDateTime;
app.locals.formatEventTime = formatEventTime;

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CSRF Protection
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Apply CSRF protection to all routes that handle form submissions or state changes
// For simplicity, we can apply globally, but need to handle API clients if any.
// Since this is a browser-based app with cookie auth, strict CSRF is appropriate.
// Skip CSRF in test environment to simplify integration testing
const conditionalCsrf = (req, res, next) => {
  if (process.env.NODE_ENV === 'test') return next();
  // RFC 8058 one-click unsubscribe (POST /unsubscribe): mailbox providers POST
  // `List-Unsubscribe=One-Click` directly to the header URL with no browser,
  // cookies, or CSRF token. The endpoint is authenticated by the HMAC-signed
  // token in the query and only performs an idempotent opt-out, so CSRF adds no
  // protection here and would otherwise reject every one-click request.
  if (req.method === 'POST' && req.path === '/unsubscribe') return next();
  csrfProtection(req, res, next);
};

app.use(conditionalCsrf);

// Middleware to make csrfToken available to views
app.use((req, res, next) => {
  res.locals.csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : null;
  next();
});

// Global Session Tracking for Public Pages
// Verifies token without hitting the DB (for performance) and populates req.user
// so that sessionTimeout can track activity on every page load.
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret' : null);
app.use((req, res, next) => {
  const token = req.cookies && req.cookies.auth_token;
  if (token && !req.user) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        id: decoded.user_id,
        role: decoded.role,
        email: decoded.email,
        onboarding_complete: decoded.onboarding_complete || false
      };
    } catch (e) {
      // Ignore invalid tokens on public pages; requireAuth handles protected routes
    }
  }

  // Expose user and permission helpers to views globally
  res.locals.user = req.user || null;
  res.locals.hasPermission = (permission) => {
    const { hasPermission: hasPerm } = require('./config/roles-permissions');
    return hasPerm(req.user, permission);
  };
  res.locals.Permissions = require('./config/roles-permissions').Permissions;
  next();
});

// Apply session timeout tracking globally
app.use(sessionTimeout());

// Expose current path for active nav highlighting
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

// Global chrome context for the two-tier top bar (I9). Two cues live in the
// utility strip on every page: a live indicator (from the admin-asserted,
// time-bounded stream status) and this week's service time (the next `service`
// event). Both read existing data — no new liveness/scheduling mechanism — and
// degrade gracefully: a failure in either leaves the strip without that cue
// rather than breaking the render. GET-only, since page renders are GET and this
// keeps the two cached reads off POST/API traffic.
const formatServiceLabel = (service) => {
  if (!service || !service.date) return null;
  const date = service.date instanceof Date ? service.date : new Date(service.date);
  if (Number.isNaN(date.getTime())) return null;
  const opts = { weekday: 'short', hour: 'numeric', minute: '2-digit' };
  // Render in the congregation's timezone via APP_TIMEZONE_OFFSET (e.g. '-05:00') —
  // the same convention EventService/StreamingService parse with — so the label is
  // stable regardless of the server's TZ. Shift the instant by the offset and read
  // it as UTC to get that offset's wall-clock time; fall back to server-local when
  // no offset is configured.
  const offset = process.env.APP_TIMEZONE_OFFSET;
  let when;
  if (offset && /^[+-]\d{2}:\d{2}$/.test(offset)) {
    const sign = offset[0] === '-' ? -1 : 1;
    const [hours, minutes] = offset.slice(1).split(':').map(Number);
    const shifted = new Date(date.getTime() + sign * (hours * 60 + minutes) * 60000);
    when = shifted.toLocaleString('en-US', { ...opts, timeZone: 'UTC' });
  } else {
    when = date.toLocaleString('en-US', opts);
  }
  return service.title ? `${service.title} · ${when}` : when;
};

// Routes that never render the public two-tier chrome — skip the two chrome reads
// there. Admin/API pages don't show the live-now/service cues, JSON + liveness probes
// stay DB-free and fast (e.g. /health is liveness-only), and skipping keeps this
// middleware from consuming db responses that admin route handlers depend on.
const CHROME_SKIP_PREFIXES = ['/admin', '/api', '/health', '/ready', '/robots.txt', '/sitemap.xml'];
app.use(async (req, res, next) => {
  const chrome = { liveNow: false, watchUrl: '/watch', serviceTimes: null };
  const skip = req.method !== 'GET' ||
    CHROME_SKIP_PREFIXES.some((p) => req.path === p || req.path.startsWith(`${p}/`));
  if (!skip) {
    try {
      const [streamMeta, nextService] = await Promise.all([
        StreamingService.getPublicEmbedMetadata().catch(() => null),
        EventService.getNextService().catch(() => null)
      ]);
      chrome.liveNow = !!(streamMeta && streamMeta.status === 'live');
      chrome.serviceTimes = formatServiceLabel(nextService);
    } catch (err) {
      logger.warn('Global chrome context failed to resolve; rendering without live/times cues', {
        error: err && err.message
      });
    }
  }
  res.locals.chrome = chrome;
  next();
});

// Keep admin pages out of search indexes. The layout (Stream B, U7) reads
// res.locals.noindex once and emits <meta name="robots" content="noindex">.
// Admin pages gate via requireRbac.requireAnyRole (not the orphaned
// requireAdmin), so a server-level path check is the single injection point
// that doesn't collide with the admin controllers.
app.use((req, res, next) => {
  if (req.path.startsWith('/admin')) {
    res.locals.noindex = true;
  }
  next();
});

// Absolute site base URL for SEO/social tags (canonical, Open Graph, sitemap).
// Prefer an explicit env override; otherwise derive from the request.
const SITE_BASE_URL = process.env.SITE_URL || process.env.APP_BASE_URL || null;
const resolveBaseUrl = (req) =>
  SITE_BASE_URL || `${req.protocol}://${req.get('host')}`;
app.use((req, res, next) => {
  res.locals.baseUrl = resolveBaseUrl(req);
  next();
});

// Routes
const homeRoutes = require('./routes/home');
const aboutRoutes = require('./routes/about');
const contactRoutes = require('./routes/contact');
const adminPagesRoutes = require('./routes/admin/pages');
const adminStreamingRoutes = require('./routes/admin/streaming');
const adminCalendarRoutes = require('./routes/admin/calendar');
const adminDashboardRoutes = require('./routes/admin/dashboard');
const adminDirectoryRoutes = require('./routes/admin/directory');
const adminDonationRoutes = require('./routes/admin/donations');
const adminAnnouncementsRoutes = require('./routes/admin/announcements');
const adminMembersRoutes = require('./routes/admin/members');
const adminMessagesRoutes = require('./routes/admin/messages');
const pagesRoutes = require('./routes/pages');
const apiRoutes = require('./routes/api');
const recordingsRoutes = require('./routes/recordings');
const calendarRoutes = require('./routes/calendar');
const directoryRoutes = require('./routes/directory');
const donationRoutes = require('./routes/donations');
const watchRoutes = require('./routes/watch');
const streamsRoutes = require('./routes/streams');
const legalRoutes = require('./routes/legal');

app.use('/', homeRoutes);
app.use('/about', aboutRoutes);
app.use('/contact', contactRoutes);
app.use('/calendar', calendarRoutes);
app.use('/watch', watchRoutes);
app.use('/streams', streamsRoutes);
app.use('/', legalRoutes);
app.use('/', pagesRoutes);
app.use('/admin', adminDashboardRoutes);
app.use('/admin/pages', adminPagesRoutes);
app.use('/admin/streaming', adminStreamingRoutes);
app.use('/admin/calendar', adminCalendarRoutes);
app.use('/admin/directory', adminDirectoryRoutes);
app.use('/admin/donations', adminDonationRoutes);
app.use('/admin/announcements', adminAnnouncementsRoutes);
app.use('/admin/members', adminMembersRoutes);
app.use('/admin/messages', adminMessagesRoutes);
app.use('/api', apiRoutes);
app.use('/archive', recordingsRoutes);
app.use('/directory', directoryRoutes);
app.use('/donations', donationRoutes);

// Lightweight liveness probe for external uptime monitoring (FR67) — fast 200,
// no DB/render, so it reflects "the web process is up" without false negatives
// from downstream services.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Deep readiness probe for a load balancer / uptime monitor: reflects DB +
// Redis health (unlike /health, which is liveness-only). 200 when both are
// reachable, 503 with per-check status otherwise.
app.get('/ready', async (req, res) => {
  const checks = { db: 'ok', redis: 'ok' };

  const [dbResult, redisResult] = await Promise.allSettled([
    db.query('SELECT 1'),
    redis.ping()
  ]);

  if (dbResult.status === 'rejected') {
    checks.db = 'failed';
    logger.warn('Readiness check: DB unreachable', { error: dbResult.reason && dbResult.reason.message });
  }
  if (redisResult.status === 'rejected') {
    checks.redis = 'failed';
    logger.warn('Readiness check: Redis unreachable', { error: redisResult.reason && redisResult.reason.message });
  }

  const ready = checks.db === 'ok' && checks.redis === 'ok';
  res.status(ready ? 200 : 503).json(ready ? { status: 'ready', checks } : { status: 'degraded', checks });
});

// robots.txt — allow crawling and advertise the sitemap (absolute URL).
app.get('/robots.txt', (req, res) => {
  const base = resolveBaseUrl(req);
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
});

// sitemap.xml — main public pages, built with an absolute base URL.
const SITEMAP_PATHS = [
  '/',
  '/about',
  '/contact',
  '/calendar',
  '/watch',
  '/donations',
  '/privacy',
  '/terms',
  '/accessibility'
];
app.get('/sitemap.xml', (req, res) => {
  const base = resolveBaseUrl(req);
  const urls = SITEMAP_PATHS.map(
    (p) => `  <url><loc>${base}${p}</loc></url>`
  ).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  res.type('application/xml');
  res.send(xml);
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - Not Found - ${req.originalUrl} - ${req.ip}`);
  res.status(404).render('404', { title: '404 - Page Not Found', noindex: true });
});

// Sentry error handler — must run before the app error handler (no-op when disabled)
sentry.attachErrorHandler(app);

// Error handler — the single terminal Express error sink (see
// src/middleware/errorHandler.js): CSRF passthrough, central status/message
// mapping, full winston logging, and JSON/HTML content negotiation.
app.use(errorHandler);

// HTTP server + chat WebSocket server handles, captured at module scope so the
// exported shutdown() can drain and close them. Populated only when this module
// is the entrypoint (real server); left undefined under tests (which inject
// mock handles via _setShutdownHandles).
let server;
let wss;

const SHUTDOWN_TIMEOUT_MS = 10000;
let shuttingDown = false;

/**
 * Graceful shutdown (drain-first), per KTD7. Directly callable by tests.
 *
 * Sequence: await server.close()'s drain → detach the upgrade listener +
 * wss.close() (stop new upgrades) → closeAllConnections() (close live client
 * sockets) → pool.end() → redis.quit() → worker stop() handles. Each step
 * tolerates an absent handle (test mode / not-yet-listening). Races a non-unref
 * process.exit timeout so a hung close can't wedge a deploy.
 *
 * Idempotent against duplicate SIGTERM/SIGINT (the shuttingDown guard); the
 * crash path (U2) does not rely on this guard and arms its own force-exit first.
 *
 * @param {string} signal - the originating signal/cause, for logging.
 * @returns {Promise<void>}
 */
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown`);

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    // 1. Stop accepting new HTTP requests; await the drain of in-flight ones.
    if (server) {
      await new Promise((resolve) => server.close(() => resolve()));
    }

    // 2. Stop new WS upgrades, then close the upgrade-handling server.
    if (server && typeof server.removeAllListeners === 'function') {
      server.removeAllListeners('upgrade');
    }
    if (wss && typeof wss.close === 'function') {
      await new Promise((resolve) => wss.close(() => resolve()));
    }

    // 3. Close live client sockets (existing chat-socket export).
    closeAllConnections();

    // 4. Release the single-process advisory lock so the next deploy can
    //    acquire it (R8), then tear down downstream resources only after
    //    requests have drained. pool.end() closes the lock session as a backstop.
    await releaseSingleProcessLock();
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
    if (redis && typeof redis.quit === 'function') {
      await redis.quit();
    }

    // 5. Stop background workers (absent in test mode → skip).
    if (emailWorker && typeof emailWorker.stop === 'function') {
      await emailWorker.stop();
    }
    if (reminderWorker && typeof reminderWorker.stop === 'function') {
      await reminderWorker.stop();
    }

    logger.info('Graceful shutdown complete');
    clearTimeout(forceExit);
  } catch (err) {
    logger.error('Error during graceful shutdown', { error: err && err.message, stack: err && err.stack });
    clearTimeout(forceExit);
    throw err;
  }
}

/**
 * Test seam (mirrors the _reset/_inject convention elsewhere in src/): inject
 * mock runtime handles so the exported shutdown() can be exercised without
 * binding a real port or starting real workers. Returns the previous handles.
 */
function _setShutdownHandles(handles = {}) {
  ({ server, wss, emailWorker, reminderWorker } = {
    server: handles.server,
    wss: handles.wss,
    emailWorker: handles.emailWorker,
    reminderWorker: handles.reminderWorker
  });
  if (Object.prototype.hasOwnProperty.call(handles, 'shuttingDown')) {
    shuttingDown = handles.shuttingDown;
  }
}

/**
 * uncaughtException handler (KTD8). The process is in an undefined state, so:
 * arm a non-unref force-process.exit(1) FIRST (the shutdown itself may throw or
 * hang post-crash), then attempt the graceful shutdown as a best-effort drain.
 * Reported through the sentry passthrough (no-op when disabled). Exported for
 * direct unit testing (signal/handler registration is suppressed in test).
 */
function handleUncaughtException(err) {
  logger.error('Uncaught exception', { error: err && err.message, stack: err && err.stack });
  sentry.captureException(err);
  // Force exit even if shutdown rejects or hangs after a crash.
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
  Promise.resolve()
    .then(() => shutdown('uncaughtException'))
    .catch(() => { /* force-exit timeout already armed above */ });
}

/**
 * unhandledRejection handler (KTD8). Log + report, but do not force-exit — an
 * escaped rejection is recoverable and a hard exit here would be more disruptive
 * than the observability win. Exported for direct unit testing.
 */
function handleUnhandledRejection(reason) {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('Unhandled rejection', { error: err.message, stack: err.stack });
  sentry.captureException(err);
}

// Start server
if (process.env.NODE_ENV !== 'test' && require.main === module) {
  // Fail-closed boot preflight: in production, refuse to start on any
  // security-tier misconfiguration (exits non-zero) and warn on content-tier
  // ones. Inert in dev (guarded by NODE_ENV === 'production' inside).
  runPreflight();

  // Enforce the single-process invariant (R1–R5): acquire the boot advisory lock
  // BEFORE starting workers or binding the port. Inert unless production (see
  // config/singleProcessLock.js). A second process that cannot acquire the lock
  // logs a fatal line and exits non-zero inside acquireSingleProcessLock(), so it
  // never reaches worker startup or the listener bind below.
  acquireSingleProcessLock()
    .then(() => {
      // Workers start only after the lock is held (R4).
      startBackgroundWorkers();

      server = app.listen(PORT, HOST, () => {
        logger.info(`✅ Server running at http://${HOST}:${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      });
      const { initChatSocketServer } = require('./services/chatSocketServer');
      wss = initChatSocketServer(server);

      const onSignal = (signal) => {
        shutdown(signal)
          .then(() => process.exit(0))
          .catch((err) => {
            logger.error('Graceful shutdown failed', { error: err && err.message });
            process.exit(1);
          });
      };
      process.on('SIGTERM', () => onSignal('SIGTERM'));
      process.on('SIGINT', () => onSignal('SIGINT'));
      process.on('uncaughtException', handleUncaughtException);
      process.on('unhandledRejection', handleUnhandledRejection);
    })
    .catch((err) => {
      logger.error('Single-process lock acquisition failed unexpectedly; refusing to start.', {
        error: err && err.message,
      });
      process.exit(1);
    });
}

module.exports = app;
module.exports.shutdown = shutdown;
module.exports.handleUncaughtException = handleUncaughtException;
module.exports.handleUnhandledRejection = handleUnhandledRejection;
module.exports._setShutdownHandles = _setShutdownHandles;
