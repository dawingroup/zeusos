/**
 * Portfolio - Managed investment vehicle
 * 
 * Portfolios represent collections of infrastructure investments:
 * - Managed on behalf of advisory clients
 * - Governed by investment mandates
 * - Track allocations, NAV, and performance
 */

import { Timestamp } from 'firebase/firestore';

export type PortfolioType =
  | 'fund'
  | 'sma'
  | 'co_investment'
  | 'fund_of_funds'
  | 'direct'
  | 'advisory'
  | 'model';

export type PortfolioStatus =
  | 'formation'
  | 'fundraising'
  | 'investing'
  | 'fully_invested'
  | 'harvesting'
  | 'wind_down'
  | 'closed'
  | 'terminated';

export type PortfolioStrategy =
  | 'core'
  | 'core_plus'
  | 'value_add'
  | 'opportunistic'
  | 'greenfield'
  | 'brownfield'
  | 'distressed'
  | 'sector_specific'
  | 'diversified';

export type PortfolioStructure =
  | 'open_ended'
  | 'closed_ended'
  | 'evergreen'
  | 'hybrid';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'KES' | 'UGX' | 'TZS' | 'RWF' | 'ETB';

export interface MoneyAmount {
  amount: number;
  currency: Currency;
}

export interface Portfolio {
  id: string;
  engagementId: string;
  
  portfolioCode: string;
  name: string;
  shortName?: string;
  
  portfolioType: PortfolioType;
  status: PortfolioStatus;
  strategy: PortfolioStrategy;
  structure: PortfolioStructure;
  
  clientId: string;
  mandateId?: string;
  
  legalStructure?: PortfolioLegalStructure;
  investmentFocus: PortfolioInvestmentFocus;
  capitalStructure: PortfolioCapitalStructure;
  allocations: PortfolioAllocations;
  currentNAV: PortfolioNAV;
  valuationPolicy: ValuationPolicy;
  cashPosition: CashPosition;
  performanceSummary: PerformanceSummary;
  lifecycle: PortfolioLifecycle;
  feeStructure?: PortfolioFeeStructure;
  holdingsSummary: HoldingsSummary;
  linkedEntities: PortfolioLinkedEntities;
  reportingConfig: ReportingConfig;
  
  notes?: string;
  tags?: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

export interface PortfolioLegalStructure {
  vehicleType: 'lp' | 'llc' | 'trust' | 'company' | 'partnership' | 'unit_trust' | 'sicav' | 'other';
  jurisdiction: string;
  registrationNumber?: string;
  taxId?: string;
  regulatedStatus: 'regulated' | 'exempt' | 'unregulated';
  regulator?: string;
  regulatoryId?: string;
  fundAdministrator?: string;
  custodian?: string;
  auditor?: string;
  legalCounsel?: string;
}

export interface PortfolioInvestmentFocus {
  primaryGeographies: string[];
  secondaryGeographies?: string[];
  geographyExclusions?: string[];
  
  primarySectors: string[];
  secondarySectors?: string[];
  sectorExclusions?: string[];
  subSectorFocus?: string[];
  
  investmentStages: ('greenfield' | 'brownfield' | 'operational' | 'mature')[];
  
  targetDealSize: {
    min: MoneyAmount;
    max: MoneyAmount;
    sweet_spot?: MoneyAmount;
  };
  
  esgIntegration: 'core' | 'integrated' | 'screened' | 'thematic' | 'impact';
  impactThemes?: string[];
  exclusions?: string[];
  
  targetGrossIRR: { min: number; target: number; max: number };
  targetNetIRR: { min: number; target: number; max: number };
  targetCashYield?: { min: number; target: number; max: number };
  targetMOIC?: { min: number; target: number; max: number };
}

export interface PortfolioCapitalStructure {
  baseCurrency: Currency;
  
  targetSize: MoneyAmount;
  hardCap?: MoneyAmount;
  totalCommitted: MoneyAmount;
  
  calledCapital: MoneyAmount;
  uncalledCommitments: MoneyAmount;
  returnedCapital: MoneyAmount;
  recycledCapital?: MoneyAmount;
  
  paidInCapital: MoneyAmount;
  totalDistributions: MoneyAmount;
  
  leveragePolicy?: {
    maxPortfolioLeverage: number;
    maxAssetLeverage?: number;
    leverageAllowed: boolean;
    currentLeverage?: number;
  };
  
  concentrationLimits?: {
    singleAsset: number;
    singleSector: number;
    singleGeography: number;
    singleCounterparty?: number;
  };
  
  reserves?: {
    operatingReserve: MoneyAmount;
    followOnReserve?: MoneyAmount;
    distributionReserve?: MoneyAmount;
  };
}

export interface PortfolioAllocations {
  targetAllocation: AllocationBreakdown;
  actualAllocation: AllocationBreakdown;
  allocationVariance: AllocationVariance;
  lastRebalanced?: Timestamp;
  driftAlerts?: DriftAlert[];
}

export interface AllocationBreakdown {
  bySector: AllocationItem[];
  byGeography: AllocationItem[];
  byStage: AllocationItem[];
  byInstrument: AllocationItem[];
  byCurrency?: AllocationItem[];
  byVintage?: AllocationItem[];
}

export interface AllocationItem {
  category: string;
  value: MoneyAmount;
  percentage: number;
  count?: number;
}

export interface AllocationVariance {
  bySector: VarianceItem[];
  byGeography: VarianceItem[];
  byStage: VarianceItem[];
  byInstrument: VarianceItem[];
}

export interface VarianceItem {
  category: string;
  target: number;
  actual: number;
  variance: number;
  status: 'within_range' | 'warning' | 'breach';
}

export interface DriftAlert {
  type: 'sector' | 'geography' | 'stage' | 'instrument' | 'concentration';
  category: string;
  target: number;
  actual: number;
  variance: number;
  severity: 'low' | 'medium' | 'high';
  raisedAt: Timestamp;
  acknowledgedAt?: Timestamp;
  acknowledgedBy?: string;
}

export interface PortfolioNAV {
  grossAssetValue: MoneyAmount;
  totalLiabilities: MoneyAmount;
  netAssetValue: MoneyAmount;
  
  navPerUnit?: number;
  unitsOutstanding?: number;
  
  components: NAVComponents;
  
  valuationDate: Timestamp;
  
  previousNAV?: MoneyAmount;
  previousDate?: Timestamp;
  
  navChange: {
    absolute: MoneyAmount;
    percentage: number;
  };
  
  status: 'draft' | 'preliminary' | 'final' | 'audited';
  
  preparedBy?: string;
  reviewedBy?: string;
  approvedBy?: string;
  approvedAt?: Timestamp;
}

export interface NAVComponents {
  investmentsFairValue: MoneyAmount;
  unfundedCommitments?: MoneyAmount;
  cash: MoneyAmount;
  cashEquivalents?: MoneyAmount;
  
  receivables: {
    capitalCallsReceivable?: MoneyAmount;
    interestReceivable?: MoneyAmount;
    dividendsReceivable?: MoneyAmount;
    otherReceivables?: MoneyAmount;
    total: MoneyAmount;
  };
  
  otherAssets?: MoneyAmount;
  
  liabilities: {
    capitalCallsPayable?: MoneyAmount;
    distributionsPayable?: MoneyAmount;
    feesPayable?: MoneyAmount;
    expensesPayable?: MoneyAmount;
    borrowings?: MoneyAmount;
    otherLiabilities?: MoneyAmount;
    total: MoneyAmount;
  };
  
  accruals?: {
    accruedManagementFee: MoneyAmount;
    accruedPerformanceFee: MoneyAmount;
    accruedExpenses: MoneyAmount;
  };
}

export type ValuationMethodology =
  | 'dcf'
  | 'comparable_transactions'
  | 'precedent_transactions'
  | 'asset_based'
  | 'earnings_multiple'
  | 'replacement_cost'
  | 'option_pricing'
  | 'recent_transaction'
  | 'quoted_price'
  | 'nav'
  | 'independent_valuation';

export interface ValuationPolicy {
  frequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  primaryMethodology: ValuationMethodology;
  secondaryMethodologies?: ValuationMethodology[];
  fairValueHierarchy: 'ifrs' | 'us_gaap' | 'other';
  valuationWaterfall: ValuationLevel[];
  thirdPartyValuation?: {
    required: boolean;
    frequency: 'annually' | 'semi_annually' | 'on_transaction';
    provider?: string;
  };
  approvalRequired: boolean;
  approvalThreshold?: MoneyAmount;
  valuationCommittee?: boolean;
}

export interface ValuationLevel {
  level: 1 | 2 | 3;
  description: string;
  methodology: ValuationMethodology;
  inputs: string[];
  usedFor: string[];
}

export interface CashPosition {
  totalCash: MoneyAmount;
  byAccount: CashAccountBalance[];
  byCurrency: CurrencyPosition[];
  reservedCash: MoneyAmount;
  availableCash: MoneyAmount;
  asOfDate: Timestamp;
}

export interface CashAccountBalance {
  accountId: string;
  accountName: string;
  bankName: string;
  accountType: 'operating' | 'custody' | 'reserve' | 'distribution';
  currency: Currency;
  balance: number;
  availableBalance: number;
  asOfDate: Timestamp;
}

export interface CurrencyPosition {
  currency: Currency;
  amount: number;
  baseCurrencyEquivalent: MoneyAmount;
  exchangeRate: number;
}

export interface PerformanceSummary {
  netIRR: number;
  grossIRR: number;
  netTWR?: number;
  grossTWR?: number;
  netMOIC: number;
  grossMOIC: number;
  
  dpi: number;
  rvpi: number;
  tvpi: number;
  
  currentYield?: number;
  yieldToDate?: number;
  
  pme?: {
    benchmark: string;
    value: number;
    outperformance: number;
  };
  
  attribution?: {
    entryMultiple: number;
    revenueGrowth: number;
    marginExpansion: number;
    exitMultiple: number;
    leverageEffect: number;
    fxImpact: number;
    feeDrag: number;
  };
  
  periodReturns: {
    mtd: number;
    qtd: number;
    ytd: number;
    oneYear?: number;
    threeYear?: number;
    fiveYear?: number;
    sinceInception: number;
  };
  
  volatility?: {
    standardDeviation: number;
    sharpeRatio: number;
    sortinoRatio?: number;
    maxDrawdown: number;
  };
  
  asOfDate: Timestamp;
}

export interface PortfolioLifecycle {
  formationDate?: Timestamp;
  legalCloseDate?: Timestamp;
  
  investmentPeriodStart?: Timestamp;
  investmentPeriodEnd?: Timestamp;
  investmentPeriodExtensionYears?: number;
  
  fundTermYears?: number;
  extensionYears?: number;
  terminationDate?: Timestamp;
  
  firstCloseDate?: Timestamp;
  finalCloseDate?: Timestamp;
  firstInvestmentDate?: Timestamp;
  firstDistributionDate?: Timestamp;
  
  statusChangedAt: Timestamp;
  previousStatus?: PortfolioStatus;
}

export interface PortfolioFeeStructure {
  managementFee: {
    rate: number;
    basis: 'committed' | 'invested' | 'nav' | 'cost';
    calculationFrequency: 'quarterly' | 'semi_annual' | 'annual';
    stepDownSchedule?: { afterYear: number; rate: number }[];
  };
  
  performanceFee?: {
    rate: number;
    hurdleRate: number;
    hurdleType: 'preferred' | 'hard' | 'soft';
    catchUp?: { rate: number; split: string };
    crystallization: 'deal_by_deal' | 'whole_fund' | 'european' | 'american';
    clawback?: boolean;
  };
  
  transactionFees?: {
    acquisitionFee: number;
    dispositionFee: number;
    financingFee?: number;
  };
  
  feeOffsets?: {
    directorsFeesOffset: number;
    transactionFeesOffset: number;
    monitoringFeesOffset: number;
  };
  
  operatingBudget?: {
    annualBudget: MoneyAmount;
    managementCompanyAllocation: number;
    fundExpenses: number;
  };
}

export interface HoldingsSummary {
  totalHoldings: number;
  activeHoldings: number;
  realizedHoldings: number;
  
  totalCost: MoneyAmount;
  currentValue: MoneyAmount;
  realizedValue: MoneyAmount;
  unrealizedGain: MoneyAmount;
  
  topHoldingsByValue?: { holdingId: string; name: string; value: MoneyAmount; percentage: number }[];
  
  largestHoldingPercentage: number;
  top5Concentration: number;
  top10Concentration: number;
}

export interface PortfolioLinkedEntities {
  holdingIds: string[];
  dealIds?: string[];
  underlyingPortfolioIds?: string[];
  documentIds?: string[];
  transactionIds?: string[];
}

export interface ReportingConfig {
  reports: {
    capitalAccount: boolean;
    portfolioSummary: boolean;
    performanceReport: boolean;
    valuationReport: boolean;
    esgReport: boolean;
    riskReport: boolean;
    taxReport: boolean;
  };
  
  reportingFrequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  distributionMethod: 'email' | 'portal' | 'both';
  recipientIds?: string[];
  templateIds?: Record<string, string>;
  benchmarks?: string[];
}

export interface PortfolioStatusChange {
  id: string;
  portfolioId: string;
  previousStatus: PortfolioStatus;
  newStatus: PortfolioStatus;
  reason: string;
  effectiveDate: Timestamp;
  changedBy: string;
  changedAt: Timestamp;
  notes?: string;
}

export type CapitalTransactionType =
  | 'capital_call'
  | 'distribution'
  | 'recallable_distribution'
  | 'equalisation'
  | 'fee_payment'
  | 'expense_payment'
  | 'transfer'
  | 'redemption'
  | 'subscription';

export interface CapitalTransaction {
  id: string;
  portfolioId: string;
  clientId: string;
  
  type: CapitalTransactionType;
  status: 'draft' | 'announced' | 'pending' | 'completed' | 'cancelled';
  
  grossAmount: MoneyAmount;
  netAmount: MoneyAmount;
  
  noticeDate?: Timestamp;
  dueDate: Timestamp;
  settlementDate?: Timestamp;
  
  callPurpose?: 'investment' | 'fees' | 'expenses' | 'follow_on' | 'other';
  investmentId?: string;
  
  distributionType?: 'income' | 'capital_return' | 'capital_gain' | 'recallable';
  sourceHoldingIds?: string[];
  
  breakdown?: {
    investmentAmount?: MoneyAmount;
    managementFees?: MoneyAmount;
    expenses?: MoneyAmount;
    otherFees?: MoneyAmount;
  };
  
  bankingDetails?: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    swiftCode?: string;
    reference: string;
  };
  
  noticeDocumentId?: string;
  
  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
  processedBy?: string;
  processedAt?: Timestamp;
}

export type CreatePortfolioInput = Omit<Portfolio, 
  'id' | 'portfolioCode' | 'createdAt' | 'updatedAt' | 
  'currentNAV' | 'performanceSummary' | 'holdingsSummary' | 'allocations'
> & {
  initialNAV?: Partial<PortfolioNAV>;
};

export type UpdatePortfolioInput = Partial<Omit<Portfolio, 
  'id' | 'portfolioCode' | 'engagementId' | 'createdAt' | 'createdBy'
>>;

export interface PortfolioSummary {
  id: string;
  portfolioCode: string;
  name: string;
  portfolioType: PortfolioType;
  status: PortfolioStatus;
  strategy: PortfolioStrategy;
  clientId: string;
  currentNAV: MoneyAmount;
  navChange: number;
  netIRR: number;
  tvpi: number;
  activeHoldings: number;
  updatedAt?: Timestamp;
}
