/**
 * Shared Module - Cross-Module Integration
 */

// Types
export * from './types/cross-module-link';

// Services
export { CrossModuleService, crossModuleService, getCrossModuleService } from './services/cross-module-service';

// Hooks
export {
  useEntityLinks,
  useDealProjectLink,
  useLinkSubscription,
  useCreateLink,
  useSyncLink,
  useCreateProjectFromDeal,
  useConstructionSummary,
  useSyncDealWithProject,
  useCrossModuleDashboard,
  useAcknowledgeAlert,
  useHasLinkedProject,
  useLinkedEntityData,
  useBatchSync,
} from './hooks/cross-module-hooks';
