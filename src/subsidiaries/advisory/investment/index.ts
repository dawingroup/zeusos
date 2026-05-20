/**
 * Investment Module - Barrel export
 * 
 * Infrastructure investment deal management including:
 * - Deal lifecycle tracking
 * - Pipeline management
 * - Due diligence integration
 * - Cross-module linking to Delivery
 */

// Types
export * from './types';

// Services
export { DealService, dealService, getDealService } from './services/deal-service';
export type { DealFilters, PipelineSummary, StageGateStatus } from './services/deal-service';
export { PipelineService, pipelineService, getPipelineService } from './services/pipeline-service';

// Hooks - Deal
export {
  useDeal,
  useEngagementDeals,
  usePipeline,
  usePipelineSummary,
  useDealsSearch,
  useCreateDeal,
  useUpdateDeal,
  useStageTransition,
  useDealTeam,
  useDealActivity,
  useDealLinks,
} from './hooks/deal-hooks';

// Hooks - Pipeline
export {
  usePipelineKanban,
  usePipelineStats,
  useStageConfigs,
  useStageTransitionRequest,
  usePendingApprovals,
  usePipelineViews,
  useUserPipelinePreferences,
} from './hooks/pipeline-hooks';

// Services - Due Diligence
export { DueDiligenceService, dueDiligenceService, getDueDiligenceService } from './services/due-diligence-service';

// Hooks - Due Diligence
export {
  useDueDiligence,
  useDealDueDiligence,
  useInitializeDueDiligence,
  useUpdateDDStatus,
  useWorkstreams,
  useWorkstream,
  useTasks,
  useFindings,
  useDDSummary,
  useDDSignOff,
} from './hooks/due-diligence-hooks';

// Services - Financial Models
export { FinancialModelService, financialModelService, getFinancialModelService } from './services/financial-model-service';

// Hooks - Financial Models
export {
  useFinancialModel,
  useDealModels,
  useLatestApprovedModel,
  useCreateFinancialModel,
  useUpdateFinancialModel,
  useCreateModelVersion,
  useSubmitModelForApproval,
  useApproveModel,
  useCreateScenario,
  useRunSensitivityAnalysis,
  useLiveModelCalculations,
  useScenarioComparison,
  useFormattedMetrics,
} from './hooks/financial-model-hooks';

// Services - Deal-Project Sync
export { DealProjectSyncService, dealProjectSyncService, getDealProjectSyncService } from './services/deal-project-sync-service';

// Components - Cross-Module
export { LinkedProjectCard } from './components/LinkedProjectCard';
export { CreateProjectFromDealModal } from './components/CreateProjectFromDealModal';

// Components - Dashboard
export { 
  PipelineSummary as PipelineSummaryCard, 
  DealsFunnel, 
  InvestmentMetrics, 
  RecentActivity 
} from './components/dashboard';

// Components - Pipeline
export { KanbanBoard, KanbanColumn, DealCard, PipelineFilters } from './components/pipeline';

// Components - Deals
export { DealHeader, DealOverview } from './components/deals';

// Components - Due Diligence
export { DDProgressRing } from './components/due-diligence';

// Components - Financial
export { ReturnMetricsCard } from './components/financial';

// Pages
export { InvestmentDashboard } from './pages/InvestmentDashboard';
export { PipelineKanban } from './pages/PipelineKanban';
export { DealDetail } from './pages/DealDetail';

// Routes
export { investmentRoutes } from './routes';

// Utils
export {
  calculateDealVelocity,
  calculateStageAging,
  isOverdueInStage,
  calculateFunnelConversion,
  calculateWeightedPipelineValue,
  groupDealsByPeriod,
  calculateExpectedClosesByMonth,
  formatCurrency,
  formatLargeNumber,
  calculateAverageDealSize,
  getDealsAtRisk,
  calculateStageDistribution,
  getTopDealsByValue,
  calculateWinRateBySector,
} from './utils/pipeline-analytics';

// Firebase configuration
export { COLLECTION_PATHS, CONFIG_DOCS } from './firebase/deal-collections';
