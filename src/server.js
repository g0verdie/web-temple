require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./utils/logger');
const metricsService = require('./services/metricsService');
const requestIdMiddleware = require('./middleware/requestIdMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Trust proxy (required for secure cookies and rate limiting behind Nginx)
app.enable('trust proxy');

// Start system metrics logging
if (process.env.NODE_ENV !== 'test') {
  metricsService.start();
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
      connectSrc: ["'self'", "https://*.hcaptcha.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https://www.facebook.com", "https://www.youtube.com", "https://js.hcaptcha.com", "https://*.hcaptcha.com"],
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

// Routes
const homeRoutes = require('./routes/home');
const aboutRoutes = require('./routes/about');
const contactRoutes = require('./routes/contact');
const adminPagesRoutes = require('./routes/admin/pages');
const adminDashboardRoutes = require('./routes/admin/dashboard');
const apiRoutes = require('./routes/api');

app.use('/', homeRoutes);
app.use('/about', aboutRoutes);
app.use('/contact', contactRoutes);
app.use('/admin', adminDashboardRoutes);
app.use('/admin/pages', adminPagesRoutes);
app.use('/api', apiRoutes);

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - Not Found - ${req.originalUrl} - ${req.ip}`);
  res.status(404).render('404', { title: '404 - Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, { stack: err.stack });
  res.status(500).render('error', {
    title: '500 - Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, HOST, () => {
    logger.info(`✅ Server running at http://${HOST}:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
