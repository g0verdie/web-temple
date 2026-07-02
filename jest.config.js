module.exports = {
  testEnvironment: 'node',
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
