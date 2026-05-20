/**
 * ENGAGEMENT SERVICE - Public API
 */

// Service
export { 
  EngagementService,
  engagementService,
} from './engagement-service';

export type {
  CreateEngagementInput,
  PaginationOptions,
  PaginatedResult,
  ActivityLogEntry,
  ModuleActivationResult,
  FundingSummary,
} from './engagement-service';

// Hooks
export {
  useEngagement,
  useEngagementWithEntities,
  useEngagements,
  useMyEngagements,
  useEngagementMutations,
  useTeamManagement,
  useModuleManagement,
  useEngagementSearch,
  useEngagementActivity,
} from './engagement-hooks';
