// ============================================================================
// MARKET RESEARCH TYPES
// DawinOS v2.0 - Market Intelligence Module
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  TrendStatus,
  TrendCategory,
  TrendBusinessImpact,
  ResearchReportType,
  ResearchReportStatus,
  PESTLESentiment,
  TimeHorizon,
  WatchStatus,
  VelocityLevel,
  CertaintyLevel,
  PriorityLevel,
  ResearchSourceType,
  PeriodType,
  ChartType,
} from '../constants/research.constants';
import { PESTLECategory } from '../constants/market.constants';

// ============================================================================
// INDUSTRY TREND
// ============================================================================

export interface IndustryTrend {
  id: string;
  companyId: string;
  
  // Basic Info
  title: string;
  description: string;
  summary: string;
  
  // Classification
  category: TrendCategory;
  status: TrendStatus;
  businessImpact: TrendBusinessImpact;
  
  // Scope
  segments: string[];
  regions: string[];
  isUgandaSpecific: boolean;
  
  // Timeline
  identifiedDate: Date;
  expectedPeakDate?: Date;
  timeHorizon: TimeHorizon;
  
  // Impact Assessment
  impactScore: number; // 1-10
  certainty: CertaintyLevel;
  velocity: VelocityLevel;
  
  // Strategic Response
  opportunities: string[];
  threats: string[];
  recommendedActions: TrendAction[];
  
  // Evidence
  dataPoints: TrendDataPoint[];
  sources: TrendSource[];
  
  // Tracking
  watchStatus: WatchStatus;
  lastReviewDate?: Date;
  nextReviewDate?: Date;
  
  // Relations
  relatedTrends?: string[];
  affectedCompetitors?: string[];
  
  // Metadata
  tags: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TrendAction {
  action: string;
  priority: PriorityLevel;
  timeline: string;
  owner?: string;
}

export interface TrendDataPoint {
  metric: string;
  value: string;
  source: string;
  date: Date;
}

export interface TrendSource {
  name: string;
  url?: string;
  type: string;
  publishDate?: Date;
}

// ============================================================================
// PESTLE FACTOR
// ============================================================================

export interface PESTLEFactor {
  id: string;
  companyId: string;
  
  // Classification
  category: PESTLECategory;
  title: string;
  description: string;
  
  // Assessment
  sentiment: PESTLESentiment;
  impactLevel: PriorityLevel;
  likelihood: PriorityLevel;
  
  // Timing
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  effectiveDate?: Date;
  
  // Business Impact
  affectedSegments: string[];
  affectedOperations: string[];
  riskScore: number; // 1-10
  opportunityScore: number; // 1-10
  
  // Response
  currentResponse?: string;
  recommendedActions: string[];
  contingencyPlan?: string;
  
  // Evidence
  sources: PESTLESource[];
  
  // Tracking
  status: WatchStatus;
  lastAssessedDate: Date;
  
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PESTLESource {
  name: string;
  url?: string;
  date?: Date;
}

// ============================================================================
// PESTLE ANALYSIS SUMMARY
// ============================================================================

export interface PESTLEAnalysis {
  id: string;
  companyId: string;
  
  title: string;
  description?: string;
  analysisDate: Date;
  
  // Factors by category
  political: PESTLEFactor[];
  economic: PESTLEFactor[];
  social: PESTLEFactor[];
  technological: PESTLEFactor[];
  legal: PESTLEFactor[];
  environmental: PESTLEFactor[];
  
  // Overall assessment
  overallSentiment: PESTLESentiment;
  keyRisks: string[];
  keyOpportunities: string[];
  strategicImplications: string[];
  
  // Metadata
  preparedBy: string;
  reviewedBy?: string;
  approvedBy?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// MARKET REPORT (Research)
// ============================================================================

export interface ResearchReport {
  id: string;
  companyId: string;
  
  // Basic Info
  title: string;
  reportType: ResearchReportType;
  status: ResearchReportStatus;
  
  // Content
  executiveSummary: string;
  sections: ResearchReportSection[];
  
  // Scope
  segments: string[];
  competitors?: string[];
  regions: string[];
  timePeriod: {
    start: Date;
    end: Date;
  };
  
  // Key Findings
  keyFindings: string[];
  recommendations: ReportRecommendation[];
  
  // Attachments
  attachments: ReportAttachment[];
  
  // Workflow
  author: string;
  reviewers: string[];
  approvedBy?: string;
  approvedAt?: Timestamp;
  publishedAt?: Timestamp;
  
  // Version
  version: number;
  previousVersions?: string[];
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ResearchReportSection {
  id: string;
  title: string;
  content: string;
  order: number;
  charts?: ReportChart[];
}

export interface ReportChart {
  type: ChartType;
  title: string;
  data: unknown;
}

export interface ReportRecommendation {
  recommendation: string;
  priority: PriorityLevel;
  timeline: string;
}

export interface ReportAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadedAt: Date;
}

// ============================================================================
// MARKET INDICATOR
// ============================================================================

export interface MarketIndicatorValue {
  id: string;
  companyId: string;
  
  indicatorId: string;
  indicatorName: string;
  
  value: number;
  previousValue?: number;
  changePercent?: number;
  
  period: string; // e.g., "2024-Q1", "2024-01"
  periodType: PeriodType;
  
  source: string;
  sourceUrl?: string;
  publishDate: Date;
  
  notes?: string;
  
  createdBy: string;
  createdAt: Timestamp;
}

// ============================================================================
// RESEARCH SOURCE
// ============================================================================

export interface ResearchSource {
  id: string;
  companyId: string;
  
  name: string;
  type: ResearchSourceType;
  url?: string;
  
  // Credibility
  credibilityScore: number; // 1-10
  isVerified: boolean;
  
  // Coverage
  segments: string[];
  regions: string[];
  
  // Access
  isSubscriptionRequired: boolean;
  subscriptionCost?: number;
  subscriptionCurrency?: string;
  
  // Usage
  lastAccessed?: Date;
  usageCount: number;
  
  notes?: string;
  
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// SUMMARY & FILTERS
// ============================================================================

export interface MarketResearchSummary {
  totalTrends: number;
  trendsByCategory: Record<TrendCategory, number>;
  trendsByStatus: Record<TrendStatus, number>;
  activePESTLEFactors: number;
  pestleByCategory: Record<PESTLECategory, number>;
  totalReports: number;
  reportsThisMonth: number;
  topOpportunities: string[];
  topRisks: string[];
  latestIndicators: MarketIndicatorValue[];
}

export interface TrendFilters {
  category?: TrendCategory;
  status?: TrendStatus;
  businessImpact?: TrendBusinessImpact;
  segment?: string;
  isUgandaSpecific?: boolean;
  searchTerm?: string;
}

export interface ResearchReportFilters {
  reportType?: ResearchReportType;
  status?: ResearchReportStatus;
  segment?: string;
  author?: string;
  startDate?: Date;
  endDate?: Date;
}
