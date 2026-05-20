/**
 * Cash Flow Projections - Annual and monthly cash flows
 */

export interface CashFlowProjection {
  period: number; // Year number (0 = investment year)
  periodType: 'annual' | 'monthly' | 'quarterly';
  startDate: Date;
  endDate: Date;
  
  // Revenue
  revenue: RevenueBreakdown;
  
  // Operating costs
  operatingCosts: CostBreakdown;
  
  // EBITDA
  ebitda: number;
  ebitdaMargin: number;
  
  // Depreciation & amortization
  depreciation: number;
  amortization: number;
  
  // EBIT
  ebit: number;
  
  // Interest
  interestExpense: number;
  interestIncome: number;
  
  // Tax
  taxableIncome: number;
  taxExpense: number;
  
  // Net income
  netIncome: number;
  
  // Cash flow adjustments
  addBackDepreciation: number;
  workingCapitalChange: number;
  capex: number;
  
  // Free cash flow
  fcff: number; // Free cash flow to firm
  fcfe: number; // Free cash flow to equity
  
  // Debt service
  debtDrawdown?: number;
  principalRepayment?: number;
  debtServicePayment?: number;
  
  // Distributions
  dividends?: number;
  shareholderLoanRepayment?: number;
  
  // Cash position
  openingCash: number;
  cashFlow: number;
  closingCash: number;
  
  // Debt position
  openingDebt?: number;
  closingDebt?: number;
  
  // Metrics
  dscr?: number;
  llcr?: number;
}

export interface RevenueBreakdown {
  total: number;
  byStream: RevenueStream[];
}

export interface RevenueStream {
  name: string;
  volume?: number;
  price?: number;
  amount: number;
}

export interface CostBreakdown {
  total: number;
  fixed: number;
  variable: number;
  byCategory: CostCategory[];
}

export interface CostCategory {
  name: string;
  amount: number;
  type: 'fixed' | 'variable';
}

export interface CashFlowSummary {
  totalRevenue: number;
  totalEbitda: number;
  averageEbitdaMargin: number;
  totalCapex: number;
  totalDebtService: number;
  totalDividends: number;
  netCashGenerated: number;
  
  // Cumulative cash flows for IRR calculation
  equityCashFlows: number[];
  projectCashFlows: number[];
  
  // Period breakdown
  constructionPeriodCosts: number;
  operationPeriodCashFlow: number;
  terminalValue: number;
}

// Helper functions
export function createEmptyCashFlowProjection(period: number, startDate: Date): CashFlowProjection {
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);
  endDate.setDate(endDate.getDate() - 1);
  
  return {
    period,
    periodType: 'annual',
    startDate,
    endDate,
    revenue: { total: 0, byStream: [] },
    operatingCosts: { total: 0, fixed: 0, variable: 0, byCategory: [] },
    ebitda: 0,
    ebitdaMargin: 0,
    depreciation: 0,
    amortization: 0,
    ebit: 0,
    interestExpense: 0,
    interestIncome: 0,
    taxableIncome: 0,
    taxExpense: 0,
    netIncome: 0,
    addBackDepreciation: 0,
    workingCapitalChange: 0,
    capex: 0,
    fcff: 0,
    fcfe: 0,
    openingCash: 0,
    cashFlow: 0,
    closingCash: 0,
  };
}

export function formatCashFlowValue(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
