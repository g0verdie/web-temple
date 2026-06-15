require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./utils/logger');
const metricsService = require('./services/metricsService');
const requestIdMiddleware = require('./middleware/requestIdMiddleware');
const { startEmailQueueWorker } = require('./workers/emailQueueWorker');
const { startReminderWorker } = require('./workers/reminderWorker');

const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const jwt = require('jsonwebtoken');
const sessionTimeout = require('./middleware/sessionTimeout');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Trust proxy (required for secure cookies and rate limiting behind Nginx)
app.enable('trust proxy');

// Start system metrics logging
if (process.env.NODE_ENV !== 'test') {
  metricsService.start();
}

if (process.env.NODE_ENV !== 'test' && process.env.EMAIL_WORKER_ENABLED !== 'false') {
  startEmailQueueWorker();
}

if (process.env.NODE_ENV !== 'test' && process.env.REMINDER_WORKER_ENABLED !== 'false') {
  startReminderWorker();
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

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Helper functions for views
app.locals.formatEventDate = (date) => {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  };
  return date.toLocaleDateString('en-US', options);
};

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
const adminRecordingsRoutes = require('./routes/admin/recordings');
const adminStreamingRoutes = require('./routes/admin/streaming');
const adminCalendarRoutes = require('./routes/admin/calendar');
const adminDashboardRoutes = require('./routes/admin/dashboard');
const adminDirectoryRoutes = require('./routes/admin/directory');
const adminDonationRoutes = require('./routes/admin/donations');
const adminAnnouncementsRoutes = require('./routes/admin/announcements');
const pagesRoutes = require('./routes/pages');
const apiRoutes = require('./routes/api');
const recordingsRoutes = require('./routes/recordings');
const calendarRoutes = require('./routes/calendar');
const directoryRoutes = require('./routes/directory');
const donationRoutes = require('./routes/donations');
const watchRoutes = require('./routes/watch');
const legalRoutes = require('./routes/legal');

app.use('/', homeRoutes);
app.use('/about', aboutRoutes);
app.use('/contact', contactRoutes);
app.use('/calendar', calendarRoutes);
app.use('/watch', watchRoutes);
app.use('/', legalRoutes);
app.use('/', pagesRoutes);
app.use('/admin', adminDashboardRoutes);
app.use('/admin/pages', adminPagesRoutes);
app.use('/admin/recordings', adminRecordingsRoutes);
app.use('/admin/streaming', adminStreamingRoutes);
app.use('/admin/calendar', adminCalendarRoutes);
app.use('/admin/directory', adminDirectoryRoutes);
app.use('/admin/donations', adminDonationRoutes);
app.use('/admin/announcements', adminAnnouncementsRoutes);
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
  '/archive',
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
  res.status(404).render('404', { title: '404 - Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  // Handle CSRF token errors
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token. Please refresh the page and try again.'
    });
  }

  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, { stack: err.stack });
  res.status(500).render('error', {
    title: '500 - Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// Start server
if (require.main === module) {
  const server = app.listen(PORT, HOST, () => {
    logger.info(`✅ Server running at http://${HOST}:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
  const { initChatSocketServer } = require('./services/chatSocketServer');
  initChatSocketServer(server);
}

module.exports = app;
