/**
 * Investment Mandate - Client allocation constraints
 */

import { Timestamp } from 'firebase/firestore';

export type MandateType =
  | 'discretionary'       // Full discretion to invest
  | 'advisory'            // Recommendations, client approves
  | 'execution_only'      // Client directs, we execute
  | 'co_investment'       // Deal-by-deal co-investment
  | 'fund_investment';    // Commitment to fund vehicle

export type MandateStatus =
  | 'draft'
  | 'pending_approval'
  | 'active'
  | 'suspended'
  | 'expired'
  | 'terminated';

export type InstrumentType =
  | 'common_equity'
  | 'preferred_equity'
  | 'convertible'
  | 'senior_debt'
  | 'subordinated_debt'
  | 'mezzanine'
  | 'guarantee'
  | 'grant';

export type ReportType =
  | 'capital_account'
  | 'portfolio_summary'
  | 'performance_report'
  | 'valuation_report'
  | 'esg_report'
  | 'risk_report'
  | 'compliance_report'
  | 'tax_report'
  | 'audit_report';

export type DealStage = 'greenfield' | 'brownfield' | 'operational';

export interface MoneyAmount {
  amount: number;
  currency: string;
}

export interface DateRange {
  start: Timestamp;
  end: Timestamp;
}

export interface InvestmentMandate {
  id: string;
  clientId: string;
  
  mandateCode: string;
  name: string;
  description?: string;
  
  type: MandateType;
  status: MandateStatus;
  
  constraints: MandateConstraints;
  
  commitmentAmount: MoneyAmount;
  deployedAmount: MoneyAmount;
  remainingCommitment: MoneyAmount;
  
  investmentPeriod: DateRange;
  holdPeriod?: DateRange;
  
  feeStructure: FeeStructure;
  approvalProcess: ApprovalProcess;
  reportingRequirements: ReportingRequirement[];
  
  agreementDocumentId?: string;
  sideLetterIds?: string[];
  portfolioIds: string[];
  
  effectiveDate: Timestamp;
  expiryDate?: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  approvedAt?: Timestamp;
  approvedBy?: string;
}

export interface MandateConstraints {
  assetAllocation: AssetAllocationConstraint[];
  geographyConstraints: GeographyConstraint;
  sectorConstraints: SectorConstraint;
  investmentSizeConstraints: InvestmentSizeConstraint;
  riskConstraints: RiskConstraint;
  esgConstraints?: ESGConstraint;
  instrumentConstraints?: InstrumentConstraint;
  concentrationLimits: ConcentrationLimit[];
  currencyConstraints?: CurrencyConstraint;
  liquidityConstraints?: LiquidityConstraint;
}

export interface AssetAllocationConstraint {
  assetClass: string;
  targetPercentage: number;
  minPercentage: number;
  maxPercentage: number;
}

export interface GeographyConstraint {
  allowedCountries: string[];
  excludedCountries: string[];
  allowedRegions?: string[];
  excludedRegions?: string[];
  maxSingleCountry?: number;
  developedMarketsMax?: number;
  emergingMarketsMax?: number;
}

export interface SectorConstraint {
  allowedSectors: string[];
  excludedSectors: string[];
  targetAllocations?: SectorAllocation[];
  maxSingleSector?: number;
}

export interface SectorAllocation {
  sector: string;
  targetPercentage: number;
  minPercentage?: number;
  maxPercentage?: number;
}

export interface InvestmentSizeConstraint {
  minDealSize: MoneyAmount;
  maxDealSize: MoneyAmount;
  maxSingleInvestment: MoneyAmount;
  maxSingleInvestmentPercent?: number;
}

export interface RiskConstraint {
  maxRiskRating: number;
  allowedStages: DealStage[];
  maxLeverageRatio?: number;
  minDSCR?: number;
  minIRRThreshold?: number;
}

export interface ESGConstraint {
  mandatoryScreening: boolean;
  exclusions: string[];
  minimumESGScore?: number;
  impactRequirements?: boolean;
  climateAligned?: boolean;
  articlesClassification?: 'article_6' | 'article_8' | 'article_9';
}

export interface InstrumentConstraint {
  allowedInstruments: InstrumentType[];
  excludedInstruments?: InstrumentType[];
  maxEquityPercent?: number;
  maxDebtPercent?: number;
  subordinationLimits?: SubordinationLimit[];
}

export interface SubordinationLimit {
  level: 'senior' | 'mezzanine' | 'subordinated' | 'equity';
  maxPercentage: number;
}

export interface ConcentrationLimit {
  type: 'single_asset' | 'sector' | 'geography' | 'counterparty';
  maxPercentage: number;
  scope?: string;
}

export interface CurrencyConstraint {
  baseCurrency: string;
  allowedCurrencies: string[];
  maxCurrencyMismatch?: number;
  hedgingRequired?: boolean;
}

export interface LiquidityConstraint {
  maxIlliquidPercent: number;
  minLiquidReserve: number;
  maxDrawdownPace?: number;
  distributionRequirements?: DistributionRequirement;
}

export interface DistributionRequirement {
  minimumYield?: number;
  frequency: 'quarterly' | 'semi_annual' | 'annual';
  reinvestmentAllowed: boolean;
}

export interface FeeStructure {
  managementFee: FeeComponent;
  performanceFee?: PerformanceFee;
  transactionFees?: TransactionFee[];
  otherFees?: OtherFee[];
  feeOffset?: FeeOffset;
}

export interface FeeComponent {
  rate: number;
  basis: 'committed' | 'deployed' | 'nav';
  frequency: 'quarterly' | 'semi_annual' | 'annual';
  calculationMethod: 'simple' | 'tiered';
  tiers?: FeeTier[];
}

export interface FeeTier {
  threshold: number;
  rate: number;
}

export interface PerformanceFee {
  rate: number;
  hurdleRate: number;
  hurdleType: 'hard' | 'soft';
  catchUp: number;
  crystallization: 'deal_by_deal' | 'whole_fund';
  clawback: boolean;
}

export interface TransactionFee {
  type: 'acquisition' | 'disposition' | 'financing';
  rate: number;
  cap?: number;
}

export interface OtherFee {
  name: string;
  amount: number;
  frequency: string;
}

export interface FeeOffset {
  offsetPercentage: number;
  offsetTypes: string[];
}

export interface ApprovalProcess {
  type: 'automatic' | 'notification' | 'consent';
  thresholds?: ApprovalThreshold[];
  approvers?: string[];
  timeframe?: number;
  defaultDecision?: 'approved' | 'rejected';
}

export interface ApprovalThreshold {
  condition: string;
  threshold: number;
  requiresApproval: boolean;
}

export interface ReportingRequirement {
  type: ReportType;
  frequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'on_demand';
  format: 'pdf' | 'excel' | 'portal';
  deliveryMethod: 'email' | 'portal' | 'both';
  customTemplate?: string;
}
