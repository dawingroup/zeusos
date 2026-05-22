/**
 * Campaigns module — Zeus Group core operations.
 *
 * Public re-exports for consumers (router, navigation, page guards).
 */

export type {
  Campaign,
  CampaignOrLegacyProject,
  CampaignStatus,
  CampaignBudget,
  Brief,
  BriefKPI,
  IMCTeamMember,
  PerformanceReview,
  PerformanceMetric,
  PerformanceMetricUnit,
  StageTransition,
} from './types/campaign.types';

export {
  CAMPAIGN_STAGES,
  CAMPAIGN_STAGE_INDEX,
  CAMPAIGN_STAGE_META,
  getStageIndex,
  getStageLabel,
} from './constants/stages';
export type { CampaignStage, StageMeta } from './constants/stages';

export {
  BRIEF_TIERS,
  computeExpectedRevertBy,
  computeExpectedFeedbackBy,
  getSLAStatus,
} from './constants/tiers';
export type { BriefTier, TierDefinition } from './constants/tiers';

export {
  IMC_STREAMS,
  SERVICE_LINES,
  SERVICE_LINE_META,
  getServiceLineLabel,
} from './constants/service-lines';
export type { IMCStream, ServiceLine, ServiceLineMeta } from './constants/service-lines';
