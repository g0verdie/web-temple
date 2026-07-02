module.exports = {
  testEnvironment: 'node',
  // Per-file guard: pin NODE_ENV='test' (so config/redis never opens a real ioredis
  // socket from a bled-over env) and silence winston's default logger, so neither a
  // leaked connection nor an async "no transports" console.error can leak past a
  // test file's teardown and crash an innocent suite. See the setup file for detail.
  setupFiles: ['<rootDir>/__tests__/setup/silenceDefaultWinstonLogger.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!**/node_modules/**'
  ],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  // The CSRF-on lane (__tests__/csrf-lane/) is a separate, opt-in suite that boots
  // an app with real csurf enforced. It must NOT join the default run — that would
  // defeat the point of an isolated lane — so it is excluded here and invoked via
  // its own config (jest.config.csrf.js / `npm run test:csrf`).
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/__tests__/csrf-lane/'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  }
};
