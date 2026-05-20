/**
 * Return Metrics - Investment return calculations
 */

export interface ReturnMetrics {
  // Internal Rate of Return
  projectIRR: number;
  equityIRR: number;
  
  // Net Present Value
  npv: number;
  npvAtWacc: number;
  npvAtCostOfEquity: number;
  
  // Multiple
  moic: number; // Multiple on invested capital
  tvpi?: number; // Total value to paid-in
  dpi?: number; // Distributions to paid-in
  rvpi?: number; // Residual value to paid-in
  
  // Payback
  paybackPeriod: number; // years
  discountedPaybackPeriod?: number;
  
  // Yield metrics
  cashYield?: number;
  totalReturn?: number;
  
  // Risk-adjusted returns
  sharpeRatio?: number;
  sortinoRatio?: number;
  
  // Breakdowns
  returnsByYear: AnnualReturn[];
  returnAttribution?: ReturnAttribution;
}

export interface AnnualReturn {
  year: number;
  cashFlow: number;
  cumulativeCashFlow: number;
  cumulativeReturn: number;
  moic: number;
}

export interface ReturnAttribution {
  operatingCashFlow: number;
  terminalValue: number;
  leverageEffect?: number;
  multipleExpansion?: number;
  workingCapitalRelease?: number;
}

export interface DebtMetrics {
  // Coverage ratios
  dscr: DSCRMetrics;
  icr: number; // Interest coverage ratio
  llcr: number; // Loan life coverage ratio
  plcr?: number; // Project life coverage ratio
  
  // Leverage ratios
  debtToEquity: number;
  debtToEbitda: number;
  netDebtToEbitda: number;
  loanToValue?: number;
  
  // Debt capacity
  maxDebtCapacity: number;
  debtHeadroom: number;
  
  // Amortization
  averageDebtLife: number;
  repaymentSchedule: RepaymentSchedule[];
}

export interface DSCRMetrics {
  minimum: number;
  average: number;
  byPeriod: DSCRByPeriod[];
  covenantBreaches: CovenantBreach[];
}

export interface DSCRByPeriod {
  period: number;
  dscr: number;
  debtService: number;
  cashAvailable: number;
  breachesMinimum: boolean;
}

export interface CovenantBreach {
  period: number;
  covenant: string;
  required: number;
  actual: number;
  severity: 'minor' | 'major' | 'event_of_default';
}

export interface RepaymentSchedule {
  period: number;
  openingBalance: number;
  principal: number;
  interest: number;
  totalPayment: number;
  closingBalance: number;
}

// Helper functions
export function formatIRR(irr: number): string {
  return `${(irr * 100).toFixed(2)}%`;
}

export function formatNPV(npv: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(npv);
}

export function formatMOIC(moic: number): string {
  return `${moic.toFixed(2)}x`;
}

export function formatDSCR(dscr: number): string {
  return `${dscr.toFixed(2)}x`;
}

export function formatPaybackPeriod(years: number): string {
  const wholeYears = Math.floor(years);
  const months = Math.round((years - wholeYears) * 12);
  
  if (months === 0) {
    return `${wholeYears} years`;
  }
  return `${wholeYears} years, ${months} months`;
}

export function getReturnQuality(irr: number): 'excellent' | 'good' | 'moderate' | 'poor' {
  if (irr >= 0.25) return 'excellent';
  if (irr >= 0.18) return 'good';
  if (irr >= 0.12) return 'moderate';
  return 'poor';
}

export function getDSCRQuality(dscr: number): 'strong' | 'adequate' | 'weak' | 'critical' {
  if (dscr >= 1.5) return 'strong';
  if (dscr >= 1.25) return 'adequate';
  if (dscr >= 1.0) return 'weak';
  return 'critical';
}

export function getReturnQualityColor(quality: 'excellent' | 'good' | 'moderate' | 'poor'): string {
  const colors = {
    excellent: '#22c55e',
    good: '#84cc16',
    moderate: '#eab308',
    poor: '#ef4444',
  };
  return colors[quality];
}

export function getDSCRQualityColor(quality: 'strong' | 'adequate' | 'weak' | 'critical'): string {
  const colors = {
    strong: '#22c55e',
    adequate: '#84cc16',
    weak: '#eab308',
    critical: '#ef4444',
  };
  return colors[quality];
}
