// ============================================================================
// COMPETITOR TYPES
// ZeusOS v2.0 - Market Intelligence Module
// TypeScript interfaces for Competitor Analysis
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  CompetitorType,
  ThreatLevel,
  CompetitorStatus,
  Industry,
  Geography,
  CompanySize,
  SWOTCategory,
  SWOTFactorType,
  CompetitiveMoveType,
  ImpactSignificance,
  WinLossOutcome,
  WinLossReason,
  IntelligenceSource,
  PositioningDimension,
  AnalysisPeriod,
} from '../constants/competitor.constants';
import type { MarketIntelSubsidiaryId } from '../constants/marketIntelVocabulary';

// ----------------------------------------------------------------------------
// CORE COMPETITOR TYPES
// ----------------------------------------------------------------------------

export interface Competitor {
  id: string;
  
  // Basic Information
  name: string;
  legalName?: string;
  description: string;
  website?: string;
  logoUrl?: string;
  
  // Classification
  type: CompetitorType;
  status: CompetitorStatus;
  threatLevel: ThreatLevel;
  industries: Industry[];
  geographies: Geography[];
  companySize: CompanySize;
  
  // Financial Information
  estimatedRevenue?: number;
  revenueCurrency: string;
  revenueYear?: number;
  estimatedMarketShare?: number;
  fundingRaised?: number;
  employeeCount?: number;
  
  // Contact & Leadership
  headquarters: {
    address?: string;
    city: string;
    country: string;
    region?: string;
  };
  keyExecutives: KeyExecutive[];
  
  // Business Details
  foundedYear?: number;
  products: string[];
  services: string[];
  customers: string[];
  partners: string[];
  
  // Competitive Position
  positioning: CompetitorPositioning;
  
  // Monitoring
  monitoringFrequency: 'weekly' | 'monthly' | 'quarterly';
  lastAnalyzedAt?: Timestamp;
  nextAnalysisAt?: Timestamp;
  assignedAnalysts: string[];
  
  // Zeus context — the brands this competitor competes with (MARKET_INTEL_SUBSIDIARY_IDS, audit 2026-10 D-1)
  subsidiariesCompeting: MarketIntelSubsidiaryId[];
  overlapAreas: string[];
  
  // Social / Digital Presence
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    website?: string;
  };
  
  // Intelligence
  intelligenceSources: IntelligenceItem[];
  tags: string[];
  notes?: string;

  // Archive (audit 2026-10, D-3) — the client never hard-deletes; lists hide archived rows.
  archived?: boolean;
  archivedAt?: Timestamp | null;
  archivedBy?: string | null;
  archivedByName?: string | null;
  archiveReason?: string | null;
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface KeyExecutive {
  id: string;
  name: string;
  title: string;
  linkedInUrl?: string;
  email?: string;
  phone?: string;
  previousCompanies?: string[];
  notes?: string;
}

export interface CompetitorPositioning {
  positionScores: PositionScore[];
  valuePropositon: string;
  targetSegments: string[];
  differentiators: string[];
  weaknessAreas: string[];
}

export interface PositionScore {
  dimension: PositioningDimension;
  score: number;
  notes?: string;
}

export interface IntelligenceItem {
  id: string;
  source: IntelligenceSource;
  sourceUrl?: string;
  sourceName?: string;
  title: string;
  summary: string;
  collectedAt: Timestamp;
  collectedBy: string;
  reliability: number;
  tags: string[];
}

// ----------------------------------------------------------------------------
// SWOT ANALYSIS
// ----------------------------------------------------------------------------

export interface SWOTAnalysis {
  id: string;
  competitorId: string;
  competitorName: string;
  
  // Analysis Metadata
  analysisDate: Timestamp;
  analysisPeriod: AnalysisPeriod;
  analyzedBy: string;
  version: number;
  
  // SWOT Factors
  strengths: SWOTFactor[];
  weaknesses: SWOTFactor[];
  opportunities: SWOTFactor[];
  threats: SWOTFactor[];
  
  // Summary Scores
  overallAssessment: string;
  strategicImplications: string[];
  recommendedActions: string[];
  
  // Comparison
  comparisonToUs: CompetitorComparison[];
  
  // Metadata
  status: 'draft' | 'review' | 'approved' | 'archived';
  approvedBy?: string;
  approvedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SWOTFactor {
  id: string;
  category: SWOTCategory;
  factorType: SWOTFactorType;
  description: string;
  impact: number;
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  confidence: number;
  sources: string[];
  notes?: string;
}

export interface CompetitorComparison {
  dimension: string;
  competitorScore: number;
  ourScore: number;
  gap: number;
  assessment: 'advantage' | 'parity' | 'disadvantage';
  notes?: string;
}

// ----------------------------------------------------------------------------
// COMPETITIVE MOVES
// ----------------------------------------------------------------------------

export interface CompetitiveMove {
  id: string;
  competitorId: string;
  competitorName: string;
  
  // Move Details
  moveType: CompetitiveMoveType;
  title: string;
  description: string;
  dateObserved: Timestamp;
  dateAnnounced?: Timestamp;
  effectiveDate?: Timestamp;
  
  // Impact Assessment
  impactSignificance: ImpactSignificance;
  impactedMarkets: Geography[];
  impactedIndustries: Industry[];
  impactedSubsidiaries: MarketIntelSubsidiaryId[];
  
  // Analysis
  ourResponse?: string;
  responseDeadline?: Timestamp;
  strategicImplications: string[];
  
  // Intelligence
  sources: IntelligenceItem[];
  confidence: number;
  verified: boolean;
  
  // Tracking
  status: 'identified' | 'analyzing' | 'responded' | 'monitoring' | 'closed';
  assignedTo: string[];
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// WIN/LOSS ANALYSIS
// ----------------------------------------------------------------------------

export interface WinLossRecord {
  id: string;
  
  // Opportunity Details
  opportunityName: string;
  opportunityId?: string;
  clientName: string;
  projectType: string;
  estimatedValue: number;
  currency: string;
  
  // Competition
  competitorId?: string;
  competitorName: string;
  additionalCompetitors: string[];
  
  // Outcome
  outcome: WinLossOutcome;
  decisionDate: Timestamp;
  
  // Analysis
  primaryReasons: WinLossReason[];
  secondaryReasons: WinLossReason[];
  detailedAnalysis: string;
  
  // Scoring
  ourPricing?: number;
  competitorPricing?: number;
  priceDifferential?: number;
  
  // Feedback
  clientFeedback?: string;
  internalLessons: string[];
  improvementActions: string[];
  
  // Context
  bidTeam: string[];
  geographies: Geography[];
  industries: Industry[];
  
  // Related
  subsidiaryId: MarketIntelSubsidiaryId;
  dealStage: string;
  bidSubmissionDate?: Timestamp;
  
  // Metadata
  recordedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// COMPETITOR ANALYTICS
// ----------------------------------------------------------------------------

export interface CompetitorAnalytics {
  // Overview
  totalCompetitors: number;
  activeCompetitors: number;
  byType: Record<CompetitorType, number>;
  byThreatLevel: Record<ThreatLevel, number>;
  byIndustry: Record<Industry, number>;
  byGeography: Record<Geography, number>;
  
  // Trends
  newCompetitors: number;
  exitedCompetitors: number;
  threatLevelChanges: ThreatLevelChange[];
  
  // Competitive Moves
  recentMoves: number;
  movesByType: Record<CompetitiveMoveType, number>;
  pendingResponses: number;
  
  // Win/Loss
  totalDeals: number;
  winRate: number;
  lossRate: number;
  topCompetitorsBeaten: CompetitorWinLoss[];
  topCompetitorsLostTo: CompetitorWinLoss[];
  
  // Coverage
  analysisUpToDate: number;
  analysisOverdue: number;
  
  // Period
  periodStart: Timestamp;
  periodEnd: Timestamp;
}

export interface ThreatLevelChange {
  competitorId: string;
  competitorName: string;
  previousLevel: ThreatLevel;
  newLevel: ThreatLevel;
  changedAt: Timestamp;
  reason: string;
}

export interface CompetitorWinLoss {
  competitorId?: string;
  competitorName: string;
  deals: number;
  wins: number;
  losses: number;
  winRate: number;
  totalValue: number;
}

// ----------------------------------------------------------------------------
// FORM INPUT TYPES
// ----------------------------------------------------------------------------

export interface CompetitorFormInput {
  name: string;
  legalName?: string;
  description: string;
  website?: string;
  type: CompetitorType;
  threatLevel: ThreatLevel;
  industries: Industry[];
  geographies: Geography[];
  companySize: CompanySize;
  estimatedRevenue?: number;
  revenueCurrency: string;
  employeeCount?: number;
  headquarters: {
    city: string;
    country: string;
    address?: string;
  };
  foundedYear?: number;
  products: string[];
  services: string[];
  subsidiariesCompeting: MarketIntelSubsidiaryId[];
  monitoringFrequency: 'weekly' | 'monthly' | 'quarterly';
}

export interface SWOTFormInput {
  competitorId: string;
  analysisPeriod: AnalysisPeriod;
  strengths: SWOTFactorInput[];
  weaknesses: SWOTFactorInput[];
  opportunities: SWOTFactorInput[];
  threats: SWOTFactorInput[];
  overallAssessment: string;
  strategicImplications: string[];
  recommendedActions: string[];
}

export interface SWOTFactorInput {
  factorType: SWOTFactorType;
  description: string;
  impact: number;
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  confidence: number;
}

export interface CompetitiveMoveFormInput {
  competitorId: string;
  moveType: CompetitiveMoveType;
  title: string;
  description: string;
  dateObserved: Date;
  impactSignificance: ImpactSignificance;
  impactedMarkets: Geography[];
  impactedIndustries: Industry[];
  impactedSubsidiaries: MarketIntelSubsidiaryId[];
  strategicImplications: string[];
}

export interface WinLossFormInput {
  opportunityName: string;
  clientName: string;
  projectType: string;
  estimatedValue: number;
  currency: string;
  competitorName: string;
  competitorId?: string;
  additionalCompetitors: string[];
  outcome: WinLossOutcome;
  decisionDate: Date;
  primaryReasons: WinLossReason[];
  secondaryReasons: WinLossReason[];
  detailedAnalysis: string;
  clientFeedback?: string;
  internalLessons: string[];
  improvementActions: string[];
  subsidiaryId: MarketIntelSubsidiaryId;
}

// ----------------------------------------------------------------------------
// FILTER TYPES
// ----------------------------------------------------------------------------

export interface CompetitorFilters {
  type?: CompetitorType;
  threatLevel?: ThreatLevel;
  industry?: Industry;
  geography?: Geography;
  status?: CompetitorStatus;
  subsidiaryId?: MarketIntelSubsidiaryId;
  searchTerm?: string;
  /** Archived rows are hidden unless asked for (D-3). */
  includeArchived?: boolean;
}

export interface MoveFilters {
  competitorId?: string;
  moveType?: CompetitiveMoveType;
  status?: CompetitiveMove['status'];
  impactedSubsidiary?: MarketIntelSubsidiaryId;
  startDate?: Date;
  endDate?: Date;
}

export interface WinLossFilters {
  outcome?: WinLossOutcome;
  competitorId?: string;
  subsidiaryId?: MarketIntelSubsidiaryId;
  startDate?: Date;
  endDate?: Date;
}
