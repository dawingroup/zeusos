/**
 * Financial Calculation Utilities
 */

import { CashFlowProjection } from '../types/cash-flow';
import { AnnualReturn } from '../types/returns';

/**
 * Calculate Net Present Value
 */
export function calculateNPV(
  cashFlows: number[],
  discountRate: number
): number {
  return cashFlows.reduce((npv, cf, t) => {
    return npv + cf / Math.pow(1 + discountRate, t);
  }, 0);
}

/**
 * Calculate Internal Rate of Return using Newton-Raphson method
 */
export function calculateIRR(
  cashFlows: number[],
  guess: number = 0.1,
  tolerance: number = 0.00001,
  maxIterations: number = 100
): number {
  // Check for valid cash flows (must have at least one positive and one negative)
  const hasPositive = cashFlows.some(cf => cf > 0);
  const hasNegative = cashFlows.some(cf => cf < 0);
  
  if (!hasPositive || !hasNegative) {
    return NaN; // IRR not defined
  }
  
  let rate = guess;
  
  for (let i = 0; i < maxIterations; i++) {
    const npv = calculateNPV(cashFlows, rate);
    const derivative = calculateNPVDerivative(cashFlows, rate);
    
    if (Math.abs(derivative) < 1e-10) {
      // Try a different starting point
      rate = rate + 0.1;
      continue;
    }
    
    const newRate = rate - npv / derivative;
    
    if (Math.abs(newRate - rate) < tolerance) {
      return newRate;
    }
    
    // Bound the rate to avoid divergence
    rate = Math.max(-0.99, Math.min(newRate, 10));
  }
  
  // If Newton-Raphson didn't converge, try bisection method
  return calculateIRRBisection(cashFlows, -0.99, 5, tolerance, maxIterations);
}

function calculateNPVDerivative(cashFlows: number[], rate: number): number {
  return cashFlows.reduce((deriv, cf, t) => {
    if (t === 0) return deriv;
    return deriv - (t * cf) / Math.pow(1 + rate, t + 1);
  }, 0);
}

function calculateIRRBisection(
  cashFlows: number[],
  low: number,
  high: number,
  tolerance: number,
  maxIterations: number
): number {
  let lowRate = low;
  let highRate = high;
  
  for (let i = 0; i < maxIterations; i++) {
    const midRate = (lowRate + highRate) / 2;
    const npvMid = calculateNPV(cashFlows, midRate);
    
    if (Math.abs(npvMid) < tolerance || (highRate - lowRate) / 2 < tolerance) {
      return midRate;
    }
    
    const npvLow = calculateNPV(cashFlows, lowRate);
    
    if (npvMid * npvLow < 0) {
      highRate = midRate;
    } else {
      lowRate = midRate;
    }
  }
  
  return (lowRate + highRate) / 2;
}

/**
 * Calculate Modified IRR
 */
export function calculateMIRR(
  cashFlows: number[],
  financeRate: number,
  reinvestRate: number
): number {
  const n = cashFlows.length - 1;
  
  // Present value of negative cash flows
  let pvNegative = 0;
  // Future value of positive cash flows
  let fvPositive = 0;
  
  cashFlows.forEach((cf, t) => {
    if (cf < 0) {
      pvNegative += cf / Math.pow(1 + financeRate, t);
    } else {
      fvPositive += cf * Math.pow(1 + reinvestRate, n - t);
    }
  });
  
  if (pvNegative >= 0) {
    return NaN; // MIRR requires negative cash flows
  }
  
  return Math.pow(-fvPositive / pvNegative, 1 / n) - 1;
}

/**
 * Calculate Multiple on Invested Capital
 */
export function calculateMOIC(
  totalDistributions: number,
  totalInvestment: number
): number {
  if (totalInvestment === 0) return 0;
  return totalDistributions / Math.abs(totalInvestment);
}

/**
 * Calculate Payback Period
 */
export function calculatePaybackPeriod(cashFlows: number[]): number {
  let cumulative = 0;
  
  for (let t = 0; t < cashFlows.length; t++) {
    cumulative += cashFlows[t];
    
    if (cumulative >= 0) {
      // Interpolate for fractional year
      if (t === 0) return 0;
      const previousCumulative = cumulative - cashFlows[t];
      const fraction = Math.abs(previousCumulative) / cashFlows[t];
      return t - 1 + fraction;
    }
  }
  
  return cashFlows.length; // Payback not achieved
}

/**
 * Calculate Discounted Payback Period
 */
export function calculateDiscountedPayback(
  cashFlows: number[],
  discountRate: number
): number {
  let cumulative = 0;
  
  for (let t = 0; t < cashFlows.length; t++) {
    const discountedCF = cashFlows[t] / Math.pow(1 + discountRate, t);
    cumulative += discountedCF;
    
    if (cumulative >= 0) {
      if (t === 0) return 0;
      const previousCumulative = cumulative - discountedCF;
      const fraction = Math.abs(previousCumulative) / discountedCF;
      return t - 1 + fraction;
    }
  }
  
  return cashFlows.length;
}

/**
 * Calculate Debt Service Coverage Ratio
 */
export function calculateDSCR(
  cashAvailableForDebtService: number,
  debtService: number
): number {
  if (debtService === 0) return Infinity;
  return cashAvailableForDebtService / debtService;
}

/**
 * Calculate Loan Life Coverage Ratio
 */
export function calculateLLCR(
  npvOfCashFlows: number,
  outstandingDebt: number
): number {
  if (outstandingDebt === 0) return Infinity;
  return npvOfCashFlows / outstandingDebt;
}

/**
 * Calculate WACC
 */
export function calculateWACC(
  costOfEquity: number,
  costOfDebt: number,
  taxRate: number,
  equityWeight: number,
  debtWeight: number
): number {
  const afterTaxCostOfDebt = costOfDebt * (1 - taxRate);
  return (costOfEquity * equityWeight) + (afterTaxCostOfDebt * debtWeight);
}

/**
 * Calculate Cost of Equity using CAPM
 */
export function calculateCAPM(
  riskFreeRate: number,
  beta: number,
  marketRiskPremium: number,
  sizeAdjustment: number = 0,
  countryRiskPremium: number = 0
): number {
  return riskFreeRate + 
         (beta * marketRiskPremium) + 
         sizeAdjustment + 
         countryRiskPremium;
}

/**
 * Calculate Gordon Growth Terminal Value
 */
export function calculateGordonGrowthTerminalValue(
  finalYearFCF: number,
  perpetualGrowthRate: number,
  discountRate: number
): number {
  if (discountRate <= perpetualGrowthRate) {
    throw new Error('Discount rate must be greater than growth rate');
  }
  return (finalYearFCF * (1 + perpetualGrowthRate)) / (discountRate - perpetualGrowthRate);
}

/**
 * Calculate Exit Multiple Terminal Value
 */
export function calculateExitMultipleTerminalValue(
  exitMetric: number, // EBITDA, Revenue, etc.
  exitMultiple: number
): number {
  return exitMetric * exitMultiple;
}

/**
 * Calculate Debt Amortization Schedule
 */
export function calculateAmortizationSchedule(
  principal: number,
  annualRate: number,
  tenorMonths: number,
  gracePeriodMonths: number = 0,
  amortizationType: 'bullet' | 'amortizing' | 'annuity'
): { month: number; principal: number; interest: number; balance: number }[] {
  const schedule: { month: number; principal: number; interest: number; balance: number }[] = [];
  const monthlyRate = annualRate / 12;
  let balance = principal;
  
  const amortizingMonths = tenorMonths - gracePeriodMonths;
  
  for (let month = 1; month <= tenorMonths; month++) {
    const interest = balance * monthlyRate;
    let principalPayment = 0;
    
    if (month > gracePeriodMonths) {
      switch (amortizationType) {
        case 'bullet':
          principalPayment = month === tenorMonths ? balance : 0;
          break;
        case 'amortizing':
          principalPayment = principal / amortizingMonths;
          break;
        case 'annuity':
          const annuity = (principal * monthlyRate) / 
                         (1 - Math.pow(1 + monthlyRate, -amortizingMonths));
          principalPayment = annuity - interest;
          break;
      }
    }
    
    balance = Math.max(0, balance - principalPayment);
    
    schedule.push({
      month,
      principal: principalPayment,
      interest,
      balance,
    });
  }
  
  return schedule;
}

/**
 * Aggregate monthly cash flows to annual
 */
export function aggregateToAnnual(
  monthlyCashFlows: CashFlowProjection[]
): CashFlowProjection[] {
  const annualMap = new Map<number, CashFlowProjection>();
  
  monthlyCashFlows.forEach(monthly => {
    const year = monthly.startDate.getFullYear();
    
    if (!annualMap.has(year)) {
      annualMap.set(year, {
        ...monthly,
        period: year,
        periodType: 'annual',
      });
    } else {
      const existing = annualMap.get(year)!;
      // Sum numeric fields
      existing.revenue.total += monthly.revenue.total;
      existing.operatingCosts.total += monthly.operatingCosts.total;
      existing.ebitda += monthly.ebitda;
      existing.depreciation += monthly.depreciation;
      existing.ebit += monthly.ebit;
      existing.netIncome += monthly.netIncome;
      existing.fcff += monthly.fcff;
      existing.fcfe += monthly.fcfe;
      existing.capex += monthly.capex;
      if (monthly.debtDrawdown) existing.debtDrawdown = (existing.debtDrawdown || 0) + monthly.debtDrawdown;
      if (monthly.principalRepayment) existing.principalRepayment = (existing.principalRepayment || 0) + monthly.principalRepayment;
      if (monthly.dividends) existing.dividends = (existing.dividends || 0) + monthly.dividends;
    }
  });
  
  return Array.from(annualMap.values()).sort((a, b) => a.period - b.period);
}

/**
 * Calculate return metrics from cash flows
 */
export function calculateReturnMetrics(
  equityCashFlows: number[],
  projectCashFlows: number[],
  wacc: number,
  costOfEquity: number
): {
  projectIRR: number;
  equityIRR: number;
  npv: number;
  npvAtWacc: number;
  npvAtCostOfEquity: number;
  moic: number;
  paybackPeriod: number;
  discountedPaybackPeriod: number;
  returnsByYear: AnnualReturn[];
} {
  const projectIRR = calculateIRR(projectCashFlows);
  const equityIRR = calculateIRR(equityCashFlows);
  const npv = calculateNPV(projectCashFlows, wacc);
  
  const totalInvestment = equityCashFlows
    .filter(cf => cf < 0)
    .reduce((sum, cf) => sum + cf, 0);
  const totalDistributions = equityCashFlows
    .filter(cf => cf > 0)
    .reduce((sum, cf) => sum + cf, 0);
  
  return {
    projectIRR,
    equityIRR,
    npv,
    npvAtWacc: npv,
    npvAtCostOfEquity: calculateNPV(equityCashFlows, costOfEquity),
    moic: calculateMOIC(totalDistributions, totalInvestment),
    paybackPeriod: calculatePaybackPeriod(equityCashFlows),
    discountedPaybackPeriod: calculateDiscountedPayback(equityCashFlows, costOfEquity),
    returnsByYear: calculateAnnualReturns(equityCashFlows),
  };
}

function calculateAnnualReturns(cashFlows: number[]): AnnualReturn[] {
  let cumulative = 0;
  const totalInvestment = Math.abs(cashFlows.filter(cf => cf < 0).reduce((s, cf) => s + cf, 0));
  
  return cashFlows.map((cf, year) => {
    cumulative += cf;
    return {
      year,
      cashFlow: cf,
      cumulativeCashFlow: cumulative,
      cumulativeReturn: totalInvestment > 0 ? cumulative / totalInvestment : 0,
      moic: totalInvestment > 0 ? Math.max(0, cumulative + totalInvestment) / totalInvestment : 0,
    };
  });
}

/**
 * Calculate break-even analysis
 */
export function calculateBreakEvenUtilization(
  fixedCosts: number,
  variableCostPerUnit: number,
  pricePerUnit: number,
  capacity: number
): number {
  const contributionMargin = pricePerUnit - variableCostPerUnit;
  if (contributionMargin <= 0) return Infinity;
  
  const breakEvenUnits = fixedCosts / contributionMargin;
  return breakEvenUnits / capacity;
}

/**
 * Calculate break-even price
 */
export function calculateBreakEvenPrice(
  fixedCosts: number,
  variableCostPerUnit: number,
  volume: number
): number {
  if (volume === 0) return Infinity;
  return (fixedCosts / volume) + variableCostPerUnit;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format currency
 */
export function formatCurrencyValue(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format large currency value with abbreviation
 */
export function formatLargeCurrency(value: number, currency: string = 'USD'): string {
  const symbol = currency === 'USD' ? '$' : currency;
  
  if (Math.abs(value) >= 1_000_000_000) {
    return `${symbol}${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${symbol}${(value / 1_000).toFixed(0)}K`;
  }
  return `${symbol}${value.toFixed(0)}`;
}
