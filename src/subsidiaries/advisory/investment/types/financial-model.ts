/**
 * Financial Model - Comprehensive investment analysis
 * 
 * A financial model captures all assumptions, projections, and
 * return calculations for an infrastructure investment.
 */

import { Timestamp } from 'firebase/firestore';
import { CashFlowProjection, CashFlowSummary } from './cash-flow';
import { ReturnMetrics, DebtMetrics } from './returns';
import { Scenario, ScenarioComparison } from './scenario';
import { SensitivityAnalysis } from './sensitivity';
import { Valuation } from './valuation';

export interface FinancialModel {
  id: string;
  dealId: string;
  engagementId: string;
  
  // Model identification
  name: string;
  version: string;
  status: ModelStatus;
  modelType: ModelType;
  
  // Investment structure
  investmentStructure: ModelInvestmentStructure;
  
  // Assumptions
  assumptions: ModelAssumptions;
  
  // Cash flows
  cashFlows: CashFlowProjection[];
  cashFlowSummary: CashFlowSummary;
  
  // Scenarios
  baseCase: Scenario;
  scenarios: Scenario[];
  scenarioComparison?: ScenarioComparison;
  
  // Returns (for equity investments)
  equityReturns?: ReturnMetrics;
  
  // Debt metrics (for debt investments or leverage analysis)
  debtMetrics?: DebtMetrics;
  
  // Valuation
  valuation?: Valuation;
  
  // Sensitivity
  sensitivityAnalyses: SensitivityAnalysis[];
  
  // Key outputs
  outputs: ModelOutputs;
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  approvedAt?: Timestamp;
  approvedBy?: string;
  
  // Version history
  previousVersionId?: string;
  versionNotes?: string;
}

export type ModelStatus = 
  | 'draft'           // Initial development
  | 'in_review'       // Under IC review
  | 'approved'        // IC approved
  | 'superseded'      // Replaced by new version
  | 'archived';       // No longer active

export type ModelType = 
  | 'equity'          // Equity investment model
  | 'debt'            // Debt/lending model
  | 'hybrid'          // Mixed debt/equity
  | 'project_finance' // Project finance structure
  | 'lbo'             // Leveraged buyout
  | 'development';    // Development/construction phase

export interface ModelInvestmentStructure {
  totalInvestmentAmount: number;
  currency: string;
  
  // Equity component
  equityAmount?: number;
  equityPercentage?: number;
  shareClass?: string;
  
  // Debt component
  debtAmount?: number;
  debtType?: DebtType;
  interestRate?: number;
  tenor?: number; // months
  amortizationType?: ModelAmortizationType;
  
  // Phasing
  investmentPhases?: InvestmentPhase[];
  
  // Co-investors
  coInvestors?: CoInvestor[];
}

export type DebtType = 
  | 'senior_secured'
  | 'senior_unsecured'
  | 'subordinated'
  | 'mezzanine'
  | 'convertible'
  | 'bridge';

export type ModelAmortizationType = 
  | 'bullet'           // Full repayment at maturity
  | 'amortizing'       // Equal principal payments
  | 'annuity'          // Equal total payments
  | 'custom';          // Custom schedule

export interface InvestmentPhase {
  name: string;
  amount: number;
  expectedDate: Date;
  conditions: string[];
  status: 'pending' | 'funded' | 'cancelled';
}

export interface CoInvestor {
  name: string;
  type: 'financial' | 'strategic' | 'dfi' | 'government';
  amount: number;
  percentage: number;
  leadInvestor: boolean;
}

export interface ModelAssumptions {
  // General
  modelStartDate: Date;
  projectionPeriod: number; // years
  discountRate: number;
  riskFreeRate: number;
  
  // Revenue assumptions
  revenue: RevenueAssumptions;
  
  // Cost assumptions
  operatingCosts: CostAssumptions;
  
  // Capital expenditure
  capex: CapexAssumptions;
  
  // Working capital
  workingCapital: WorkingCapitalAssumptions;
  
  // Tax
  tax: TaxAssumptions;
  
  // Financing
  financing: FinancingAssumptions;
  
  // Terminal value
  terminalValue: TerminalValueAssumptions;
  
  // Inflation
  inflation: InflationAssumptions;
  
  // Country-specific
  countryRisk?: CountryRiskAssumptions;
}

export interface RevenueAssumptions {
  revenueModel: RevenueModel;
  
  // For capacity-based (e.g., power plants, hospitals)
  capacity?: number;
  capacityUnit?: string;
  utilizationRate?: number;
  tariff?: number;
  tariffEscalation?: number;
  
  // For fee-based (e.g., toll roads)
  baseVolume?: number;
  volumeGrowthRate?: number;
  basePrice?: number;
  priceEscalation?: number;
  
  // For availability-based (e.g., PPP projects)
  availabilityPayment?: number;
  paymentEscalation?: number;
  
  // Revenue ramp-up
  rampUpPeriod?: number; // months
  rampUpSchedule?: RampUpStep[];
}

export type RevenueModel = 
  | 'capacity_based'    // Payment per unit of capacity
  | 'volume_based'      // Payment per unit of usage
  | 'availability_based' // Payment for availability
  | 'hybrid'            // Combination
  | 'merchant';         // Market-based pricing

export interface RampUpStep {
  month: number;
  utilizationPercentage: number;
}

export interface CostAssumptions {
  fixedCosts: CostItem[];
  variableCosts: VariableCostItem[];
  
  // O&M contract
  omContractType?: 'fixed_price' | 'cost_plus' | 'hybrid';
  omContractAmount?: number;
  omEscalation?: number;
  
  // Insurance
  insuranceCostPercentage?: number; // % of revenue or asset value
  
  // Management fees
  managementFeePercentage?: number;
}

export interface CostItem {
  name: string;
  amount: number;
  escalation: number;
  startYear: number;
  endYear?: number;
}

export interface VariableCostItem {
  name: string;
  costPerUnit: number;
  unit: string;
  escalation: number;
}

export interface CapexAssumptions {
  constructionCapex: CapexSchedule[];
  maintenanceCapex: MaintenanceCapex;
  expansionCapex?: CapexSchedule[];
  
  // Contingency
  contingencyPercentage: number;
  
  // Capitalized items
  capitalizedInterest: boolean;
  developmentCosts?: number;
}

export interface CapexSchedule {
  category: string;
  amount: number;
  schedule: MonthlySchedule[];
}

export interface MonthlySchedule {
  month: number;
  percentage: number;
}

export interface MaintenanceCapex {
  type: 'percentage_of_revenue' | 'fixed_schedule' | 'lifecycle';
  percentageOfRevenue?: number;
  fixedAmount?: number;
  lifecycleSchedule?: LifecycleEvent[];
}

export interface LifecycleEvent {
  year: number;
  description: string;
  amount: number;
}

export interface WorkingCapitalAssumptions {
  receivableDays: number;
  payableDays: number;
  inventoryDays: number;
  minimumCashBalance: number;
  
  // Reserves
  debtServiceReserve?: number; // months of debt service
  maintenanceReserve?: number;
  otherReserves?: ReserveAccount[];
}

export interface ReserveAccount {
  name: string;
  targetBalance: number;
  fundingSchedule: string;
}

export interface TaxAssumptions {
  corporateIncomeTaxRate: number;
  withholdingTaxRate: number;
  vatRate: number;
  vatRecoverable: boolean;
  
  // Tax incentives
  taxHoliday?: TaxHoliday;
  acceleratedDepreciation?: boolean;
  investmentAllowance?: number;
  
  // Loss carry forward
  lossCarryForward: boolean;
  lossCarryForwardLimit?: number; // years
  
  // Transfer pricing
  intercompanyCharges?: number;
}

export interface TaxHoliday {
  startYear: number;
  duration: number; // years
  exemptionPercentage: number;
}

export interface FinancingAssumptions {
  // Senior debt
  seniorDebt?: DebtFacility;
  
  // Subordinated debt
  subordinatedDebt?: DebtFacility;
  
  // Mezzanine
  mezzanine?: MezzanineFacility;
  
  // Shareholder loans
  shareholderLoan?: ShareholderLoan;
  
  // Fees
  arrangementFee?: number;
  commitmentFee?: number;
  agencyFee?: number;
}

export interface DebtFacility {
  amount: number;
  interestRate: number;
  interestType: 'fixed' | 'floating';
  spread?: number; // basis points over reference rate
  tenor: number; // months
  gracePeriod?: number; // months
  amortizationType: ModelAmortizationType;
  
  // Covenants
  minDSCR?: number;
  maxLeverageRatio?: number;
  
  // Fees
  upfrontFee?: number;
}

export interface MezzanineFacility {
  amount: number;
  cashInterest: number;
  pikInterest?: number; // Payment in kind
  equityKicker?: number; // Percentage equity upside
  tenor: number;
}

export interface ShareholderLoan {
  amount: number;
  interestRate: number;
  subordinatedToSenior: boolean;
  convertible: boolean;
}

export interface TerminalValueAssumptions {
  method: TerminalValueMethod;
  exitMultiple?: number; // For multiple method
  exitMultipleMetric?: 'ebitda' | 'revenue' | 'ebit';
  perpetuityGrowthRate?: number; // For Gordon growth
  exitYear?: number;
}

export type TerminalValueMethod = 
  | 'exit_multiple'
  | 'gordon_growth'
  | 'liquidation'
  | 'none';

export interface InflationAssumptions {
  generalInflation: number;
  revenueInflation?: number;
  costInflation?: number;
  constructionInflation?: number;
}

export interface CountryRiskAssumptions {
  countryRiskPremium: number;
  currencyRisk?: number;
  politicalRisk?: number;
  regulatoryRisk?: number;
}

export interface ModelOutputs {
  // Key return metrics (base case)
  projectIRR: number;
  equityIRR?: number;
  npv: number;
  moic?: number; // Multiple on invested capital
  paybackPeriod?: number; // years
  
  // Debt metrics
  minDSCR?: number;
  averageDSCR?: number;
  llcr?: number; // Loan life coverage ratio
  
  // Valuation
  enterpriseValue?: number;
  equityValue?: number;
  impliedMultiple?: number;
  
  // Risk metrics
  breakEvenUtilization?: number;
  breakEvenPrice?: number;
  sensitivityToDiscount?: number; // % change in NPV per 1% change in discount rate
}

// Helper functions
export function getModelStatusDisplayName(status: ModelStatus): string {
  const names: Record<ModelStatus, string> = {
    draft: 'Draft',
    in_review: 'In Review',
    approved: 'Approved',
    superseded: 'Superseded',
    archived: 'Archived',
  };
  return names[status] || status;
}

export function getModelStatusColor(status: ModelStatus): string {
  const colors: Record<ModelStatus, string> = {
    draft: '#6b7280',
    in_review: '#f59e0b',
    approved: '#22c55e',
    superseded: '#9ca3af',
    archived: '#d1d5db',
  };
  return colors[status] || '#6b7280';
}

export function getModelTypeDisplayName(type: ModelType): string {
  const names: Record<ModelType, string> = {
    equity: 'Equity Investment',
    debt: 'Debt/Lending',
    hybrid: 'Hybrid Structure',
    project_finance: 'Project Finance',
    lbo: 'Leveraged Buyout',
    development: 'Development Phase',
  };
  return names[type] || type;
}

export function getDebtTypeDisplayName(type: DebtType): string {
  const names: Record<DebtType, string> = {
    senior_secured: 'Senior Secured',
    senior_unsecured: 'Senior Unsecured',
    subordinated: 'Subordinated',
    mezzanine: 'Mezzanine',
    convertible: 'Convertible',
    bridge: 'Bridge Financing',
  };
  return names[type] || type;
}

export function getRevenueModelDisplayName(model: RevenueModel): string {
  const names: Record<RevenueModel, string> = {
    capacity_based: 'Capacity-Based',
    volume_based: 'Volume-Based',
    availability_based: 'Availability-Based',
    hybrid: 'Hybrid Model',
    merchant: 'Merchant/Market-Based',
  };
  return names[model] || model;
}

export function getTerminalValueMethodDisplayName(method: TerminalValueMethod): string {
  const names: Record<TerminalValueMethod, string> = {
    exit_multiple: 'Exit Multiple',
    gordon_growth: 'Gordon Growth (Perpetuity)',
    liquidation: 'Liquidation Value',
    none: 'No Terminal Value',
  };
  return names[method] || method;
}

export function createDefaultModelAssumptions(): ModelAssumptions {
  return {
    modelStartDate: new Date(),
    projectionPeriod: 10,
    discountRate: 0.12,
    riskFreeRate: 0.04,
    revenue: {
      revenueModel: 'capacity_based',
      utilizationRate: 0.85,
    },
    operatingCosts: {
      fixedCosts: [],
      variableCosts: [],
    },
    capex: {
      constructionCapex: [],
      maintenanceCapex: {
        type: 'percentage_of_revenue',
        percentageOfRevenue: 0.02,
      },
      contingencyPercentage: 0.10,
      capitalizedInterest: true,
    },
    workingCapital: {
      receivableDays: 30,
      payableDays: 45,
      inventoryDays: 0,
      minimumCashBalance: 0,
    },
    tax: {
      corporateIncomeTaxRate: 0.30,
      withholdingTaxRate: 0.10,
      vatRate: 0.18,
      vatRecoverable: true,
      lossCarryForward: true,
    },
    financing: {},
    terminalValue: {
      method: 'exit_multiple',
      exitMultiple: 8,
      exitMultipleMetric: 'ebitda',
    },
    inflation: {
      generalInflation: 0.03,
    },
  };
}
