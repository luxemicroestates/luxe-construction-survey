/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['calculations.js'],
  coverageThreshold: {
    global: {
      lines: 90,
      functions: 100
    }
  }
};
