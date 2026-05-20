/**
 * Integration Tests Index
 * Export integration test utilities
 */

// Test files are loaded directly by vitest
// This file provides any shared utilities for integration tests

export const integrationTestConfig = {
  timeout: 60000,
  retries: 2,
  concurrent: false,
};
