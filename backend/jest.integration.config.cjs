/** @type {import('ts-jest').JestConfigWithTsJest} */
const base = require('./jest.config.cjs');

// Integration tests talk to a real Postgres, so they are a separate run from the unit
// suite: `npm test` stays database-free and `npm run test:integration` opts in.
module.exports = {
  ...base,
  roots: ['<rootDir>/tests/integration'],
  testPathIgnorePatterns: [],
  testTimeout: 30_000,
};
