/**
 * Advisory Client Module - Barrel Export
 */

// Types
export * from './types';

// Services
export {
  createClient,
  getClient,
  updateClient,
  getClients,
  updateClientStatus,
  updateKYCStatus,
  updateAMLStatus,
  raiseComplianceIssue,
  createMandate,
  getMandate,
  getClientMandates,
  updateMandateStatus,
  createRiskAssessment,
  getRiskAssessmentHistory,
  addClientContact,
  updateClientContact,
  removeClientContact,
  subscribeToClient,
  subscribeToClients
} from './services/client-service';

// Hooks
export {
  clientKeys,
  useClient,
  useClients,
  useClientSubscription,
  useClientsSubscription,
  useCreateClient,
  useUpdateClient,
  useUpdateClientStatus,
  useUpdateKYCStatus,
  useUpdateAMLStatus,
  useRaiseComplianceIssue,
  useMandate,
  useClientMandates,
  useCreateMandate,
  useUpdateMandateStatus,
  useRiskAssessmentHistory,
  useCreateRiskAssessment,
  useAddClientContact,
  useUpdateClientContact,
  useRemoveClientContact,
  useClientComplianceStatus,
  useClientInvestmentSummary,
  useClientSuitability
} from './hooks/client-hooks';

// Portfolio Services
export {
  createPortfolio,
  getPortfolio,
  updatePortfolio,
  deletePortfolio,
  updatePortfolioStatus,
  calculateNAV,
  updateNAV,
  getNAVHistory,
  finalizeNAV,
  setStrategicAllocation,
  analyzeAllocation,
  createCapitalTransaction,
  processCapitalTransaction,
  getCapitalTransactions,
  updateCashPosition,
  createCashForecast,
  manageBankAccount,
  getPortfoliosByClient,
  getPortfoliosByEngagement,
  getActivePortfolios,
  getPortfolioSummaries,
  subscribeToPortfolio,
  subscribeToClientPortfolios,
  subscribeToNAVHistory
} from './services/portfolio-service';

// Portfolio Hooks
export {
  portfolioKeys,
  usePortfolio,
  usePortfoliosByClient,
  usePortfoliosByEngagement,
  useActivePortfolios,
  usePortfolioSummaries,
  useCreatePortfolio,
  useUpdatePortfolio,
  useDeletePortfolio,
  useUpdatePortfolioStatus,
  usePortfolioSubscription,
  useClientPortfoliosSubscription,
  useCalculateNAV,
  useNAVHistory,
  useNAVHistorySubscription,
  useUpdateNAV,
  useFinalizeNAV,
  useAllocationAnalysis,
  useSetStrategicAllocation,
  useCapitalTransactions,
  useCreateCapitalTransaction,
  useProcessCapitalTransaction,
  useUpdateCashPosition,
  useCreateCashForecast,
  useManageBankAccount,
  usePortfolioMetrics,
  usePortfolioPerformance,
  usePortfolioCompliance,
  usePortfolioCapitalSummary
} from './hooks/portfolio-hooks';

// Firebase
export {
  CLIENT_COLLECTIONS,
  CLIENT_INDEXES,
  CLIENT_SECURITY_RULES
} from './firebase/client-collections';

export {
  PORTFOLIO_COLLECTIONS,
  PORTFOLIO_INDEXES,
  PORTFOLIO_SECURITY_RULES,
  PORTFOLIO_VALIDATION
} from './firebase/portfolio-collections';

// Holding Services
export {
  createHolding,
  getHolding,
  updateHolding,
  deleteHolding,
  updateHoldingStatus,
  createTransaction,
  processTransaction,
  getTransactions,
  updateValuation,
  getValuationHistory,
  approveValuation,
  recordIncome,
  processIncome,
  getIncomeHistory,
  getHoldingsByPortfolio,
  getHoldingsByDeal,
  getActiveHoldings,
  getHoldingSummaries,
  subscribeToHolding,
  subscribeToPortfolioHoldings,
  subscribeToValuationHistory
} from './services/holding-service';

// Holding Hooks
export {
  holdingKeys,
  useHolding,
  useHoldingsByPortfolio,
  useHoldingsByDeal,
  useActiveHoldings,
  useHoldingSummaries,
  useCreateHolding,
  useUpdateHolding,
  useDeleteHolding,
  useUpdateHoldingStatus,
  useHoldingSubscription,
  usePortfolioHoldingsSubscription,
  useTransactions,
  useCreateTransaction,
  useProcessTransaction,
  useValuationHistory,
  useValuationHistorySubscription,
  useUpdateValuation,
  useApproveValuation,
  useIncomeHistory,
  useRecordIncome,
  useProcessIncome,
  useHoldingMetrics,
  useHoldingPerformance,
  useHoldingRisk,
  usePortfolioHoldingsSummary,
  useHoldingESG
} from './hooks/holding-hooks';

export {
  HOLDING_COLLECTIONS,
  HOLDING_INDEXES,
  HOLDING_SECURITY_RULES,
  HOLDING_VALIDATION
} from './firebase/holding-collections';

// Performance Services
export {
  calculateIrr,
  calculateTwr,
  calculateTrueTwr,
  calculateRiskAdjustedReturns,
  calculateReturnMetrics,
  createPerformanceSnapshot,
  getPerformanceSnapshot,
  getPerformanceSnapshots,
  createBenchmark,
  getBenchmark,
  getBenchmarks,
  updateBenchmarkData,
  assignBenchmark,
  getBenchmarkAssignments,
  calculatePme,
  getPeerUniverse,
  getPeerUniverses,
  calculatePeerRanking,
  calculateJCurve,
  calculateAttribution,
  getAttribution,
  subscribeToPerformanceSnapshot,
  subscribeToPortfolioPerformance,
  subscribeToPeerRankings
} from './services/performance-service';

// Performance Hooks
export {
  performanceKeys,
  useReturnMetrics,
  useRiskAdjustedReturns,
  useIrrCalculation,
  useTwrCalculation,
  usePerformanceSnapshot,
  usePerformanceSnapshots,
  usePerformanceSnapshotSubscription,
  usePortfolioPerformanceHistory,
  useCreatePerformanceSnapshot,
  useBenchmark,
  useBenchmarks,
  useBenchmarkAssignments,
  useAssignBenchmark,
  usePmeAnalysis,
  useCalculatePme,
  usePeerUniverse,
  usePeerUniverses,
  usePeerRanking,
  usePeerRankingsSubscription,
  useCalculatePeerRanking,
  useAttribution,
  useCalculateAttribution,
  useJCurveAnalysis,
  usePortfolioPerformanceSummary,
  useQuartileAnalysis,
  usePerformanceComparison,
  useClientPerformanceAggregate,
  usePerformanceRiskMetrics
} from './hooks/performance-hooks';

export {
  PERFORMANCE_COLLECTIONS,
  PERFORMANCE_INDEXES,
  PERFORMANCE_SECURITY_RULES,
  PERFORMANCE_VALIDATION
} from './firebase/performance-collections';

// Integration Services
export {
  createCrossModuleLink,
  getLinksForEntity,
  deleteCrossModuleLink,
  deleteLinksForEntity,
  initiateDealConversion,
  getDealConversion,
  getConversionsForDeal,
  getPendingConversions,
  approveICForConversion,
  approvePortfolioForConversion,
  executeConversion,
  cancelConversion,
  createCapitalDeployment,
  getCapitalDeployment,
  updateDeploymentStatus,
  getDeploymentsForHolding,
  getDeploymentsForProject,
  getTotalDeployedForHolding,
  getPortfolioDealAllocations,
  getDealAllocations,
  getProjectHoldingLinks,
  getHoldingProjectLinks,
  createCoInvestor,
  getCoInvestor,
  getActiveCoInvestors,
  updateCoInvestor,
  createCoInvestmentOpportunity,
  getCoInvestmentOpportunity,
  getOpportunitiesForDeal,
  getActiveOpportunities,
  getCoInvestmentVehicle,
  getVehiclesForDeal,
  getSyndicationWorkflow,
  getActiveSyndicationWorkflows,
  buildUnifiedAssetView,
  getUnifiedAssetView,
  getAssetAggregation,
  buildCrossModuleDashboard
} from './services/integration-service';

// Integration Hooks
export {
  integrationKeys,
  useCrossModuleLinks,
  useCreateCrossModuleLink,
  useDeleteCrossModuleLink,
  useDealConversion,
  useDealConversions,
  usePendingConversions,
  useInitiateDealConversion,
  useDealConversionWorkflow,
  useConversionStatus,
  useHoldingDeployments,
  useProjectDeployments,
  useCreateDeployment,
  useUpdateDeploymentStatus,
  usePortfolioDealAllocations,
  useDealAllocations,
  useProjectHoldingLinks,
  useHoldingProjectLinks,
  useCoInvestor,
  useActiveCoInvestors,
  useCreateCoInvestor,
  useUpdateCoInvestor,
  useCoInvestmentOpportunity,
  useOpportunitiesForDeal,
  useActiveOpportunities,
  useCreateCoInvestmentOpportunity,
  useUnifiedAssetView,
  useBuildAssetView,
  useAssetAggregation,
  useCrossModuleDashboard,
  useEntityLinks,
  useDeploymentSummary
} from './hooks/integration-hooks';

export {
  INTEGRATION_COLLECTIONS,
  INTEGRATION_INDEXES,
  INTEGRATION_SECURITY_RULES,
  INTEGRATION_VALIDATION
} from './firebase/integration-collections';
