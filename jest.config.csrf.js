/**
 * Dedicated Jest config for the CSRF-on critical-path test lane.
 *
 * Runs ONLY the CSRF-enforced tests under __tests__/csrf-lane/, which boot a
 * separate app instance with real csurf (see __tests__/csrf-lane/csrfLaneApp.js).
 * It is deliberately kept out of the default `npm test` run (jest.config.js
 * ignores the same directory), so the load-bearing NODE_ENV==='test' CSRF bypass
 * and the default suite/coverage thresholds are untouched.
 *
 * Run with: npm run test:csrf
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/csrf-lane/**/*.test.js']
};
