/**
 * Tax Calculation Utilities
 * DawinOS HR Central - Payroll Module
 * 
 * Core calculation functions for Uganda tax computations:
 * PAYE, NSSF, LST, overtime, proration, and related utilities.
 */

import { 
  UGANDA_PAYE_BANDS, 
  NSSF_CONFIG, 
  LST_BANDS,
  PAYROLL_CONFIG,
  AllowanceType,
  ALLOWANCE_TAX_TREATMENT
} from '../constants/uganda-tax-constants';
import { 
  PAYEBreakdown, 
  NSSFBreakdown, 
  LSTBreakdown,
  EarningsItem
} from '../types/payroll.types';

// ============================================================================
// PAYE Calculations
// ============================================================================

/**
 * Calculate PAYE (Pay As You Earn) tax
 * Uses progressive tax bands per Uganda tax law
 * 
 * @param monthlyTaxableIncome - Total taxable income for the month
 * @returns PAYEBreakdown with band-by-band calculation
 */
export function calculatePAYE(monthlyTaxableIncome: number): PAYEBreakdown {
  const taxableBands: PAYEBreakdown['taxableBands'] = [];
  let remainingIncome = Math.max(0, monthlyTaxableIncome);
  let totalPAYE = 0;
  let previousMax = 0;

  for (const band of UGANDA_PAYE_BANDS) {
    if (remainingIncome <= 0) break;

    // Calculate the width of this band
    const bandStart = band.minAmount;
    const bandEnd = band.maxAmount === Infinity ? Infinity : band.maxAmount;
    const bandWidth = bandEnd === Infinity 
      ? remainingIncome 
      : Math.max(0, bandEnd - Math.max(bandStart, previousMax));
    
    // Calculate income that falls in this band
    const incomeInBand = Math.min(remainingIncome, bandWidth);
    
    if (incomeInBand > 0) {
      const taxForBand = roundCurrency(incomeInBand * band.rate);
      
      taxableBands.push({
        bandId: band.id,
        bandLabel: band.label,
        incomeInBand: roundCurrency(incomeInBand),
        rate: band.rate,
        taxAmount: taxForBand
      });

      totalPAYE += taxForBand;
      remainingIncome -= incomeInBand;
    }
    
    previousMax = bandEnd === Infinity ? previousMax : bandEnd;
  }

  const effectiveRate = monthlyTaxableIncome > 0 
    ? totalPAYE / monthlyTaxableIncome 
    : 0;

  return {
    grossTaxableIncome: roundCurrency(monthlyTaxableIncome),
    taxableBands,
    totalPAYE: roundCurrency(totalPAYE),
    effectiveRate: Math.round(effectiveRate * 10000) / 10000, // 4 decimal places
    netPAYE: roundCurrency(totalPAYE) // After any reliefs (none applied by default)
  };
}

/**
 * Calculate annual PAYE from monthly taxable income
 * Useful for projections and tax planning
 */
export function calculateAnnualPAYE(monthlyTaxableIncome: number): number {
  const monthlyPAYE = calculatePAYE(monthlyTaxableIncome);
  return roundCurrency(monthlyPAYE.netPAYE * 12);
}

// ============================================================================
// NSSF Calculations
// ============================================================================

/**
 * Calculate NSSF contributions
 * Employee: 5%, Employer: 10%
 * Capped at maximum contribution base
 * 
 * @param nssfApplicableGross - Gross amount subject to NSSF
 * @param options - Optional parameters for exemptions
 * @returns NSSFBreakdown with contribution details
 */
export function calculateNSSF(
  nssfApplicableGross: number,
  options?: {
    exemptionReason?: string;
    employeeAge?: number;
    employmentCategory?: string;
  }
): NSSFBreakdown {
  // Check for explicit exemption
  if (options?.exemptionReason) {
    return {
      nssfApplicableGross: roundCurrency(nssfApplicableGross),
      contributionBase: 0,
      employeeContribution: 0,
      employerContribution: 0,
      totalContribution: 0,
      cappedAtMaximum: false,
      exemptionReason: options.exemptionReason,
      notes: `Exempt from NSSF: ${options.exemptionReason}` 
    };
  }

  // Check age-based exemption (optional contributions after 55)
  if (options?.employeeAge && options.employeeAge > NSSF_CONFIG.maximumAge) {
    return {
      nssfApplicableGross: roundCurrency(nssfApplicableGross),
      contributionBase: 0,
      employeeContribution: 0,
      employerContribution: 0,
      totalContribution: 0,
      cappedAtMaximum: false,
      exemptionReason: 'Age above 55 - contributions optional',
      notes: 'Employee is above 55 years. NSSF contributions are optional.'
    };
  }

  // Check category-based exemption
  if (options?.employmentCategory && 
      (NSSF_CONFIG.exemptCategories as readonly string[]).includes(options.employmentCategory)) {
    return {
      nssfApplicableGross: roundCurrency(nssfApplicableGross),
      contributionBase: 0,
      employeeContribution: 0,
      employerContribution: 0,
      totalContribution: 0,
      cappedAtMaximum: false,
      exemptionReason: `Category exempt: ${options.employmentCategory}` 
    };
  }

  // Apply monthly cap
  const contributionBase = Math.min(
    nssfApplicableGross, 
    NSSF_CONFIG.monthlyMaxContributionBase
  );
  const cappedAtMaximum = nssfApplicableGross > NSSF_CONFIG.monthlyMaxContributionBase;

  const employeeContribution = roundCurrency(contributionBase * NSSF_CONFIG.employeeRate);
  const employerContribution = roundCurrency(contributionBase * NSSF_CONFIG.employerRate);

  return {
    nssfApplicableGross: roundCurrency(nssfApplicableGross),
    contributionBase: roundCurrency(contributionBase),
    employeeContribution,
    employerContribution,
    totalContribution: employeeContribution + employerContribution,
    cappedAtMaximum,
    notes: cappedAtMaximum 
      ? `Contribution capped at UGX ${formatCurrency(NSSF_CONFIG.monthlyMaxContributionBase)} monthly limit` 
      : undefined
  };
}

// ============================================================================
// LST Calculations
// ============================================================================

/**
 * Calculate Local Service Tax (LST)
 * Based on projected annual income
 * 
 * @param monthlyGross - Current month's gross pay
 * @param yearToDateGross - Gross earnings so far this fiscal year
 * @param yearToDateLSTPaid - LST already paid this fiscal year
 * @param remainingMonthsInYear - Months remaining in fiscal year
 * @returns LSTBreakdown with monthly amount
 */
export function calculateLST(
  monthlyGross: number,
  yearToDateGross: number = 0,
  yearToDateLSTPaid: number = 0,
  remainingMonthsInYear: number = 12
): LSTBreakdown {
  // Project annual income based on current earnings
  const projectedAnnualIncome = yearToDateGross + (monthlyGross * remainingMonthsInYear);
  
  // Find applicable LST band
  let applicableBand: typeof LST_BANDS[number] = LST_BANDS[0];
  for (const band of LST_BANDS) {
    if (projectedAnnualIncome >= band.minAnnualIncome && 
        (band.maxAnnualIncome === Infinity || projectedAnnualIncome <= band.maxAnnualIncome)) {
      applicableBand = band;
      break;
    }
  }

  const annualLST = applicableBand.annualTax;
  const remainingLST = Math.max(0, annualLST - yearToDateLSTPaid);
  
  // Calculate monthly LST
  // If remaining months is 0 or less, pay all remaining in current month
  const monthlyLST = remainingMonthsInYear > 0 
    ? roundCurrency(remainingLST / remainingMonthsInYear)
    : remainingLST;

  return {
    projectedAnnualIncome: roundCurrency(projectedAnnualIncome),
    applicableBand: applicableBand.id,
    bandLabel: applicableBand.label,
    annualLST,
    monthlyLST,
    yearToDatePaid: yearToDateLSTPaid,
    remainingForYear: remainingLST
  };
}

// ============================================================================
// Income Calculations
// ============================================================================

/**
 * Calculate taxable income from earnings
 */
export function calculateTaxableIncome(earnings: EarningsItem[]): number {
  return roundCurrency(
    earnings.reduce((total, earning) => {
      if (earning.taxable) {
        return total + earning.taxableAmount;
      }
      return total;
    }, 0)
  );
}

/**
 * Calculate NSSF-applicable income from earnings
 */
export function calculateNSSFApplicableIncome(earnings: EarningsItem[]): number {
  return roundCurrency(
    earnings.reduce((total, earning) => {
      if (earning.nssfApplicable) {
        return total + earning.nssfApplicableAmount;
      }
      return total;
    }, 0)
  );
}

/**
 * Determine tax treatment for an allowance type
 */
export function getAllowanceTaxTreatment(
  type: AllowanceType | string
): { taxable: boolean; taxRate: number; nssfApplicable: boolean; description: string } {
  const treatment = ALLOWANCE_TAX_TREATMENT[type as AllowanceType];
  if (treatment) {
    return {
      taxable: treatment.taxable,
      taxRate: treatment.taxRate,
      nssfApplicable: treatment.nssfApplicable,
      description: treatment.description
    };
  }
  
  // Default: fully taxable, not NSSF applicable
  return { 
    taxable: true, 
    taxRate: 1.0, 
    nssfApplicable: false,
    description: 'Default tax treatment - fully taxable'
  };
}

// ============================================================================
// Overtime Calculations
// ============================================================================

/**
 * Calculate overtime pay
 *
 * @param basicSalary - Monthly basic salary
 * @param hours - Overtime hours worked
 * @param type - Type of overtime
 * @param workingHoursPerMonth - Total working hours per month (default: 22 days x 8 hours)
 * @returns Overtime calculation breakdown
 */
export function calculateOvertime(
  basicSalary: number,
  hours: number,
  type: 'regular' | 'weekend' | 'holiday' | 'night' | 'straight_time',
  workingHoursPerMonth: number = PAYROLL_CONFIG.defaultWorkingDaysPerMonth *
                                   PAYROLL_CONFIG.defaultWorkingHoursPerDay
): { hourlyRate: number; multiplier: number; amount: number } {
  const hourlyRate = basicSalary / workingHoursPerMonth;

  let multiplier: number;
  switch (type) {
    case 'weekend':
      multiplier = PAYROLL_CONFIG.weekendOvertimeMultiplier;
      break;
    case 'holiday':
      multiplier = PAYROLL_CONFIG.holidayOvertimeMultiplier;
      break;
    case 'night':
      multiplier = PAYROLL_CONFIG.nightOvertimeMultiplier;
      break;
    case 'straight_time':
      multiplier = PAYROLL_CONFIG.straightTimeOvertimeMultiplier;
      break;
    default:
      multiplier = PAYROLL_CONFIG.overtimeMultiplier;
  }

  const amount = roundCurrency(hourlyRate * multiplier * hours);

  return {
    hourlyRate: roundCurrency(hourlyRate),
    multiplier,
    amount
  };
}

/**
 * Calculate hourly rate from monthly salary
 */
export function calculateHourlyRate(
  monthlySalary: number,
  workingDaysPerMonth: number = PAYROLL_CONFIG.defaultWorkingDaysPerMonth,
  hoursPerDay: number = PAYROLL_CONFIG.defaultWorkingHoursPerDay
): number {
  return roundCurrency(monthlySalary / (workingDaysPerMonth * hoursPerDay));
}

/**
 * Calculate daily rate from monthly salary
 */
export function calculateDailyRate(
  monthlySalary: number,
  workingDaysPerMonth: number = PAYROLL_CONFIG.defaultWorkingDaysPerMonth
): number {
  return roundCurrency(monthlySalary / workingDaysPerMonth);
}

// ============================================================================
// Proration Calculations
// ============================================================================

/**
 * Calculate proration factor for partial month
 * 
 * @param daysWorked - Number of days worked in the month
 * @param totalDaysInMonth - Total days in the month (calendar or working)
 * @param method - Proration method to use
 * @returns Proration factor between 0 and 1
 */
export function calculateProrationFactor(
  daysWorked: number,
  totalDaysInMonth: number,
  method: 'calendar_days' | 'working_days' = PAYROLL_CONFIG.prorationMethod
): number {
  if (totalDaysInMonth <= 0) return 0;
  
  if (method === 'working_days') {
    const workingDays = PAYROLL_CONFIG.defaultWorkingDaysPerMonth;
    return Math.min(daysWorked / workingDays, 1);
  }
  
  return Math.min(daysWorked / totalDaysInMonth, 1);
}

/**
 * Calculate prorated amount
 */
export function calculateProratedAmount(
  fullAmount: number,
  prorationFactor: number
): number {
  return roundCurrency(fullAmount * prorationFactor);
}

// ============================================================================
// Retroactive Calculations
// ============================================================================

/**
 * Calculate retroactive salary adjustment
 * 
 * @param previousSalary - Previous monthly salary
 * @param newSalary - New monthly salary
 * @param months - Number of months to apply retroactively
 * @returns Adjustment breakdown
 */
export function calculateRetroactiveAdjustment(
  previousSalary: number,
  newSalary: number,
  months: number
): {
  monthlyDifference: number;
  totalAdjustment: number;
  adjustmentBreakdown: Array<{ month: number; year: number; amount: number }>;
} {
  const monthlyDifference = newSalary - previousSalary;
  const totalAdjustment = monthlyDifference * months;
  
  // Generate breakdown for each month (going backwards from current)
  const adjustmentBreakdown: Array<{ month: number; year: number; amount: number }> = [];
  const now = new Date();
  
  for (let i = 0; i < months; i++) {
    const adjustmentDate = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
    adjustmentBreakdown.push({
      month: adjustmentDate.getMonth() + 1,
      year: adjustmentDate.getFullYear(),
      amount: roundCurrency(monthlyDifference)
    });
  }

  return {
    monthlyDifference: roundCurrency(monthlyDifference),
    totalAdjustment: roundCurrency(totalAdjustment),
    adjustmentBreakdown: adjustmentBreakdown.reverse()
  };
}

// ============================================================================
// Currency and Formatting Utilities
// ============================================================================

/**
 * Round to currency precision (no decimals for UGX)
 */
export function roundCurrency(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  
  const method = PAYROLL_CONFIG.roundingMethod as string;
  if (method === 'floor') {
    return Math.floor(amount);
  } else if (method === 'ceil') {
    return Math.ceil(amount);
  }
  return Math.round(amount);
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(PAYROLL_CONFIG.currencyLocale, {
    style: 'currency',
    currency: PAYROLL_CONFIG.currency,
    minimumFractionDigits: PAYROLL_CONFIG.decimalPlaces,
    maximumFractionDigits: PAYROLL_CONFIG.decimalPlaces
  }).format(amount);
}

/**
 * Format currency without symbol
 */
export function formatCurrencyNumber(amount: number): string {
  return new Intl.NumberFormat(PAYROLL_CONFIG.currencyLocale, {
    minimumFractionDigits: PAYROLL_CONFIG.decimalPlaces,
    maximumFractionDigits: PAYROLL_CONFIG.decimalPlaces
  }).format(amount);
}

/**
 * Convert number to words (for payslips)
 */
export function numberToWords(num: number): string {
  if (num === 0) return 'Zero Uganda Shillings Only';
  if (!Number.isFinite(num) || num < 0) return '';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  const convertGroup = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    }
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertGroup(n % 100) : '');
  };

  const groups = [
    { value: 1000000000, name: 'Billion' },
    { value: 1000000, name: 'Million' },
    { value: 1000, name: 'Thousand' },
    { value: 1, name: '' },
  ];

  let result = '';
  let remaining = Math.floor(num);

  for (const group of groups) {
    if (remaining >= group.value) {
      const count = Math.floor(remaining / group.value);
      remaining = remaining % group.value;
      result += (result ? ' ' : '') + convertGroup(count) + (group.name ? ' ' + group.name : '');
    }
  }

  return result.trim() + ' Uganda Shillings Only';
}

// ============================================================================
// Date and Period Utilities
// ============================================================================

/**
 * Get tax year from date
 * Uganda tax year: July 1 - June 30
 */
export function getTaxYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-based
  
  if (month >= PAYROLL_CONFIG.taxYearStart) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

/**
 * Get fiscal year start and end dates
 */
export function getFiscalYearDates(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  let startYear: number;
  if (month >= PAYROLL_CONFIG.fiscalYearStart) {
    startYear = year;
  } else {
    startYear = year - 1;
  }
  
  const start = new Date(startYear, PAYROLL_CONFIG.fiscalYearStart - 1, 1);
  const end = new Date(startYear + 1, PAYROLL_CONFIG.fiscalYearStart - 1, 0); // Last day of June
  
  return { start, end };
}

/**
 * Calculate number of days in a month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculate remaining months in fiscal year
 */
export function getRemainingMonthsInFiscalYear(date: Date): number {
  const { end } = getFiscalYearDates(date);
  const monthsDiff = (end.getFullYear() - date.getFullYear()) * 12 + 
                     (end.getMonth() - date.getMonth()) + 1;
  return Math.max(0, Math.min(12, monthsDiff));
}

/**
 * Get period string (YYYY-MM format)
 */
export function getPeriodString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Parse period string to year and month
 */
export function parsePeriodString(period: string): { year: number; month: number } {
  const [yearStr, monthStr] = period.split('-');
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10)
  };
}

/**
 * Get month name
 */
export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
}

/**
 * Calculate working days in a month (excluding weekends)
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const daysInMonth = getDaysInMonth(year, month);
  let workingDays = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }
  
  return workingDays;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate payroll period
 */
export function isValidPayrollPeriod(year: number, month: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return false;
  if (year < 2020 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  return true;
}

/**
 * Check if period is in the past
 */
export function isPastPeriod(year: number, month: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  return year < currentYear || (year === currentYear && month < currentMonth);
}

/**
 * Check if period is current
 */
export function isCurrentPeriod(year: number, month: number): boolean {
  const now = new Date();
  return year === now.getFullYear() && month === (now.getMonth() + 1);
}
