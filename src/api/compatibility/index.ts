/**
 * API Compatibility Layer
 * Backward-compatible API layer for v5 to v6 migration
 *
 * This module provides:
 * - Request/response transformers between v5 and v6 formats
 * - API adapters for legacy endpoint compatibility
 * - Version routing and detection
 * - Deprecation logging and tracking
 *
 * Usage:
 * ```typescript
 * import { createProgramAdapter, ResponseTransformer } from '@/api/compatibility';
 *
 * // Use adapter for legacy v5 operations
 * const adapter = createProgramAdapter('v5');
 * const programs = await adapter.listPrograms({ status: 'Active' });
 *
 * // Transform v6 response to v5 format
 * const v5Response = ResponseTransformer.transformResponse(
 *   v6Data,
 *   'program',
 *   'v5',
 *   'v6'
 * );
 * ```
 */

// Types
export * from './types/api-compat-types';

// Utils
export * from './utils';

// Transformers
export * from './transformers';

// Middleware
export * from './middleware';

// Adapters
export * from './adapters';
