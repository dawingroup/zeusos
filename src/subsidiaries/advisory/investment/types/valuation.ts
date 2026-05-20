/**
 * Valuation - Enterprise and equity value calculations
 */

export interface Valuation {
  valuationDate: Date;
  currency: string;
  
  // Primary valuation
  primaryMethod: ValuationMethod;
  enterpriseValue: number;
  netDebt: number;
  equityValue: number;
  
  // Multiple methodologies
  methodologies: ValuationMethodology[];
  
  // Implied metrics
  impliedMultiples: ImpliedMultiples;
  
  // Football field (valuation range)
  valuationRange: ModelValuationRange;
  
  // Cross-check
  crossCheck?: ValuationCrossCheck;
}

export type ValuationMethod = 
  | 'dcf'
  | 'comparable_companies'
  | 'precedent_transactions'
  | 'replacement_cost'
  | 'asset_based'
  | 'sum_of_parts';

export interface ValuationMethodology {
  method: ValuationMethod;
  weight: number; // For weighted average
  
  // DCF specific
  dcf?: DCFValuation;
  
  // Comparables
  comparables?: ComparablesValuation;
  
  // Precedent transactions
  precedents?: PrecedentTransactionsValuation;
  
  // Replacement cost
  replacementCost?: ReplacementCostValuation;
  
  // Results
  enterpriseValue: number;
  equityValue: number;
  valuationNotes: string;
}

export interface DCFValuation {
  projectionPeriod: number;
  wacc: number;
  
  // WACC build-up
  waccComponents: WACCComponents;
  
  // Terminal value
  terminalValueMethod: 'gordon_growth' | 'exit_multiple';
  terminalGrowthRate?: number;
  exitMultiple?: number;
  terminalValue: number;
  
  // Present values
  pvOfCashFlows: number;
  pvOfTerminalValue: number;
  enterpriseValue: number;
  
  // Sensitivity
  waccSensitivity: { wacc: number; ev: number }[];
  terminalGrowthSensitivity?: { growth: number; ev: number }[];
}

export interface WACCComponents {
  costOfEquity: number;
  riskFreeRate: number;
  equityRiskPremium: number;
  beta: number;
  sizeAdjustment: number;
  countryRiskPremium: number;
  
  costOfDebt: number;
  taxRate: number;
  afterTaxCostOfDebt: number;
  
  equityWeight: number;
  debtWeight: number;
}

export interface ComparablesValuation {
  comparableCompanies: ComparableCompany[];
  
  // Selected multiples
  selectedMultiples: SelectedMultiple[];
  
  // Application
  targetMetrics: TargetMetrics;
  
  // Premium/discount
  controlPremium?: number;
  liquidityDiscount?: number;
  countryDiscount?: number;
}

export interface ComparableCompany {
  name: string;
  ticker?: string;
  country: string;
  sector: string;
  
  // Size metrics
  marketCap: number;
  enterpriseValue: number;
  revenue: number;
  ebitda: number;
  
  // Multiples
  evRevenue: number;
  evEbitda: number;
  peRatio?: number;
  
  // Relevance
  relevanceScore: number; // 1-5
  relevanceNotes: string;
}

export interface SelectedMultiple {
  metric: 'ev_revenue' | 'ev_ebitda' | 'pe' | 'ev_ebit';
  low: number;
  median: number;
  high: number;
  selected: number;
  selectionRationale: string;
}

export interface TargetMetrics {
  ltmRevenue: number;
  ltmEbitda: number;
  forwardRevenue: number;
  forwardEbitda: number;
  eps?: number;
}

export interface PrecedentTransactionsValuation {
  transactions: PrecedentTransaction[];
  
  // Selected multiples
  selectedMultiples: SelectedMultiple[];
  
  // Premium analysis
  controlPremiumAnalysis?: ControlPremiumAnalysis;
}

export interface PrecedentTransaction {
  targetName: string;
  acquirerName: string;
  announcementDate: Date;
  closingDate?: Date;
  
  // Deal details
  transactionValue: number;
  enterpriseValue: number;
  equityValue: number;
  
  // Multiples
  evRevenue: number;
  evEbitda: number;
  
  // Premium
  premiumToUnaffected?: number;
  
  // Relevance
  relevanceScore: number;
  relevanceNotes: string;
}

export interface ControlPremiumAnalysis {
  averagePremium: number;
  medianPremium: number;
  selectedPremium: number;
  rationale: string;
}

export interface ReplacementCostValuation {
  components: ReplacementCostComponent[];
  totalReplacementCost: number;
  
  // Adjustments
  physicalDepreciation: number;
  functionalObsolescence: number;
  economicObsolescence: number;
  
  netReplacementCost: number;
  landValue?: number;
  workingCapital?: number;
  
  enterpriseValue: number;
}

export interface ReplacementCostComponent {
  name: string;
  originalCost: number;
  age: number;
  usefulLife: number;
  replacementCost: number;
  depreciatedValue: number;
}

export interface ImpliedMultiples {
  evRevenue: number;
  evEbitda: number;
  evEbit?: number;
  peRatio?: number;
  priceToBook?: number;
  evPerMW?: number; // For power projects
  evPerBed?: number; // For healthcare
  evPerKm?: number; // For roads
}

export interface ModelValuationRange {
  low: number;
  midpoint: number;
  high: number;
  
  byMethod: {
    method: ValuationMethod;
    low: number;
    high: number;
  }[];
}

export interface ValuationCrossCheck {
  impliedCapRate?: number;
  impliedYield?: number;
  pricePerSquareMeter?: number;
  pricePerCapacity?: number;
  reasonableness: 'reasonable' | 'aggressive' | 'conservative';
  notes: string;
}

// Helper functions
export function getValuationMethodDisplayName(method: ValuationMethod): string {
  const names: Record<ValuationMethod, string> = {
    dcf: 'Discounted Cash Flow (DCF)',
    comparable_companies: 'Comparable Companies',
    precedent_transactions: 'Precedent Transactions',
    replacement_cost: 'Replacement Cost',
    asset_based: 'Asset-Based Valuation',
    sum_of_parts: 'Sum of the Parts',
  };
  return names[method] || method;
}

export function getValuationMethodShortName(method: ValuationMethod): string {
  const names: Record<ValuationMethod, string> = {
    dcf: 'DCF',
    comparable_companies: 'Comps',
    precedent_transactions: 'Precedents',
    replacement_cost: 'Replacement',
    asset_based: 'Asset-Based',
    sum_of_parts: 'SOTP',
  };
  return names[method] || method;
}

export function formatValuation(value: number, currency = 'USD'): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B ${currency}`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M ${currency}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMultiple(value: number): string {
  return `${value.toFixed(1)}x`;
}

export function calculateWeightedValuation(methodologies: ValuationMethodology[]): number {
  const totalWeight = methodologies.reduce((sum, m) => sum + m.weight, 0);
  if (totalWeight === 0) return 0;
  
  return methodologies.reduce(
    (sum, m) => sum + m.enterpriseValue * (m.weight / totalWeight),
    0
  );
}

export function calculateValuationRange(methodologies: ValuationMethodology[]): ModelValuationRange {
  const values = methodologies.map(m => m.enterpriseValue);
  const low = Math.min(...values);
  const high = Math.max(...values);
  
  return {
    low,
    midpoint: (low + high) / 2,
    high,
    byMethod: methodologies.map(m => ({
      method: m.method,
      low: m.enterpriseValue * 0.9,
      high: m.enterpriseValue * 1.1,
    })),
  };
}
