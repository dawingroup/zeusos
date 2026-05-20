/**
 * Holding - Individual investment position
 * 
 * Holdings represent discrete investment positions:
 * - Equity stakes in infrastructure assets
 * - Debt instruments (loans, bonds)
 * - Fund interests
 * - Hybrid/structured investments
 */

import { Timestamp } from 'firebase/firestore';
import type { Currency, MoneyAmount } from './portfolio';

export type HoldingType =
  | 'equity'
  | 'preferred_equity'
  | 'mezzanine'
  | 'senior_debt'
  | 'subordinated_debt'
  | 'convertible'
  | 'fund_interest'
  | 'co_investment'
  | 'warrant'
  | 'royalty'
  | 'hybrid'
  | 'other';

export type HoldingStatus =
  | 'pipeline'
  | 'committed'
  | 'partially_funded'
  | 'fully_funded'
  | 'active'
  | 'impaired'
  | 'workout'
  | 'partially_realized'
  | 'fully_realized'
  | 'written_off';

export type HoldingStage =
  | 'greenfield'
  | 'brownfield'
  | 'operational'
  | 'mature'
  | 'turnaround';

export type InstrumentType =
  | 'common_equity'
  | 'preferred_equity'
  | 'senior_loan'
  | 'subordinated_loan'
  | 'mezzanine_loan'
  | 'bond'
  | 'convertible_note'
  | 'convertible_preferred'
  | 'warrant'
  | 'lp_interest'
  | 'co_investment_interest'
  | 'royalty_stream'
  | 'structured_product'
  | 'other';

export type ValuationMethodology =
  | 'dcf'
  | 'comparable_companies'
  | 'precedent_transactions'
  | 'asset_based'
  | 'earnings_multiple'
  | 'revenue_multiple'
  | 'book_value'
  | 'replacement_cost'
  | 'recent_transaction'
  | 'quoted_price'
  | 'nav'
  | 'yield_based'
  | 'option_pricing'
  | 'independent_valuation';

export interface Holding {
  id: string;
  engagementId: string;
  portfolioId: string;
  
  holdingCode: string;
  name: string;
  shortName?: string;
  
  holdingType: HoldingType;
  status: HoldingStatus;
  stage: HoldingStage;
  
  underlyingAsset: UnderlyingAsset;
  investmentStructure: InvestmentStructure;
  ownership: OwnershipDetails;
  costBasis: CostBasis;
  currentValuation: HoldingValuation;
  incomeSummary: IncomeSummary;
  realizationSummary: RealizationSummary;
  returnMetrics: HoldingReturnMetrics;
  riskAssessment?: HoldingRiskAssessment;
  esgProfile?: HoldingESGProfile;
  keyDates: HoldingKeyDates;
  linkedEntities: HoldingLinkedEntities;
  
  documentIds?: string[];
  notes?: string;
  tags?: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

export interface UnderlyingAsset {
  assetName: string;
  assetType: 'infrastructure' | 'company' | 'project' | 'fund' | 'security' | 'other';
  
  sector: string;
  subSector?: string;
  
  country: string;
  region?: string;
  city?: string;
  
  infrastructureDetails?: {
    assetClass: string;
    capacity?: string;
    operationalSince?: Timestamp;
    usefulLife?: number;
    concessionExpiry?: Timestamp;
    offtaker?: string;
    counterparty?: string;
  };
  
  companyDetails?: {
    legalName: string;
    registrationNumber?: string;
    industry: string;
    employeeCount?: number;
    revenue?: MoneyAmount;
    ebitda?: MoneyAmount;
  };
  
  fundDetails?: {
    fundName: string;
    fundManager: string;
    vintage: number;
    fundSize?: MoneyAmount;
    strategy: string;
  };
  
  dealId?: string;
  projectId?: string;
}

export interface InvestmentStructure {
  instrumentType: InstrumentType;
  
  equityDetails?: {
    shareClass: string;
    sharesHeld: number;
    totalShares: number;
    ownershipPercentage: number;
    votingRights: number;
    preemptiveRights: boolean;
    tagAlong: boolean;
    dragAlong: boolean;
    antiDilution?: string;
    liquidationPreference?: number;
  };
  
  debtDetails?: {
    principalAmount: MoneyAmount;
    outstandingPrincipal: MoneyAmount;
    interestRate: number;
    interestType: 'fixed' | 'floating' | 'pik' | 'zero_coupon';
    floatingRateBasis?: string;
    paymentFrequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'bullet';
    maturityDate: Timestamp;
    amortization?: 'bullet' | 'amortizing' | 'balloon';
    seniority: 'senior_secured' | 'senior_unsecured' | 'subordinated' | 'mezzanine';
    collateral?: string[];
    covenants?: string[];
  };
  
  convertibleDetails?: {
    conversionPrice: number;
    conversionRatio: number;
    conversionDate?: Timestamp;
    conversionConditions?: string[];
  };
  
  fundInterestDetails?: {
    commitmentAmount: MoneyAmount;
    unfundedCommitment: MoneyAmount;
    lpInterest: number;
  };
  
  baseCurrency: Currency;
  specialRights?: string[];
  
  keyDocuments?: {
    type: string;
    documentId: string;
    description?: string;
  }[];
}

export interface OwnershipDetails {
  ownershipPercentage: number;
  fullyDilutedOwnership?: number;
  votingPercentage?: number;
  boardSeats?: number;
  observerRights?: boolean;
  controlRights: 'majority' | 'significant_influence' | 'minority' | 'passive';
  consolidationMethod: 'full' | 'equity' | 'cost' | 'fair_value';
  
  coInvestors?: {
    name: string;
    ownership: number;
    type: 'lead' | 'co_investor' | 'sponsor';
  }[];
}

export interface CostBasis {
  initialInvestment: MoneyAmount;
  initialInvestmentDate: Timestamp;
  followOnInvestments: MoneyAmount;
  totalCost: MoneyAmount;
  
  adjustments?: {
    type: 'write_down' | 'write_up' | 'impairment' | 'fx_adjustment' | 'fee_capitalization' | 'other';
    amount: MoneyAmount;
    date: Timestamp;
    reason: string;
  }[];
  
  adjustedCostBasis: MoneyAmount;
  
  transactionCosts?: {
    legalFees?: MoneyAmount;
    advisoryFees?: MoneyAmount;
    dueDiligenceCosts?: MoneyAmount;
    otherCosts?: MoneyAmount;
    total: MoneyAmount;
    capitalized: boolean;
  };
  
  unfundedCommitment?: MoneyAmount;
}

export interface HoldingValuation {
  fairValue: MoneyAmount;
  methodology: ValuationMethodology;
  fairValueLevel: 1 | 2 | 3;
  
  keyInputs?: ValuationInput[];
  
  multiplesUsed?: {
    evEbitda?: number;
    evRevenue?: number;
    priceEarnings?: number;
    priceBook?: number;
    yieldBased?: number;
  };
  
  discountRate?: number;
  
  adjustments?: {
    type: 'liquidity' | 'control' | 'minority' | 'marketability' | 'currency' | 'other';
    percentage: number;
    amount: MoneyAmount;
    rationale: string;
  }[];
  
  unrealizedGainLoss: MoneyAmount;
  unrealizedGainLossPercentage: number;
  
  valuationDate: Timestamp;
  confidenceLevel?: 'high' | 'medium' | 'low';
  
  thirdPartyValuation?: {
    provider: string;
    valuationDate: Timestamp;
    value: MoneyAmount;
    reportDocumentId?: string;
  };
  
  reviewStatus: 'draft' | 'reviewed' | 'approved';
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
}

export interface ValuationInput {
  name: string;
  value: string | number;
  source: string;
  asOfDate?: Timestamp;
  sensitivity?: 'high' | 'medium' | 'low';
}

export interface IncomeSummary {
  totalIncome: MoneyAmount;
  dividends: MoneyAmount;
  interest: MoneyAmount;
  fees: MoneyAmount;
  otherIncome: MoneyAmount;
  currentPeriodIncome: MoneyAmount;
  currentYield?: number;
  yieldOnFairValue?: number;
  lastDistributionDate?: Timestamp;
  lastDistributionAmount?: MoneyAmount;
  
  expectedDistributions?: {
    date: Timestamp;
    amount: MoneyAmount;
    type: 'dividend' | 'interest' | 'principal' | 'other';
    status: 'expected' | 'declared' | 'received';
  }[];
}

export interface RealizationSummary {
  totalRealizedProceeds: MoneyAmount;
  realizedGainLoss: MoneyAmount;
  realizedGainLossPercentage: number;
  
  realizations: {
    date: Timestamp;
    proceeds: MoneyAmount;
    costReturned: MoneyAmount;
    gainLoss: MoneyAmount;
    percentage: number;
    type: 'full_exit' | 'partial_exit' | 'dividend_recap' | 'refinancing' | 'other';
    buyer?: string;
    notes?: string;
  }[];
  
  remainingOwnership: number;
  remainingCost: MoneyAmount;
  remainingFairValue: MoneyAmount;
  isFullyRealized: boolean;
}

export interface HoldingReturnMetrics {
  grossIRR: number;
  netIRR?: number;
  grossMOIC: number;
  netMOIC?: number;
  totalValue: MoneyAmount;
  dpi: number;
  rvpi: number;
  tvpi: number;
  cashOnCash?: number;
  annualizedReturn?: number;
  holdingPeriodDays: number;
  holdingPeriodYears: number;
  asOfDate: Timestamp;
}

export interface HoldingRiskAssessment {
  overallRisk: 1 | 2 | 3 | 4 | 5;
  marketRisk: 1 | 2 | 3 | 4 | 5;
  creditRisk: 1 | 2 | 3 | 4 | 5;
  operationalRisk: 1 | 2 | 3 | 4 | 5;
  regulatoryRisk: 1 | 2 | 3 | 4 | 5;
  liquidityRisk: 1 | 2 | 3 | 4 | 5;
  countryRisk: 1 | 2 | 3 | 4 | 5;
  currencyRisk: 1 | 2 | 3 | 4 | 5;
  
  keyRisks?: {
    risk: string;
    likelihood: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation?: string;
  }[];
  
  onWatchList: boolean;
  watchListReason?: string;
  watchListDate?: Timestamp;
  
  assessmentDate: Timestamp;
  assessedBy: string;
}

export interface HoldingESGProfile {
  esgRating?: string;
  esgScore?: number;
  environmentalScore?: number;
  socialScore?: number;
  governanceScore?: number;
  impactClassification?: 'impact_first' | 'impact_integrated' | 'esg_screened' | 'not_applicable';
  sdgAlignment?: number[];
  
  carbonMetrics?: {
    scope1Emissions?: number;
    scope2Emissions?: number;
    carbonIntensity?: number;
    netZeroCommitment?: boolean;
    targetYear?: number;
  };
  
  keyFactors?: {
    factor: string;
    performance: 'strong' | 'adequate' | 'weak';
    trend: 'improving' | 'stable' | 'declining';
    notes?: string;
  }[];
  
  controversies?: string[];
  assessmentDate: Timestamp;
}

export interface HoldingKeyDates {
  initialInvestmentDate: Timestamp;
  lastFollowOnDate?: Timestamp;
  lastValuationDate: Timestamp;
  nextValuationDate?: Timestamp;
  lastIncomeDate?: Timestamp;
  nextExpectedIncomeDate?: Timestamp;
  maturityDate?: Timestamp;
  concessionExpiry?: Timestamp;
  putDate?: Timestamp;
  callDate?: Timestamp;
  expectedExitDate?: Timestamp;
  actualExitDate?: Timestamp;
  lastReviewDate?: Timestamp;
  nextReviewDate?: Timestamp;
}

export interface HoldingLinkedEntities {
  portfolioId: string;
  clientId: string;
  dealId?: string;
  projectId?: string;
  underlyingFundId?: string;
  relatedHoldingIds?: string[];
  transactionIds: string[];
  valuationHistoryIds: string[];
  incomeRecordIds: string[];
}

export interface HoldingStatusChange {
  id: string;
  holdingId: string;
  previousStatus: HoldingStatus;
  newStatus: HoldingStatus;
  reason: string;
  effectiveDate: Timestamp;
  changedBy: string;
  changedAt: Timestamp;
  notes?: string;
}

export type CreateHoldingInput = Omit<Holding, 
  'id' | 'holdingCode' | 'createdAt' | 'updatedAt' | 
  'returnMetrics' | 'linkedEntities' | 'incomeSummary' | 'realizationSummary'
> & {
  initialTransaction?: Partial<HoldingTransaction>;
};

export type UpdateHoldingInput = Partial<Omit<Holding, 
  'id' | 'holdingCode' | 'engagementId' | 'portfolioId' | 'createdAt' | 'createdBy'
>>;

export interface HoldingSummary {
  id: string;
  holdingCode: string;
  name: string;
  holdingType: HoldingType;
  status: HoldingStatus;
  sector: string;
  country: string;
  costBasis: MoneyAmount;
  fairValue: MoneyAmount;
  unrealizedGainLoss: MoneyAmount;
  grossIRR: number;
  grossMOIC: number;
  portfolioId: string;
  updatedAt?: Timestamp;
}

// Forward declaration for circular reference
export interface HoldingTransaction {
  id: string;
  holdingId: string;
  portfolioId: string;
  type: string;
  amount: MoneyAmount;
  effectiveDate: Timestamp;
}
