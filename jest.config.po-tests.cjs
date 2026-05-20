/**
 * Jest Configuration for Purchase Order Enhancement Tests
 *
 * Specialized configuration for running PO enhancement test suite
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/src/subsidiaries/advisory/**/services/__tests__/**/*.test.ts',
    '**/src/subsidiaries/advisory/**/services/__tests__/po-*.test.ts',
    '**/src/subsidiaries/advisory/**/services/__tests__/accountability-*.test.ts',
    '**/src/subsidiaries/advisory/**/services/__tests__/auto-*.test.ts'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/subsidiaries/advisory/matflow/services/procurement-service.ts',
    'src/subsidiaries/advisory/matflow/services/requisition-service.ts',
    'src/subsidiaries/advisory/matflow/services/auto-po-generation.service.ts',
    'src/subsidiaries/advisory/delivery/core/services/enhanced-accountability.service.ts'
  ],

  coverageThresholds: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  coverageReporters: ['text', 'lcov', 'html'],

  // Module path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@subsidiaries/(.*)$': '<rootDir>/src/subsidiaries/$1',
    '^@matflow/(.*)$': '<rootDir>/src/subsidiaries/advisory/matflow/$1',
    '^@delivery/(.*)$': '<rootDir>/src/subsidiaries/advisory/delivery/$1'
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },

  // Timeout for async operations (Firestore can be slow)
  testTimeout: 15000,

  // Verbose output for debugging
  verbose: true,

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.next/'
  ],

  // Global setup/teardown
  globalSetup: '<rootDir>/jest.global-setup.ts',
  globalTeardown: '<rootDir>/jest.global-teardown.ts',

  // Concurrent test execution
  maxWorkers: '50%',

  // Reporter configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'po-enhancement-results.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ]
};
