// ============================================================================
// CAPITAL HUB TYPES
// ZeusOS v2.0 — Capital seeking, readiness, application tracking & facilities
// ============================================================================

import { Timestamp } from 'firebase/firestore';

// ----------------------------------------------------------------------------
// CAPITAL NEED — Identified financing requirements
// ----------------------------------------------------------------------------

export type CapitalNeedType =
  | 'working_capital'
  | 'asset_acquisition'
  | 'growth'
  | 'seasonal'
  | 'debt_refinancing'
  | 'emergency';

export type CapitalNeedUrgency = 'immediate' | 'short_term' | 'medium_term' | 'long_term';

export type CapitalNeedStatus =
  | 'identified'
  | 'analyzing'
  | 'seeking'
  | 'applied'
  | 'resolved'
  | 'deferred';

export type DetectionSource =
  | 'cashflow_gap'
  | 'asset_plan'
  | 'liability_pressure'
  | 'growth_plan';

export interface AffordabilityAnalysis {
  monthlyCapacity: number;
  maxTermMonths: number;
  maxBorrowingAmount: number;
  debtServiceRatio: number;
}

export interface CashFlowGapDetails {
  gapStartDate: string;
  gapEndDate: string;
  gapAmount: number;
}

export interface CapitalNeed {
  id: string;
  companyId: string;
  type: CapitalNeedType;
  title: string;
  description: string;
  amountRequired: number;
  currency: 'UGX' | 'USD';
  urgency: CapitalNeedUrgency;
  targetDate?: Timestamp;
  status: CapitalNeedStatus;

  // Auto-detection metadata
  detectedBy: 'system' | 'manual';
  detectionSource?: DetectionSource;
  cashFlowGapDetails?: CashFlowGapDetails;

  // Linked application(s)
  applicationIds: string[];

  // Affordability analysis
  affordability?: AffordabilityAnalysis;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface CapitalNeedFilters {
  type?: CapitalNeedType;
  urgency?: CapitalNeedUrgency;
  status?: CapitalNeedStatus;
  detectedBy?: 'system' | 'manual';
  minAmount?: number;
  maxAmount?: number;
}

// ----------------------------------------------------------------------------
// CAPITAL PRODUCT — Available financing products catalog
// ----------------------------------------------------------------------------

export type CapitalProductType =
  | 'term_loan'
  | 'overdraft'
  | 'line_of_credit'
  | 'asset_finance'
  | 'trade_finance'
  | 'invoice_discounting'
  | 'factoring'
  | 'lpo_financing'
  | 'lease'
  | 'hire_purchase'
  | 'equity'
  | 'convertible_note'
  | 'grant'
  | 'dfi_loan'
  | 'supplier_credit'
  | 'microfinance';

export type ProviderType =
  | 'bank'
  | 'dfi'
  | 'government'
  | 'investor'
  | 'supplier'
  | 'microfinance'
  | 'fintech';

export type InterestType = 'fixed' | 'variable' | 'reducing_balance';

export type ProductStatus = 'active' | 'inactive' | 'expired';

export interface ProductRequirement {
  document: string;
  description?: string;
  mandatory: boolean;
}

export interface CapitalProduct {
  id: string;
  companyId: string;
  name: string;
  provider: string;
  providerType: ProviderType;
  productType: CapitalProductType;

  // Terms
  minAmount?: number;
  maxAmount?: number;
  currency: 'UGX' | 'USD';
  interestRate?: number;
  interestType?: InterestType;
  tenorMinMonths?: number;
  tenorMaxMonths?: number;
  processingFee?: number;
  collateralRequired: boolean;
  collateralTypes?: string[];

  // Requirements
  requirements: ProductRequirement[];

  // Eligibility criteria
  minRevenue?: number;
  minYearsInBusiness?: number;
  sectors?: string[];

  notes?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;

  status: ProductStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CapitalProductFilters {
  productType?: CapitalProductType;
  providerType?: ProviderType;
  status?: ProductStatus;
  collateralRequired?: boolean;
  minAmount?: number;
  maxAmount?: number;
  searchTerm?: string;
}

// ----------------------------------------------------------------------------
// CAPITAL APPLICATION — Pipeline for tracking applications
// ----------------------------------------------------------------------------

export type ApplicationStage =
  | 'identifying'
  | 'preparing'
  | 'submitted'
  | 'under_review'
  | 'additional_info'
  | 'approved'
  | 'disbursing'
  | 'completed'
  | 'declined'
  | 'withdrawn';

export type ApplicationOutcome = 'approved' | 'declined' | 'withdrawn' | 'expired';

export interface StageChange {
  from: string;
  to: string;
  changedAt: Timestamp;
  changedBy: string;
  notes?: string;
}

export interface ApplicationDocument {
  id: string;
  name: string;
  category: string;
  url?: string;
  status: 'pending' | 'uploaded' | 'submitted' | 'accepted' | 'rejected';
  uploadedAt?: Timestamp;
  notes?: string;
}

export interface ApplicationCommunication {
  id: string;
  date: Timestamp;
  type: 'call' | 'email' | 'meeting' | 'letter' | 'portal';
  summary: string;
  contactPerson?: string;
  outcome?: string;
  followUpDate?: Timestamp;
  createdBy: string;
}

export interface FacilityTerms {
  interestRate: number;
  interestType: InterestType;
  tenorMonths: number;
  repaymentFrequency: 'monthly' | 'quarterly' | 'semi_annually' | 'annually' | 'bullet';
  processingFee?: number;
  insuranceFee?: number;
  collateral?: string[];
  gracePeriodMonths?: number;
}

export interface CapitalApplication {
  id: string;
  companyId: string;
  needId?: string;
  productId?: string;

  provider: string;
  productType: CapitalProductType;
  amountRequested: number;
  currency: 'UGX' | 'USD';

  // Pipeline stage
  stage: ApplicationStage;
  stageHistory: StageChange[];

  // Terms
  proposedTerms?: FacilityTerms;
  approvedTerms?: FacilityTerms;

  // Documents
  documents: ApplicationDocument[];

  // Communication log
  communications: ApplicationCommunication[];

  // Key dates
  submittedDate?: Timestamp;
  expectedDecisionDate?: Timestamp;
  approvalDate?: Timestamp;
  disbursementDate?: Timestamp;

  // Outcome
  outcome?: ApplicationOutcome;
  declineReason?: string;

  assignedTo?: string;
  notes?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface CapitalApplicationFilters {
  stage?: ApplicationStage;
  productType?: CapitalProductType;
  outcome?: ApplicationOutcome;
  provider?: string;
  minAmount?: number;
  maxAmount?: number;
}

// ----------------------------------------------------------------------------
// CAPITAL FACILITY — Active loans, lines of credit, facilities
// ----------------------------------------------------------------------------

export type FacilityStatus = 'active' | 'fully_repaid' | 'defaulted' | 'restructured' | 'expired';

export interface RepaymentEntry {
  id: string;
  date: Timestamp;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  status: 'upcoming' | 'paid' | 'overdue' | 'partial';
  amountPaid?: number;
  paidDate?: Timestamp;
}

export interface Covenant {
  name: string;
  metric: string;
  threshold: number;
  operator: 'gte' | 'lte' | 'eq';
  currentValue?: number;
  isCompliant?: boolean;
  lastChecked?: Timestamp;
}

export interface CapitalFacility {
  id: string;
  companyId: string;
  applicationId?: string;

  provider: string;
  productType: CapitalProductType;
  facilityName: string;
  accountReference?: string;

  // Amounts
  facilityLimit: number;
  amountDisbursed: number;
  amountRepaid: number;
  outstandingBalance: number;
  currency: 'UGX' | 'USD';

  // Terms
  terms: FacilityTerms;

  // For revolving facilities
  isRevolving: boolean;
  currentUtilization?: number;
  availableBalance?: number;

  // Repayment
  repaymentSchedule: RepaymentEntry[];
  nextPaymentDate?: Timestamp;
  nextPaymentAmount?: number;

  // Covenants
  covenants?: Covenant[];

  // Status
  status: FacilityStatus;
  startDate: Timestamp;
  maturityDate: Timestamp;

  // Finance module link
  liabilityId?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CapitalFacilityFilters {
  status?: FacilityStatus;
  productType?: CapitalProductType;
  provider?: string;
  isRevolving?: boolean;
}

// ----------------------------------------------------------------------------
// READINESS ASSESSMENT — Business readiness to apply for capital
// ----------------------------------------------------------------------------

export type ChecklistItemStatus = 'complete' | 'partial' | 'missing' | 'expired' | 'not_applicable';

export interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  status: ChecklistItemStatus;
  expiryDate?: Timestamp;
  notes?: string;
  documentUrl?: string;
}

export interface FinancialHealthMetrics {
  monthlyRevenue: number;
  revenueGrowthPercent: number;
  profitMarginPercent: number;
  currentRatio: number;
  debtToEquityRatio: number;
  debtServiceCoverageRatio: number;
  cashRunwayDays: number;
  averageDailyBurn: number;
}

export interface ReadinessAssessment {
  id: string;
  companyId: string;
  assessedAt: Timestamp;

  overallScore: number;

  financialHealth: {
    score: number;
    metrics: FinancialHealthMetrics;
  };

  documentReadiness: {
    score: number;
    items: ChecklistItem[];
  };

  complianceStatus: {
    score: number;
    items: ChecklistItem[];
  };
}

// ----------------------------------------------------------------------------
// DASHBOARD AGGREGATION
// ----------------------------------------------------------------------------

export interface CapitalDashboardData {
  readinessScore: number;
  activeNeeds: CapitalNeed[];
  activeFacilities: CapitalFacility[];
  pendingApplications: CapitalApplication[];
  totalOutstandingDebt: number;
  totalFacilityLimit: number;
  totalUtilized: number;
  upcomingRepayments: RepaymentEntry[];
  cashRunwayDays: number;
}

// ----------------------------------------------------------------------------
// PROVIDER RESEARCH — AI-powered capital provider discovery & enrichment
// ----------------------------------------------------------------------------

export interface ProviderSearchResultProduct {
  name: string;
  productType: CapitalProductType;
  description?: string;
  minAmount?: number;
  maxAmount?: number;
  currency: 'UGX' | 'USD';
  interestRate?: number;
  interestType?: InterestType;
  tenorMinMonths?: number;
  tenorMaxMonths?: number;
  processingFee?: number;
  collateralRequired: boolean;
  collateralTypes?: string[];
  requirements: string[];
  eligibility?: string;
}

export interface ProviderSearchResult {
  name: string;
  providerType: ProviderType;
  website?: string;
  description?: string;
  specializations?: string[];
  products: ProviderSearchResultProduct[];
  contactInfo?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  sectors?: string[];
  minRevenue?: number;
  minYearsInBusiness?: number;
}

export interface ProviderSearchResponse {
  providers: ProviderSearchResult[];
  sources: { url: string; title: string }[];
  searchQueries: string[];
}

export interface EnrichedProviderProfile {
  fullName: string;
  providerType: ProviderType;
  website?: string;
  description?: string;
  yearEstablished?: number;
  regulatedBy?: string;
  headquarters?: {
    address: string;
    city: string;
    country: string;
  };
  branches?: { name: string; city: string; phone?: string }[];
  contactInfo?: {
    generalPhone?: string;
    generalEmail?: string;
    customerCarePhone?: string;
    smeUnit?: {
      contactPerson?: string;
      phone?: string;
      email?: string;
    };
  };
  specializations?: string[];
  sectors?: string[];
  products: EnrichedProductDetail[];
  recentNews?: { title: string; date: string; summary: string; url?: string }[];
}

export interface EnrichedProductDetail {
  name: string;
  productType: CapitalProductType;
  description?: string;
  minAmount?: number;
  maxAmount?: number;
  currency: 'UGX' | 'USD';
  interestRate?: number;
  interestType?: InterestType;
  tenorMinMonths?: number;
  tenorMaxMonths?: number;
  processingFee?: number;
  collateralRequired: boolean;
  collateralTypes?: string[];
  requirements: ProductRequirement[];
  eligibilityCriteria?: string;
  applicationProcess?: string;
  typicalTimeline?: string;
  successFactors?: string[];
}

export interface ProviderMatchResult {
  providerName: string;
  productName: string;
  matchScore: number;
  strengths: string[];
  gaps: string[];
  readinessActions: string[];
  estimatedTimeline?: string;
  recommendation: string;
}

export interface ProviderMatchResponse {
  matches: ProviderMatchResult[];
  overallRecommendation: string;
  preparationActions: string[];
  alternativeStrategies: string[];
}
