// ============================================================================
// MARKET INTELLIGENCE SCAN TYPES
// DawinOS v2.0 - AI-Driven Competitive Intelligence
// Types for market intelligence scan reports and analysis
// ============================================================================

// ----------------------------------------------------------------------------
// INPUT TYPES
// ----------------------------------------------------------------------------

export type MarketIntelSubsidiaryId = 'finishes' | 'advisory' | 'technology' | 'capital';

export type ScanDepth = 'quick' | 'standard' | 'deep';

export type TimeHorizon = 'last_month' | 'last_quarter' | 'last_6_months' | 'last_year';

export type FocusArea =
  | 'pricing'
  | 'new_products'
  | 'partnerships'
  | 'hiring'
  | 'marketing'
  | 'technology'
  | 'expansion'
  | 'funding'
  | 'leadership'
  | 'regulatory';

export interface MarketIntelligenceScanInput {
  subsidiaryId: MarketIntelSubsidiaryId;
  competitorIds?: string[];
  focusAreas?: FocusArea[];
  timeHorizon?: TimeHorizon;
  depth?: ScanDepth;
}

// ----------------------------------------------------------------------------
// REPORT TYPES
// ----------------------------------------------------------------------------

export type OverallThreatLevel = 'low' | 'moderate' | 'elevated' | 'high' | 'critical';

export type MarketSentiment = 'bullish' | 'neutral' | 'bearish';

export type FindingCategory =
  | 'product_launch'
  | 'partnership'
  | 'expansion'
  | 'pricing'
  | 'hiring'
  | 'marketing'
  | 'technology'
  | 'leadership'
  | 'funding'
  | 'regulatory'
  | 'other';

export type FindingSignificance = 'minor' | 'moderate' | 'significant' | 'major' | 'transformative';

export type ActivityLevel = 'dormant' | 'low' | 'moderate' | 'active' | 'very_active';

export type TrendAdoption = 'early' | 'growing' | 'mainstream' | 'mature';

export type TrendRelevance = 'low' | 'medium' | 'high' | 'critical';

export type SignalStrength = 'weak' | 'moderate' | 'strong';

export type TimeToImpact = 'immediate' | 'short_term' | 'medium_term' | 'long_term';

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export type RecommendationCategory = 'offensive' | 'defensive' | 'monitoring' | 'investment';

export type EstimatedTimeframe = 'immediate' | '1_month' | '3_months' | '6_months' | '12_months';

export type ResourceRequirement = 'minimal' | 'moderate' | 'significant' | 'major';

export type AlertSeverity = 'warning' | 'elevated' | 'critical';

export type ThreatLevelChange = 'increased' | 'decreased' | 'unchanged';

// ----------------------------------------------------------------------------
// FINDING
// ----------------------------------------------------------------------------

export interface CompetitorFinding {
  category: FindingCategory;
  title: string;
  description: string;
  evidence: string;
  significance: FindingSignificance;
  dateObserved: string;
  implications: string;
  confidence: number;
}

// ----------------------------------------------------------------------------
// COMPETITOR ANALYSIS
// ----------------------------------------------------------------------------

export interface CompetitorAnalysis {
  competitorId: string;
  competitorName: string;
  updatedThreatLevel: string;
  threatLevelChange: ThreatLevelChange;
  digitalPresenceScore: number;
  activityLevel: ActivityLevel;
  findings: CompetitorFinding[];
  overallAssessment: string;
  watchItems: string[];
}

// ----------------------------------------------------------------------------
// TREND ANALYSIS
// ----------------------------------------------------------------------------

export interface IndustryTrend {
  trend: string;
  description: string;
  adoptionRate: TrendAdoption;
  relevance: TrendRelevance;
  competitorsRiding: string[];
  opportunityForUs: string;
}

export interface EmergingPattern {
  pattern: string;
  description: string;
  signalStrength: SignalStrength;
  timeToImpact: TimeToImpact;
}

export interface TrendAnalysis {
  industryTrends: IndustryTrend[];
  emergingPatterns: EmergingPattern[];
}

// ----------------------------------------------------------------------------
// STRATEGIC RECOMMENDATIONS
// ----------------------------------------------------------------------------

export interface StrategicRecommendation {
  priority: RecommendationPriority;
  category: RecommendationCategory;
  title: string;
  description: string;
  rationale: string;
  targetCompetitors: string[];
  estimatedTimeframe: EstimatedTimeframe;
  resourceRequirement: ResourceRequirement;
}

// ----------------------------------------------------------------------------
// RISK ALERTS
// ----------------------------------------------------------------------------

export interface RiskAlert {
  severity: AlertSeverity;
  title: string;
  description: string;
  affectedAreas: string[];
  suggestedAction: string;
}

// ----------------------------------------------------------------------------
// REPORT METADATA
// ----------------------------------------------------------------------------

export interface ReportMetadata {
  competitorsAnalyzed: number;
  totalFindings: number;
  sourcesConsulted: number;
  searchGroundingUsed: boolean;
  analysisDepth: ScanDepth;
  confidenceScore: number;
  requestedBy?: string;
  requestedByEmail?: string;
  generatedAt: string;
}

// ----------------------------------------------------------------------------
// FULL REPORT
// ----------------------------------------------------------------------------

export interface MarketIntelligenceReport {
  reportTitle: string;
  generatedAt: string;
  subsidiaryId: MarketIntelSubsidiaryId;
  subsidiaryName: string;
  timeHorizon: TimeHorizon;
  executiveSummary: string;
  overallThreatLevel: OverallThreatLevel;
  marketSentiment: MarketSentiment;
  competitorAnalyses: CompetitorAnalysis[];
  trendAnalysis: TrendAnalysis;
  strategicRecommendations: StrategicRecommendation[];
  riskAlerts: RiskAlert[];
  metadata: ReportMetadata;
}

// ----------------------------------------------------------------------------
// API RESPONSE
// ----------------------------------------------------------------------------

export interface MarketIntelligenceScanResponse {
  success: boolean;
  reportId?: string;
  report?: MarketIntelligenceReport;
  competitorsAnalyzed?: number;
  totalFindings?: number;
  movesCreated?: number;
  message?: string;
}

export interface MarketIntelligenceReportsResponse {
  success: boolean;
  reports: StoredMarketIntelligenceReport[];
}

export interface StoredMarketIntelligenceReport extends MarketIntelligenceReport {
  id: string;
  status: 'completed' | 'failed';
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// UI CONSTANTS
// ----------------------------------------------------------------------------

export const SUBSIDIARY_OPTIONS: Array<{ id: MarketIntelSubsidiaryId; name: string; description: string }> = [
  { id: 'finishes', name: 'Dawin Finishes', description: 'Custom millwork, furniture & interior fit-out' },
  { id: 'advisory', name: 'Dawin Advisory', description: 'Strategic advisory & project management' },
  { id: 'technology', name: 'Dawin Technology', description: 'Technology solutions & digital transformation' },
  { id: 'capital', name: 'Dawin Capital', description: 'Investment management & financial services' },
];

export const FOCUS_AREA_OPTIONS: Array<{ id: FocusArea; label: string }> = [
  { id: 'pricing', label: 'Pricing Changes' },
  { id: 'new_products', label: 'New Products/Services' },
  { id: 'partnerships', label: 'Partnerships & Alliances' },
  { id: 'hiring', label: 'Hiring & Talent' },
  { id: 'marketing', label: 'Marketing & Branding' },
  { id: 'technology', label: 'Technology Adoption' },
  { id: 'expansion', label: 'Market Expansion' },
  { id: 'funding', label: 'Funding & Investment' },
  { id: 'leadership', label: 'Leadership Changes' },
  { id: 'regulatory', label: 'Regulatory Activity' },
];

export const TIME_HORIZON_OPTIONS: Array<{ id: TimeHorizon; label: string }> = [
  { id: 'last_month', label: 'Last 30 Days' },
  { id: 'last_quarter', label: 'Last Quarter' },
  { id: 'last_6_months', label: 'Last 6 Months' },
  { id: 'last_year', label: 'Past Year' },
];

export const SCAN_DEPTH_OPTIONS: Array<{ id: ScanDepth; label: string; description: string }> = [
  { id: 'quick', label: 'Quick Scan', description: 'Key highlights, 2-3 findings per competitor' },
  { id: 'standard', label: 'Standard', description: 'Balanced analysis, 3-5 findings per competitor' },
  { id: 'deep', label: 'Deep Dive', description: 'Exhaustive analysis, 5-8 findings per competitor' },
];

export const THREAT_LEVEL_CONFIG: Record<OverallThreatLevel, { color: string; bg: string; label: string }> = {
  low: { color: 'text-green-700', bg: 'bg-green-100', label: 'Low' },
  moderate: { color: 'text-yellow-700', bg: 'bg-yellow-100', label: 'Moderate' },
  elevated: { color: 'text-orange-700', bg: 'bg-orange-100', label: 'Elevated' },
  high: { color: 'text-red-700', bg: 'bg-red-100', label: 'High' },
  critical: { color: 'text-red-900', bg: 'bg-red-200', label: 'Critical' },
};

export const SIGNIFICANCE_CONFIG: Record<FindingSignificance, { color: string; bg: string }> = {
  minor: { color: 'text-gray-600', bg: 'bg-gray-100' },
  moderate: { color: 'text-blue-700', bg: 'bg-blue-100' },
  significant: { color: 'text-yellow-700', bg: 'bg-yellow-100' },
  major: { color: 'text-orange-700', bg: 'bg-orange-100' },
  transformative: { color: 'text-red-700', bg: 'bg-red-100' },
};

export const PRIORITY_CONFIG: Record<RecommendationPriority, { color: string; bg: string }> = {
  critical: { color: 'text-red-700', bg: 'bg-red-100' },
  high: { color: 'text-orange-700', bg: 'bg-orange-100' },
  medium: { color: 'text-yellow-700', bg: 'bg-yellow-100' },
  low: { color: 'text-green-700', bg: 'bg-green-100' },
};

export const ALERT_SEVERITY_CONFIG: Record<AlertSeverity, { color: string; bg: string; icon: string }> = {
  warning: { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-300', icon: 'AlertTriangle' },
  elevated: { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-300', icon: 'AlertCircle' },
  critical: { color: 'text-red-700', bg: 'bg-red-50 border-red-300', icon: 'ShieldAlert' },
};
