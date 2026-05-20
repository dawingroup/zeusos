// ============================================================================
// MARKET RESEARCH CONSTANTS
// DawinOS v2.0 - Market Intelligence Module
// ============================================================================

// Trend Status
export const TREND_STATUS = {
  EMERGING: 'emerging',
  GROWING: 'growing',
  MATURE: 'mature',
  DECLINING: 'declining',
  STABLE: 'stable',
} as const;

export type TrendStatus = typeof TREND_STATUS[keyof typeof TREND_STATUS];

export const TREND_STATUS_LABELS: Record<TrendStatus, string> = {
  emerging: 'Emerging',
  growing: 'Growing',
  mature: 'Mature',
  declining: 'Declining',
  stable: 'Stable',
};

export const TREND_STATUS_COLORS: Record<TrendStatus, string> = {
  emerging: 'bg-purple-100 text-purple-800',
  growing: 'bg-green-100 text-green-800',
  mature: 'bg-blue-100 text-blue-800',
  declining: 'bg-red-100 text-red-800',
  stable: 'bg-gray-100 text-gray-800',
};

export const TREND_STATUS_HEX: Record<TrendStatus, string> = {
  emerging: '#9C27B0',
  growing: '#4CAF50',
  mature: '#2196F3',
  declining: '#F44336',
  stable: '#607D8B',
};

// Trend Categories
export const TREND_CATEGORIES = {
  TECHNOLOGY: 'technology',
  REGULATORY: 'regulatory',
  CONSUMER: 'consumer',
  ECONOMIC: 'economic',
  COMPETITIVE: 'competitive',
  DEMOGRAPHIC: 'demographic',
  ENVIRONMENTAL: 'environmental',
  POLITICAL: 'political',
} as const;

export type TrendCategory = typeof TREND_CATEGORIES[keyof typeof TREND_CATEGORIES];

export const TREND_CATEGORY_LABELS: Record<TrendCategory, string> = {
  technology: 'Technology & Innovation',
  regulatory: 'Regulatory & Compliance',
  consumer: 'Consumer Behavior',
  economic: 'Economic & Financial',
  competitive: 'Competitive Dynamics',
  demographic: 'Demographics & Social',
  environmental: 'Environmental & Sustainability',
  political: 'Political & Policy',
};

export const TREND_CATEGORY_COLORS: Record<TrendCategory, string> = {
  technology: 'bg-indigo-100 text-indigo-800',
  regulatory: 'bg-red-100 text-red-800',
  consumer: 'bg-pink-100 text-pink-800',
  economic: 'bg-green-100 text-green-800',
  competitive: 'bg-orange-100 text-orange-800',
  demographic: 'bg-cyan-100 text-cyan-800',
  environmental: 'bg-emerald-100 text-emerald-800',
  political: 'bg-rose-100 text-rose-800',
};

// Trend Impact on Business
export const TREND_BUSINESS_IMPACT = {
  OPPORTUNITY: 'opportunity',
  THREAT: 'threat',
  NEUTRAL: 'neutral',
  MIXED: 'mixed',
} as const;

export type TrendBusinessImpact = typeof TREND_BUSINESS_IMPACT[keyof typeof TREND_BUSINESS_IMPACT];

export const TREND_IMPACT_LABELS: Record<TrendBusinessImpact, string> = {
  opportunity: 'Opportunity',
  threat: 'Threat',
  neutral: 'Neutral',
  mixed: 'Mixed Impact',
};

export const TREND_IMPACT_COLORS: Record<TrendBusinessImpact, string> = {
  opportunity: 'bg-green-100 text-green-800',
  threat: 'bg-red-100 text-red-800',
  neutral: 'bg-gray-100 text-gray-800',
  mixed: 'bg-amber-100 text-amber-800',
};

// Market Report Types (Research-specific)
export const RESEARCH_REPORT_TYPES = {
  MARKET_SIZING: 'market_sizing',
  COMPETITIVE_ANALYSIS: 'competitive_analysis',
  INDUSTRY_OVERVIEW: 'industry_overview',
  TREND_ANALYSIS: 'trend_analysis',
  CUSTOMER_INSIGHTS: 'customer_insights',
  REGULATORY_UPDATE: 'regulatory_update',
  TECHNOLOGY_ASSESSMENT: 'technology_assessment',
  SWOT_ANALYSIS: 'swot_analysis',
  PESTLE_ANALYSIS: 'pestle_analysis',
  OPPORTUNITY_ASSESSMENT: 'opportunity_assessment',
} as const;

export type ResearchReportType = typeof RESEARCH_REPORT_TYPES[keyof typeof RESEARCH_REPORT_TYPES];

export const RESEARCH_REPORT_TYPE_LABELS: Record<ResearchReportType, string> = {
  market_sizing: 'Market Sizing',
  competitive_analysis: 'Competitive Analysis',
  industry_overview: 'Industry Overview',
  trend_analysis: 'Trend Analysis',
  customer_insights: 'Customer Insights',
  regulatory_update: 'Regulatory Update',
  technology_assessment: 'Technology Assessment',
  swot_analysis: 'SWOT Analysis',
  pestle_analysis: 'PESTLE Analysis',
  opportunity_assessment: 'Opportunity Assessment',
};

// Report Status (Research-specific)
export const RESEARCH_REPORT_STATUS = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type ResearchReportStatus = typeof RESEARCH_REPORT_STATUS[keyof typeof RESEARCH_REPORT_STATUS];

export const RESEARCH_REPORT_STATUS_LABELS: Record<ResearchReportStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
  published: 'Published',
  archived: 'Archived',
};

export const RESEARCH_REPORT_STATUS_COLORS: Record<ResearchReportStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  in_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  published: 'bg-green-100 text-green-800',
  archived: 'bg-slate-100 text-slate-800',
};

// PESTLE Factor Sentiment
export const PESTLE_SENTIMENT = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
  MIXED: 'mixed',
} as const;

export type PESTLESentiment = typeof PESTLE_SENTIMENT[keyof typeof PESTLE_SENTIMENT];

export const PESTLE_SENTIMENT_LABELS: Record<PESTLESentiment, string> = {
  positive: 'Positive',
  negative: 'Negative',
  neutral: 'Neutral',
  mixed: 'Mixed',
};

export const PESTLE_SENTIMENT_COLORS: Record<PESTLESentiment, string> = {
  positive: 'bg-green-100 text-green-800',
  negative: 'bg-red-100 text-red-800',
  neutral: 'bg-gray-100 text-gray-800',
  mixed: 'bg-amber-100 text-amber-800',
};

// Time Horizons
export const TIME_HORIZONS = ['short_term', 'medium_term', 'long_term'] as const;
export type TimeHorizon = typeof TIME_HORIZONS[number];

export const TIME_HORIZON_LABELS: Record<TimeHorizon, string> = {
  short_term: 'Short Term (0-12 months)',
  medium_term: 'Medium Term (1-3 years)',
  long_term: 'Long Term (3+ years)',
};

// Watch Status
export const WATCH_STATUS = ['active', 'monitoring', 'resolved'] as const;
export type WatchStatus = typeof WATCH_STATUS[number];

export const WATCH_STATUS_LABELS: Record<WatchStatus, string> = {
  active: 'Active Watch',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
};

// Velocity
export const VELOCITY_LEVELS = ['fast', 'moderate', 'slow'] as const;
export type VelocityLevel = typeof VELOCITY_LEVELS[number];

// Certainty
export const CERTAINTY_LEVELS = ['high', 'medium', 'low'] as const;
export type CertaintyLevel = typeof CERTAINTY_LEVELS[number];

// Priority
export const PRIORITY_LEVELS = ['high', 'medium', 'low'] as const;
export type PriorityLevel = typeof PRIORITY_LEVELS[number];

// Research Source Types
export const RESEARCH_SOURCE_TYPES = [
  'news',
  'research_firm',
  'government',
  'industry_body',
  'academic',
  'internal',
] as const;
export type ResearchSourceType = typeof RESEARCH_SOURCE_TYPES[number];

export const RESEARCH_SOURCE_TYPE_LABELS: Record<ResearchSourceType, string> = {
  news: 'News Publication',
  research_firm: 'Research Firm',
  government: 'Government',
  industry_body: 'Industry Body',
  academic: 'Academic',
  internal: 'Internal',
};

// Uganda-Specific Market Indicators
export const UGANDA_MARKET_INDICATORS = [
  { id: 'gdp_growth', name: 'GDP Growth Rate', unit: '%', source: 'Bank of Uganda' },
  { id: 'inflation', name: 'Inflation Rate', unit: '%', source: 'UBOS' },
  { id: 'exchange_rate', name: 'UGX/USD Exchange Rate', unit: 'UGX', source: 'Bank of Uganda' },
  { id: 'interest_rate', name: 'Central Bank Rate', unit: '%', source: 'Bank of Uganda' },
  { id: 'unemployment', name: 'Unemployment Rate', unit: '%', source: 'UBOS' },
  { id: 'fdi_inflows', name: 'FDI Inflows', unit: 'USD Millions', source: 'UIA' },
  { id: 'trade_balance', name: 'Trade Balance', unit: 'USD Millions', source: 'Bank of Uganda' },
  { id: 'construction_index', name: 'Construction Output Index', unit: 'Index', source: 'UBOS' },
  { id: 'pmi', name: 'Purchasing Managers Index', unit: 'Index', source: 'Stanbic Bank' },
  { id: 'business_confidence', name: 'Business Confidence Index', unit: 'Index', source: 'Bank of Uganda' },
] as const;

// Uganda Regulatory Bodies
export const UGANDA_REGULATORY_BODIES = [
  { id: 'bou', name: 'Bank of Uganda', sector: 'Financial Services' },
  { id: 'ura', name: 'Uganda Revenue Authority', sector: 'Taxation' },
  { id: 'ursb', name: 'Uganda Registration Services Bureau', sector: 'Business Registration' },
  { id: 'nema', name: 'National Environment Management Authority', sector: 'Environment' },
  { id: 'unbs', name: 'Uganda National Bureau of Standards', sector: 'Standards' },
  { id: 'uia', name: 'Uganda Investment Authority', sector: 'Investment' },
  { id: 'unra', name: 'Uganda National Roads Authority', sector: 'Infrastructure' },
  { id: 'nda', name: 'National Drug Authority', sector: 'Healthcare' },
  { id: 'ucc', name: 'Uganda Communications Commission', sector: 'Telecom' },
  { id: 'era', name: 'Electricity Regulatory Authority', sector: 'Energy' },
] as const;

// Uganda Industry Growth Projections (2024-2028)
export const UGANDA_INDUSTRY_PROJECTIONS = [
  { sector: 'Healthcare', cagr: 12.5, outlook: 'strong' },
  { sector: 'Education', cagr: 8.2, outlook: 'positive' },
  { sector: 'Fintech', cagr: 25.0, outlook: 'strong' },
  { sector: 'Agriculture', cagr: 4.5, outlook: 'stable' },
  { sector: 'Real Estate', cagr: 7.8, outlook: 'positive' },
  { sector: 'Logistics', cagr: 9.5, outlook: 'positive' },
  { sector: 'Energy', cagr: 15.0, outlook: 'strong' },
  { sector: 'Manufacturing', cagr: 6.2, outlook: 'stable' },
  { sector: 'Tourism', cagr: 11.0, outlook: 'positive' },
  { sector: 'Technology', cagr: 18.0, outlook: 'strong' },
] as const;

// Period Types
export const PERIOD_TYPES = ['monthly', 'quarterly', 'annual'] as const;
export type PeriodType = typeof PERIOD_TYPES[number];

// Chart Types
export const CHART_TYPES = ['bar', 'line', 'pie', 'table'] as const;
export type ChartType = typeof CHART_TYPES[number];

// Collections
export const MARKET_TRENDS_COLLECTION = 'market_trends';
export const INDUSTRY_REPORTS_COLLECTION = 'industry_reports';
export const PESTLE_FACTORS_COLLECTION = 'pestle_factors';
export const MARKET_INDICATORS_COLLECTION = 'market_indicators';
export const RESEARCH_SOURCES_COLLECTION = 'research_sources';
