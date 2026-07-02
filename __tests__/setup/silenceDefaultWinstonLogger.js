// Test-only setup, run once per test file BEFORE the file's own requires.
//
// 1) Force NODE_ENV back to 'test' at the start of every file.
//    src/config/redis.js decides at module-eval time whether to build the mock
//    EventEmitter (NODE_ENV==='test') or a REAL ioredis client. Some suites flip
//    process.env.NODE_ENV to 'production'/'development' for their own assertions;
//    if that value bleeds into the next file in the same worker, a server-booting
//    suite that does NOT inline-mock config/redis evaluates redis.js under the
//    wrong env and opens a REAL ioredis socket to localhost:6379. That socket is a
//    leaked open handle ("worker failed to exit gracefully") and its 'connect'
//    handler logs via the transportless default winston asynchronously — landing
//    after the triggering file tears down as "Cannot log after tests are done",
//    which crashes an innocent in-flight supertest request ("socket hang up" /
//    "Parse Error: Expected HTTP/"). Resetting here (setupFiles runs before the
//    file is required) guarantees redis.js always takes the in-memory mock branch.
process.env.NODE_ENV = 'test';

// 2) Silence winston's DEFAULT logger.
//    CacheService and src/config/redis log through the default winston logger
//    (require('winston').debug/.error), which has no transports configured. Every
//    such call makes winston schedule an async console.error:
//      "[winston] Attempt to write logs with no transports ...".
//    The global "chrome" middleware (src/server.js) exercises CacheService on
//    every public-page render, so that async write can land after the triggering
//    test file has torn down and leak the same way as above. Giving the default
//    logger a single silent transport makes that path a no-op. Production logging
//    goes through src/utils/logger (a separate winston instance) and is untouched.
const winston = require('winston');
winston.configure({
  silent: true,
  transports: [new winston.transports.Console({ silent: true })]
});
