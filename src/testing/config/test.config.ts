/**
 * Test Configuration
 * Configuration for testing environments and settings
 */

export interface TestConfig {
  projectId: string;
  emulatorHost: string;
  emulatorPorts: {
    firestore: number;
    auth: number;
    functions: number;
    storage: number;
  };
  testTimeout: number;
  retryAttempts: number;
  parallelTests: boolean;
  coverageEnabled: boolean;
}

export const testConfig: TestConfig = {
  projectId: 'dawin-test-' + Date.now(),
  emulatorHost: 'localhost',
  emulatorPorts: {
    firestore: 8080,
    auth: 9099,
    functions: 5001,
    storage: 9199,
  },
  testTimeout: 30000,
  retryAttempts: 3,
  parallelTests: true,
  coverageEnabled: true,
};

export const testEnvironments = {
  unit: {
    ...testConfig,
    parallelTests: true,
    testTimeout: 5000,
  },
  integration: {
    ...testConfig,
    parallelTests: false,
    testTimeout: 30000,
  },
  e2e: {
    ...testConfig,
    parallelTests: false,
    testTimeout: 60000,
  },
  migration: {
    ...testConfig,
    parallelTests: false,
    testTimeout: 300000, // 5 minutes for large migrations
  },
};

export type TestEnvironment = keyof typeof testEnvironments;

/**
 * Get configuration for specific test environment
 */
export function getTestConfig(environment: TestEnvironment): TestConfig {
  return testEnvironments[environment];
}

/**
 * Firebase emulator connection strings
 */
export const emulatorConnections = {
  firestore: `${testConfig.emulatorHost}:${testConfig.emulatorPorts.firestore}`,
  auth: `${testConfig.emulatorHost}:${testConfig.emulatorPorts.auth}`,
  functions: `${testConfig.emulatorHost}:${testConfig.emulatorPorts.functions}`,
  storage: `${testConfig.emulatorHost}:${testConfig.emulatorPorts.storage}`,
};

/**
 * Test database collections
 */
export const testCollections = {
  clients: 'clients',
  engagements: 'engagements',
  projects: 'v6_projects',
  payments: 'v6_payments',
  deals: 'deals',
  portfolios: 'portfolios',
  boqs: 'boqs',
  migrationJobs: 'migrationJobs',
  migrationMappings: 'migrationMappings',
  // V5 collections (source)
  v5Programs: 'programs',
  v5Projects: 'projects',
  v5Payments: 'payments',
  v5Ipcs: 'ipcs',
  v5Requisitions: 'requisitions',
};

/**
 * Coverage thresholds
 */
export const coverageThresholds = {
  statements: 80,
  branches: 75,
  functions: 80,
  lines: 80,
};
