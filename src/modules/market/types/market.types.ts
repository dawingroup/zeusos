// ============================================================================
// MARKET INTELLIGENCE TYPES
// DawinOS v2.0 - Market Intelligence Module
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  CompetitorStatus,
  ThreatLevel,
  IntelligenceSource,
  SignalType,
  ImpactLevel,
  PESTLECategory,
  ConfidenceLevel,
  RelevanceLevel,
  Timeframe,
  IntelligenceStatus,
  ReportType,
  ReportStatus,
  ImportanceLevel,
} from '../constants/market.constants';

// Competitor Profile
export interface Competitor {
  id: string;
  companyId: string;
  
  // Basic Info
  name: string;
  legalName?: string;
  description: string;
  website?: string;
  
  // Classification
  status: CompetitorStatus;
  threatLevel: ThreatLevel;
  segments: string[];
  
  // Location
  headquarters: string;
  locations?: string[];
  ugandaPresence: boolean;
  
  // Size & Scale
  employeeCount?: number;
  estimatedRevenue?: number;
  revenueCurrency?: string;
  marketShare?: number;
  
  // Founding
  foundedYear?: number;
  founders?: string[];
  
  // Leadership
  ceoName?: string;
  keyPeople?: CompetitorKeyPerson[];
  
  // Products & Services
  products: CompetitorProduct[];
  
  // Competitive Position
  strengths: string[];
  weaknesses: string[];
  differentiators: string[];
  
  // Financials
  fundingTotal?: number;
  fundingRounds?: FundingRound[];
  
  // Social & Online
  socialMedia?: SocialMediaLinks;
  
  // Tracking
  lastUpdated: Timestamp;
  lastSignalDate?: Date;
  signalCount: number;
  
  // Notes
  notes?: string;
  tags?: string[];
  
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CompetitorKeyPerson {
  name: string;
  role: string;
  linkedIn?: string;
}

export interface CompetitorProduct {
  name: string;
  description: string;
  category: string;
  pricing?: string;
}

export interface FundingRound {
  date: Date;
  amount: number;
  type: string;
  investors?: string[];
}

export interface SocialMediaLinks {
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
}

// Market Signal
export interface MarketSignal {
  id: string;
  companyId: string;
  
  // Signal Details
  title: string;
  description: string;
  signalType: SignalType;
  
  // Source
  source: IntelligenceSource;
  sourceUrl?: string;
  sourceName?: string;
  
  // Related
  competitorId?: string;
  competitorName?: string;
  segments: string[];
  
  // Assessment
  impactLevel: ImpactLevel;
  confidence: ConfidenceLevel;
  
  // Timing
  signalDate: Date;
  
  // Response
  requiresAction: boolean;
  actionTaken?: string;
  actionDate?: Date;
  
  // Analysis
  implications?: string;
  recommendations?: string[];
  
  // Metadata
  addedBy: string;
  addedByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Intelligence Item (General)
export interface IntelligenceItem {
  id: string;
  companyId: string;
  
  // Content
  title: string;
  summary: string;
  content?: string;
  
  // Classification
  category: PESTLECategory | 'competitor' | 'market' | 'customer';
  segments: string[];
  
  // Source
  source: IntelligenceSource;
  sourceUrl?: string;
  
  // Assessment
  relevance: RelevanceLevel;
  timeframe: Timeframe;
  
  // Status
  status: IntelligenceStatus;
  
  // Related
  relatedCompetitorIds?: string[];
  
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// SWOT Analysis
export interface SWOTAnalysis {
  id: string;
  companyId: string;
  
  // Target
  targetType: 'company' | 'product' | 'competitor' | 'market';
  targetId?: string;
  targetName: string;
  
  // Analysis
  strengths: SWOTItem[];
  weaknesses: SWOTItem[];
  opportunities: SWOTItem[];
  threats: SWOTItem[];
  
  // Summary
  overallAssessment?: string;
  strategicPriorities?: string[];
  
  // Metadata
  analysisDate: Date;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SWOTItem {
  id: string;
  description: string;
  importance: ImportanceLevel;
  evidence?: string;
  relatedItems?: string[];
}

// Market Report
export interface MarketReport {
  id: string;
  companyId: string;
  
  // Report Details
  title: string;
  reportType: ReportType;
  
  // Coverage
  segments: string[];
  period: {
    start: Date;
    end: Date;
  };
  
  // Content
  executiveSummary: string;
  sections: ReportSection[];
  
  // Key Findings
  keyFindings: string[];
  recommendations: string[];
  
  // Metadata
  status: ReportStatus;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
}

export interface ReportSection {
  title: string;
  content: string;
  charts?: string[];
}

// Competitive Comparison
export interface CompetitiveComparison {
  competitorId: string;
  competitorName: string;
  
  dimensions: ComparisonDimension[];
  
  overallPosition: 'ahead' | 'even' | 'behind';
  keyDifferentiators: string[];
  vulnerabilities: string[];
}

export interface ComparisonDimension {
  dimension: string;
  ourScore: number;
  theirScore: number;
  notes?: string;
}

// Market Share Data
export interface MarketShareData {
  segment: string;
  period: Date;
  
  players: MarketSharePlayer[];
  
  totalMarketSize?: number;
  currency?: string;
}

export interface MarketSharePlayer {
  name: string;
  share: number;
  trend: 'up' | 'down' | 'stable';
}

// Dashboard Summary
export interface MarketIntelligenceSummary {
  totalCompetitors: number;
  competitorsByThreat: Record<ThreatLevel, number>;
  recentSignals: number;
  signalsByType: Partial<Record<SignalType, number>>;
  signalsByImpact: Record<ImpactLevel, number>;
  topCompetitorUpdates: CompetitorUpdate[];
}

export interface CompetitorUpdate {
  competitorId: string;
  competitorName: string;
  signalCount: number;
  lastSignal: Date;
}

// Filters
export interface CompetitorFilters {
  status?: CompetitorStatus;
  threatLevel?: ThreatLevel;
  segments?: string[];
  ugandaOnly?: boolean;
  searchTerm?: string;
}

export interface SignalFilters {
  competitorId?: string;
  signalTypes?: SignalType[];
  impactLevel?: ImpactLevel;
  source?: IntelligenceSource;
  dateFrom?: Date;
  dateTo?: Date;
  requiresAction?: boolean;
}

export interface IntelligenceFilters {
  category?: PESTLECategory | 'competitor' | 'market' | 'customer';
  segments?: string[];
  relevance?: RelevanceLevel;
  status?: IntelligenceStatus;
  dateFrom?: Date;
  dateTo?: Date;
}
