// ============================================================================
// MARKET INTELLIGENCE MODULE
// DawinOS v2.0 - Market Intelligence Module
// Competitor tracking, market analysis, and business environment monitoring
// ============================================================================

// Constants
export {
  // Competitor Status
  COMPETITOR_STATUS,
  COMPETITOR_STATUS_LABELS,
  COMPETITOR_STATUS_COLORS,
  
  // Threat Levels
  THREAT_LEVELS,
  THREAT_LEVEL_LABELS,
  THREAT_LEVEL_COLORS,
  THREAT_LEVEL_HEX,
  
  // Market Segments
  MARKET_SEGMENTS,
  SEGMENT_LABELS,
  
  // Intelligence Sources
  INTELLIGENCE_SOURCES,
  SOURCE_LABELS,
  
  // Signal Types
  SIGNAL_TYPES,
  SIGNAL_TYPE_LABELS,
  SIGNAL_TYPE_COLORS,
  
  // Impact Levels
  IMPACT_LEVELS,
  IMPACT_LEVEL_LABELS,
  IMPACT_LEVEL_COLORS,
  
  // PESTLE
  PESTLE_CATEGORIES,
  PESTLE_LABELS,
  PESTLE_COLORS,
  
  // SWOT
  SWOT_CATEGORIES,
  SWOT_LABELS,
  SWOT_COLORS,
  
  // Confidence & Relevance
  CONFIDENCE_LEVELS,
  CONFIDENCE_LABELS,
  RELEVANCE_LEVELS,
  
  // Timeframes
  TIMEFRAMES,
  TIMEFRAME_LABELS,
  
  // Intelligence Status
  INTELLIGENCE_STATUS,
  INTELLIGENCE_STATUS_LABELS,
  
  // Report Types & Status
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  REPORT_STATUS,
  
  // Importance
  IMPORTANCE_LEVELS,
  
  // Collections
  COMPETITORS_COLLECTION,
  MARKET_SIGNALS_COLLECTION,
  MARKET_REPORTS_COLLECTION,
  INTELLIGENCE_ITEMS_COLLECTION,
  SWOT_ANALYSES_COLLECTION,
  
  // Currency
  DEFAULT_CURRENCY,
} from './constants';

// Types
export type {
  CompetitorStatus,
  ThreatLevel,
  MarketSegment,
  IntelligenceSource,
  SignalType,
  ImpactLevel,
  PESTLECategory,
  SWOTCategory,
  ConfidenceLevel,
  RelevanceLevel,
  Timeframe,
  IntelligenceStatus,
  ReportType,
  ReportStatus,
  ImportanceLevel,
} from './constants';

export type {
  // Competitor
  Competitor,
  CompetitorKeyPerson,
  CompetitorProduct,
  FundingRound,
  SocialMediaLinks,
  
  // Signals
  MarketSignal,
  
  // Intelligence
  IntelligenceItem,
  
  // SWOT
  SWOTAnalysis,
  SWOTItem,
  
  // Reports
  MarketReport,
  ReportSection,
  
  // Comparisons
  CompetitiveComparison,
  ComparisonDimension,
  
  // Market Share
  MarketShareData,
  MarketSharePlayer,
  
  // Summary
  MarketIntelligenceSummary,
  CompetitorUpdate,
  
  // Filters
  CompetitorFilters,
  SignalFilters,
  IntelligenceFilters,
} from './types';

// Schemas
export {
  competitorSchema,
  competitorUpdateSchema,
  marketSignalSchema,
  intelligenceItemSchema,
  swotItemSchema,
  swotAnalysisSchema,
  marketReportSchema,
} from './schemas';

export type {
  CompetitorInput,
  CompetitorUpdate as CompetitorUpdateInput,
  MarketSignalInput,
  IntelligenceItemInput,
  SWOTItemInput,
  SWOTAnalysisInput,
  MarketReportInput,
} from './schemas';

// Services
export {
  // Competitors
  createCompetitor,
  getCompetitor,
  getCompetitors,
  updateCompetitor as updateCompetitorData,
  deleteCompetitor,
  
  // Signals
  createMarketSignal,
  getMarketSignal,
  getMarketSignals,
  updateMarketSignal,
  markSignalActioned,
  deleteMarketSignal,
  
  // Intelligence Items
  createIntelligenceItem,
  getIntelligenceItems,
  updateIntelligenceItem,
  deleteIntelligenceItem,
  
  // SWOT
  createSWOTAnalysis,
  getSWOTAnalysis,
  getSWOTAnalyses,
  updateSWOTAnalysis,
  deleteSWOTAnalysis,
  
  // Analytics
  getMarketIntelligenceSummary,
  getCompetitorWithSignals,
  getActionableSignals,
} from './services';

// Hooks
export { useMarketIntelligence } from './hooks';
