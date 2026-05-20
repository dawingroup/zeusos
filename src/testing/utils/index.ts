/**
 * Test Utils Index
 * Export all test utilities
 */

export {
  TestEnvironmentManager,
  testEnvManager,
  waitFor,
  delay,
  generateTestId,
  assertRejects,
  assertSucceeds,
} from './test-environment';
export type { TestContext } from './test-environment';

// Phase 8.3 utilities
export { render, userEvent, AuthContext, SubsidiaryContext } from './render';
export {
  expectValidTimestamp,
  expectFirestoreDoc,
  expectPaginatedResult,
  expectUgandaCompliance,
} from './assertions';
