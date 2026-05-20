/**
 * Cutlist Processor Hooks
 * Custom React hooks for the cutlist processor module
 *
 * Re-exports from existing hooks during migration
 */

// Cutlist Aggregation hook (from design-manager)
export { useCutlistAggregation } from '@/modules/design-manager/hooks/useCutlistAggregation';

// Context hooks are re-exported from context/index.ts:
// - useConfig (from ConfigContext)
// - useOffcuts (from OffcutContext)
// - useWorkInstance (from WorkInstanceContext)
