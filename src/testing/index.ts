/**
 * Testing Module
 * Comprehensive testing framework for v5 to v6 migration
 *
 * This module provides:
 * - Test configuration and environment management
 * - Test data factories for all entity types
 * - Migration dry-run executor with validation
 * - Performance benchmarks and thresholds
 * - UAT test cases and execution framework
 *
 * Usage:
 * ```typescript
 * import {
 *   testEnvManager,
 *   TestDataFactory,
 *   DryRunExecutor,
 *   UATExecutor,
 *   validatePerformance
 * } from '@/testing';
 *
 * // Initialize test environment
 * await testEnvManager.initialize();
 *
 * // Create test data
 * const engagement = TestDataFactory.createEngagement({ type: 'infrastructure' });
 *
 * // Run migration dry-run
 * const executor = new DryRunExecutor(db, { sampleSize: 100 });
 * const result = await executor.executeDryRun();
 *
 * // Execute UAT
 * const uatExecutor = new UATExecutor();
 * const execution = await uatExecutor.startExecution('UAT-ENG-001', 'user-id', 'staging');
 * ```
 */

// Configuration
export * from './config';

// Utils
export * from './utils';

// Factories
export * from './factories';

// Migration Testing
export * from './migration';

// Performance Testing
export * from './performance';

// UAT Testing
export * from './uat';

// DawinOS v2.0 Testing Framework
export * from './seeders/testDataSeeder';
export * from './hooks/useTestRunner';
export * from './hooks/usePerformanceMetrics';
