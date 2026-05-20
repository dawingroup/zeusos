// ============================================================================
// MARKET INTELLIGENCE CONSTANTS
// DawinOS v2.0 - Market Intelligence Module
// ============================================================================

// Competitor Status
export const COMPETITOR_STATUS = {
  ACTIVE: 'active',
  MONITORING: 'monitoring',
  EMERGING: 'emerging',
  DECLINING: 'declining',
  INACTIVE: 'inactive',
} as const;

export type CompetitorStatus = typeof COMPETITOR_STATUS[keyof typeof COMPETITOR_STATUS];

export const COMPETITOR_STATUS_LABELS: Record<CompetitorStatus, string> = {
  active: 'Active',
  monitoring: 'Monitoring',
  emerging: 'Emerging',
  declining: 'Declining',
  inactive: 'Inactive',
};

export const COMPETITOR_STATUS_COLORS: Record<CompetitorStatus, string> = {
  active: 'bg-green-100 text-green-800',
  monitoring: 'bg-blue-100 text-blue-800',
  emerging: 'bg-purple-100 text-purple-800',
  declining: 'bg-amber-100 text-amber-800',
  inactive: 'bg-gray-100 text-gray-800',
};

// Competitor Threat Level
export const THREAT_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  MINIMAL: 'minimal',
} as const;

export type ThreatLevel = typeof THREAT_LEVELS[keyof typeof THREAT_LEVELS];

export const THREAT_LEVEL_LABELS: Record<ThreatLevel, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  minimal: 'Minimal',
};

export const THREAT_LEVEL_COLORS: Record<ThreatLevel, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
  minimal: 'bg-gray-100 text-gray-800',
};

export const THREAT_LEVEL_HEX: Record<ThreatLevel, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#FBC02D',
  low: '#388E3C',
  minimal: '#757575',
};

// Market Segments (Uganda Focus)
export const MARKET_SEGMENTS = [
  { id: 'healthcare', name: 'Healthcare & Medical', icon: 'Heart' },
  { id: 'education', name: 'Education & Training', icon: 'GraduationCap' },
  { id: 'fintech', name: 'Financial Technology', icon: 'Landmark' },
  { id: 'agritech', name: 'Agriculture & Agritech', icon: 'Wheat' },
  { id: 'real_estate', name: 'Real Estate & Construction', icon: 'Building2' },
  { id: 'logistics', name: 'Logistics & Transport', icon: 'Truck' },
  { id: 'energy', name: 'Energy & Utilities', icon: 'Zap' },
  { id: 'retail', name: 'Retail & E-commerce', icon: 'Store' },
  { id: 'manufacturing', name: 'Manufacturing', icon: 'Factory' },
  { id: 'hospitality', name: 'Tourism & Hospitality', icon: 'Hotel' },
  { id: 'telecoms', name: 'Telecommunications', icon: 'Radio' },
  { id: 'professional', name: 'Professional Services', icon: 'Briefcase' },
] as const;

export type MarketSegment = typeof MARKET_SEGMENTS[number]['id'];

export const SEGMENT_LABELS: Record<string, string> = Object.fromEntries(
  MARKET_SEGMENTS.map(s => [s.id, s.name])
);

// Intelligence Sources
export const INTELLIGENCE_SOURCES = {
  NEWS: 'news',
  SOCIAL_MEDIA: 'social_media',
  INDUSTRY_REPORT: 'industry_report',
  GOVERNMENT: 'government',
  FINANCIAL_FILING: 'financial_filing',
  FIELD_RESEARCH: 'field_research',
  CUSTOMER_FEEDBACK: 'customer_feedback',
  COMPETITOR_WEBSITE: 'competitor_website',
  INTERNAL: 'internal',
} as const;

export type IntelligenceSource = typeof INTELLIGENCE_SOURCES[keyof typeof INTELLIGENCE_SOURCES];

export const SOURCE_LABELS: Record<IntelligenceSource, string> = {
  news: 'News Article',
  social_media: 'Social Media',
  industry_report: 'Industry Report',
  government: 'Government Source',
  financial_filing: 'Financial Filing',
  field_research: 'Field Research',
  customer_feedback: 'Customer Feedback',
  competitor_website: 'Competitor Website',
  internal: 'Internal Analysis',
};

// Signal Types
export const SIGNAL_TYPES = {
  PRODUCT_LAUNCH: 'product_launch',
  PRICING_CHANGE: 'pricing_change',
  EXPANSION: 'expansion',
  PARTNERSHIP: 'partnership',
  FUNDING: 'funding',
  LEADERSHIP_CHANGE: 'leadership_change',
  REGULATORY: 'regulatory',
  MARKET_ENTRY: 'market_entry',
  MARKET_EXIT: 'market_exit',
  ACQUISITION: 'acquisition',
  TECHNOLOGY: 'technology',
  MARKETING: 'marketing',
} as const;

export type SignalType = typeof SIGNAL_TYPES[keyof typeof SIGNAL_TYPES];

export const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  product_launch: 'Product Launch',
  pricing_change: 'Pricing Change',
  expansion: 'Expansion',
  partnership: 'Partnership',
  funding: 'Funding Round',
  leadership_change: 'Leadership Change',
  regulatory: 'Regulatory Development',
  market_entry: 'Market Entry',
  market_exit: 'Market Exit',
  acquisition: 'Acquisition',
  technology: 'Technology Update',
  marketing: 'Marketing Campaign',
};

export const SIGNAL_TYPE_COLORS: Record<SignalType, string> = {
  product_launch: 'bg-purple-100 text-purple-800',
  pricing_change: 'bg-amber-100 text-amber-800',
  expansion: 'bg-green-100 text-green-800',
  partnership: 'bg-blue-100 text-blue-800',
  funding: 'bg-emerald-100 text-emerald-800',
  leadership_change: 'bg-gray-100 text-gray-800',
  regulatory: 'bg-red-100 text-red-800',
  market_entry: 'bg-indigo-100 text-indigo-800',
  market_exit: 'bg-orange-100 text-orange-800',
  acquisition: 'bg-pink-100 text-pink-800',
  technology: 'bg-cyan-100 text-cyan-800',
  marketing: 'bg-teal-100 text-teal-800',
};

// Impact Levels
export const IMPACT_LEVELS = {
  MAJOR: 'major',
  MODERATE: 'moderate',
  MINOR: 'minor',
  UNKNOWN: 'unknown',
} as const;

export type ImpactLevel = typeof IMPACT_LEVELS[keyof typeof IMPACT_LEVELS];

export const IMPACT_LEVEL_LABELS: Record<ImpactLevel, string> = {
  major: 'Major Impact',
  moderate: 'Moderate Impact',
  minor: 'Minor Impact',
  unknown: 'Unknown',
};

export const IMPACT_LEVEL_COLORS: Record<ImpactLevel, string> = {
  major: 'bg-red-100 text-red-800',
  moderate: 'bg-amber-100 text-amber-800',
  minor: 'bg-green-100 text-green-800',
  unknown: 'bg-gray-100 text-gray-800',
};

// PESTLE Categories
export const PESTLE_CATEGORIES = {
  POLITICAL: 'political',
  ECONOMIC: 'economic',
  SOCIAL: 'social',
  TECHNOLOGICAL: 'technological',
  LEGAL: 'legal',
  ENVIRONMENTAL: 'environmental',
} as const;

export type PESTLECategory = typeof PESTLE_CATEGORIES[keyof typeof PESTLE_CATEGORIES];

export const PESTLE_LABELS: Record<PESTLECategory, string> = {
  political: 'Political',
  economic: 'Economic',
  social: 'Social',
  technological: 'Technological',
  legal: 'Legal',
  environmental: 'Environmental',
};

export const PESTLE_COLORS: Record<PESTLECategory, string> = {
  political: 'bg-red-100 text-red-800',
  economic: 'bg-green-100 text-green-800',
  social: 'bg-blue-100 text-blue-800',
  technological: 'bg-purple-100 text-purple-800',
  legal: 'bg-amber-100 text-amber-800',
  environmental: 'bg-emerald-100 text-emerald-800',
};

// SWOT Categories
export const SWOT_CATEGORIES = {
  STRENGTH: 'strength',
  WEAKNESS: 'weakness',
  OPPORTUNITY: 'opportunity',
  THREAT: 'threat',
} as const;

export type SWOTCategory = typeof SWOT_CATEGORIES[keyof typeof SWOT_CATEGORIES];

export const SWOT_LABELS: Record<SWOTCategory, string> = {
  strength: 'Strengths',
  weakness: 'Weaknesses',
  opportunity: 'Opportunities',
  threat: 'Threats',
};

export const SWOT_COLORS: Record<SWOTCategory, string> = {
  strength: 'bg-green-100 text-green-800 border-green-300',
  weakness: 'bg-red-100 text-red-800 border-red-300',
  opportunity: 'bg-blue-100 text-blue-800 border-blue-300',
  threat: 'bg-amber-100 text-amber-800 border-amber-300',
};

// Confidence Levels
export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number];

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'High Confidence',
  medium: 'Medium Confidence',
  low: 'Low Confidence',
};

// Relevance Levels
export const RELEVANCE_LEVELS = ['high', 'medium', 'low'] as const;
export type RelevanceLevel = typeof RELEVANCE_LEVELS[number];

// Timeframes
export const TIMEFRAMES = ['immediate', 'short_term', 'medium_term', 'long_term'] as const;
export type Timeframe = typeof TIMEFRAMES[number];

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  immediate: 'Immediate (< 1 month)',
  short_term: 'Short Term (1-3 months)',
  medium_term: 'Medium Term (3-12 months)',
  long_term: 'Long Term (> 1 year)',
};

// Intelligence Status
export const INTELLIGENCE_STATUS = ['new', 'reviewed', 'actioned', 'archived'] as const;
export type IntelligenceStatus = typeof INTELLIGENCE_STATUS[number];

export const INTELLIGENCE_STATUS_LABELS: Record<IntelligenceStatus, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  actioned: 'Actioned',
  archived: 'Archived',
};

// Report Types
export const REPORT_TYPES = [
  'competitive_landscape',
  'market_analysis',
  'industry_trends',
  'quarterly_review',
] as const;
export type ReportType = typeof REPORT_TYPES[number];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  competitive_landscape: 'Competitive Landscape',
  market_analysis: 'Market Analysis',
  industry_trends: 'Industry Trends',
  quarterly_review: 'Quarterly Review',
};

// Report Status
export const REPORT_STATUS = ['draft', 'review', 'published'] as const;
export type ReportStatus = typeof REPORT_STATUS[number];

// Importance Levels
export const IMPORTANCE_LEVELS = ['critical', 'high', 'medium', 'low'] as const;
export type ImportanceLevel = typeof IMPORTANCE_LEVELS[number];

// Collections
export const COMPETITORS_COLLECTION = 'competitors';
export const MARKET_SIGNALS_COLLECTION = 'market_signals';
export const MARKET_REPORTS_COLLECTION = 'market_reports';
export const INTELLIGENCE_ITEMS_COLLECTION = 'intelligence_items';
export const SWOT_ANALYSES_COLLECTION = 'swot_analyses';

// Default Currency
export const DEFAULT_CURRENCY = 'UGX';
