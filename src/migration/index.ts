/**
 * Migration Module
 * Data migration strategy for v5 to v6 architecture
 * 
 * This module provides:
 * - Migration scripts for all entity types (programs, projects, payments, deals)
 * - Data validation and integrity checking
 * - Transformation utilities for schema changes
 * - Rollback procedures and backup management
 * - Migration monitoring dashboard
 * 
 * Usage:
 * ```typescript
 * import { migratePrograms, migrateProjects } from '@/migration';
 * 
 * // Dry run first
 * const result = await migratePrograms({ dryRun: true });
 * 
 * // Then run for real
 * const result = await migratePrograms({ dryRun: false, createBackup: true });
 * ```
 */

// Types
export * from './types/migration-types';

// Utils
export * from './utils';

// Validators
export * from './validators';

// Transformers
export * from './transformers';

// Migration Scripts
export * from './scripts';

// Monitor Components
export * from './monitor';
