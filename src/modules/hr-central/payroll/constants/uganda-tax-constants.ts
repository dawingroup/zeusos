/**
 * Uganda Tax Constants and Configuration
 * DawinOS HR Central - Payroll Module
 * 
 * Contains all Uganda-specific tax rates, bands, and payroll configurations
 * per Uganda Revenue Authority (URA) regulations.
 */

/**
 * Uganda PAYE Tax Bands (Effective July 2023)
 * Progressive tax rates on monthly income
 */
export const UGANDA_PAYE_BANDS = [
  {
    id: 'band_1',
    minAmount: 0,
    maxAmount: 235000,
    rate: 0,
    label: 'Tax-free threshold',
    description: 'First UGX 235,000 per month is tax-free'
  },
  {
    id: 'band_2',
    minAmount: 235001,
    maxAmount: 335000,
    rate: 0.10,
    label: '10% Band',
    description: '10% on income between UGX 235,001 and UGX 335,000'
  },
  {
    id: 'band_3',
    minAmount: 335001,
    maxAmount: 410000,
    rate: 0.20,
    label: '20% Band',
    description: '20% on income between UGX 335,001 and UGX 410,000'
  },
  {
    id: 'band_4',
    minAmount: 410001,
    maxAmount: 10000000,
    rate: 0.30,
    label: '30% Band',
    description: '30% on income between UGX 410,001 and UGX 10,000,000'
  },
  {
    id: 'band_5',
    minAmount: 10000001,
    maxAmount: Infinity,
    rate: 0.40,
    label: '40% Band',
    description: '40% on income above UGX 10,000,000'
  }
] as const;

export type PAYEBandId = typeof UGANDA_PAYE_BANDS[number]['id'];

/**
 * NSSF Contribution Rates
 * Employee: 5% of gross salary
 * Employer: 10% of gross salary
 * Maximum contribution cap: UGX 1,800,000 per month
 */
export const NSSF_CONFIG = {
  employeeRate: 0.05,
  employerRate: 0.10,
  maxContributionBase: 21600000, // Annual cap for contributions (UGX 1,800,000 x 12)
  monthlyMaxContributionBase: 1800000, // Monthly cap
  effectiveDate: '2023-01-01',
  minimumAge: 16,
  maximumAge: 55, // After 55, contributions are optional
  exemptCategories: ['expatriate', 'diplomat', 'volunteer'] as const
} as const;

/**
 * Local Service Tax (LST) Annual Bands
 * Based on annual gross income
 * Collected monthly (annual amount / 12)
 */
export const LST_BANDS = [
  {
    id: 'lst_exempt',
    minAnnualIncome: 0,
    maxAnnualIncome: 2340000,
    annualTax: 0,
    label: 'Exempt',
    description: 'Annual income below UGX 2,340,000 - Exempt from LST'
  },
  {
    id: 'lst_band_1',
    minAnnualIncome: 2340001,
    maxAnnualIncome: 4020000,
    annualTax: 10000,
    label: 'Band 1',
    description: 'UGX 2,340,001 - 4,020,000: UGX 10,000/year'
  },
  {
    id: 'lst_band_2',
    minAnnualIncome: 4020001,
    maxAnnualIncome: 4920000,
    annualTax: 20000,
    label: 'Band 2',
    description: 'UGX 4,020,001 - 4,920,000: UGX 20,000/year'
  },
  {
    id: 'lst_band_3',
    minAnnualIncome: 4920001,
    maxAnnualIncome: 5880000,
    annualTax: 30000,
    label: 'Band 3',
    description: 'UGX 4,920,001 - 5,880,000: UGX 30,000/year'
  },
  {
    id: 'lst_band_4',
    minAnnualIncome: 5880001,
    maxAnnualIncome: 7920000,
    annualTax: 40000,
    label: 'Band 4',
    description: 'UGX 5,880,001 - 7,920,000: UGX 40,000/year'
  },
  {
    id: 'lst_band_5',
    minAnnualIncome: 7920001,
    maxAnnualIncome: 9960000,
    annualTax: 60000,
    label: 'Band 5',
    description: 'UGX 7,920,001 - 9,960,000: UGX 60,000/year'
  },
  {
    id: 'lst_band_6',
    minAnnualIncome: 9960001,
    maxAnnualIncome: 14760000,
    annualTax: 80000,
    label: 'Band 6',
    description: 'UGX 9,960,001 - 14,760,000: UGX 80,000/year'
  },
  {
    id: 'lst_band_7',
    minAnnualIncome: 14760001,
    maxAnnualIncome: Infinity,
    annualTax: 100000,
    label: 'Band 7',
    description: 'Above UGX 14,760,000: UGX 100,000/year'
  }
] as const;

export type LSTBandId = typeof LST_BANDS[number]['id'];

/**
 * Payment Frequency Configurations
 */
export const PAYMENT_FREQUENCIES = {
  monthly: {
    id: 'monthly',
    label: 'Monthly',
    periodsPerYear: 12,
    daysPerPeriod: 30
  },
  bi_weekly: {
    id: 'bi_weekly',
    label: 'Bi-Weekly',
    periodsPerYear: 26,
    daysPerPeriod: 14
  },
  weekly: {
    id: 'weekly',
    label: 'Weekly',
    periodsPerYear: 52,
    daysPerPeriod: 7
  },
  daily: {
    id: 'daily',
    label: 'Daily',
    periodsPerYear: 260, // Working days
    daysPerPeriod: 1
  }
} as const;

export type PaymentFrequency = keyof typeof PAYMENT_FREQUENCIES;

/**
 * Allowance Tax Treatment
 */
export const ALLOWANCE_TAX_TREATMENT = {
  housing: {
    taxable: true,
    taxRate: 1.0, // 100% taxable
    nssfApplicable: false,
    description: 'Housing allowance is fully taxable'
  },
  transport: {
    taxable: true,
    taxRate: 1.0,
    nssfApplicable: false,
    description: 'Transport allowance is fully taxable'
  },
  medical: {
    taxable: false,
    taxRate: 0,
    nssfApplicable: false,
    description: 'Medical allowance is tax-exempt when used for medical purposes'
  },
  lunch: {
    taxable: true,
    taxRate: 1.0,
    nssfApplicable: false,
    description: 'Lunch allowance is fully taxable'
  },
  communication: {
    taxable: true,
    taxRate: 1.0,
    nssfApplicable: false,
    description: 'Communication allowance is fully taxable'
  },
  hardship: {
    taxable: true,
    taxRate: 1.0,
    nssfApplicable: false,
    description: 'Hardship allowance is fully taxable'
  },
  responsibility: {
    taxable: true,
    taxRate: 1.0,
    nssfApplicable: false,
    description: 'Responsibility allowance is fully taxable'
  },
  overtime: {
    taxable: true,
    taxRate: 1.0,
    nssfApplicable: true,
    description: 'Overtime is fully taxable and NSSF-applicable'
  },
  bonus: {
    taxable: true,
    taxRate: 1.0,
    nssfApplicable: false,
    description: 'Bonus is fully taxable'
  },
  commission: {
    taxable: true,
    taxRate: 1.0,
    nssfApplicable: true,
    description: 'Commission is fully taxable and NSSF-applicable'
  },
  acting: {
    taxable: true,
    taxRate: 1.0,
    nssfApplicable: false,
    description: 'Acting allowance is fully taxable'
  },
  fuel: {
    taxable: true,
    taxRate: 1.0,
    nssfApplicable: false,
    description: 'Fuel allowance is fully taxable'
  },
  entertainment: {
    taxable: true,
    taxRate: 1.0,
    nssfApplicable: false,
    description: 'Entertainment allowance is fully taxable'
  },
  other: {
    taxable: true,
    taxRate: 1.0,
    nssfApplicable: false,
    description: 'Other allowances are taxable by default'
  }
} as const;

export type AllowanceType = keyof typeof ALLOWANCE_TAX_TREATMENT;

/**
 * Deduction Categories
 */
export const DEDUCTION_CATEGORIES = {
  statutory: {
    id: 'statutory',
    label: 'Statutory Deductions',
    types: ['paye', 'nssf_employee', 'lst'],
    mandatory: true
  },
  voluntary: {
    id: 'voluntary',
    label: 'Voluntary Deductions',
    types: ['pension', 'savings', 'insurance', 'union', 'sacco'],
    mandatory: false
  },
  recovery: {
    id: 'recovery',
    label: 'Recovery Deductions',
    types: ['loan', 'advance', 'overpayment', 'damage'],
    mandatory: true
  },
  court: {
    id: 'court',
    label: 'Court Orders',
    types: ['garnishment', 'child_support', 'maintenance'],
    mandatory: true
  }
} as const;

export type DeductionCategory = keyof typeof DEDUCTION_CATEGORIES;

/**
 * Payroll Calculation Configuration
 */
export const PAYROLL_CONFIG = {
  currency: 'UGX',
  currencySymbol: 'UGX',
  currencyLocale: 'en-UG',
  decimalPlaces: 0, // UGX doesn't use decimals
  roundingMethod: 'round' as const, // 'round' | 'floor' | 'ceil'
  
  // Working days configuration
  defaultWorkingDaysPerMonth: 22,
  defaultWorkingHoursPerDay: 8,
  overtimeMultiplier: 1.5,
  weekendOvertimeMultiplier: 2.0,
  holidayOvertimeMultiplier: 2.0,
  nightOvertimeMultiplier: 1.25,
  straightTimeOvertimeMultiplier: 1.0,
  
  // Proration settings
  prorationMethod: 'calendar_days' as const, // 'calendar_days' | 'working_days'
  includeJoiningMonth: true,
  includeExitMonth: true,
  
  // Retroactive adjustments
  maxRetroactiveMonths: 6,
  retroactiveAdjustmentLimit: 12,
  
  // Year-to-date tracking
  fiscalYearStart: 7, // July (month index 7 in 1-based)
  taxYearStart: 7, // July (Uganda tax year: July 1 - June 30)
  
  // Validation limits
  maxMonthlyGross: 500000000, // UGX 500 million
  minMonthlyGross: 0,
  maxAllowances: 20,
  maxDeductions: 20
} as const;

/**
 * Uganda Public Holidays (typical year)
 */
export const UGANDA_PUBLIC_HOLIDAYS = [
  { name: "New Year's Day", month: 1, day: 1 },
  { name: 'NRM Liberation Day', month: 1, day: 26 },
  { name: "Archbishop Janani Luwum Day", month: 2, day: 16 },
  { name: "International Women's Day", month: 3, day: 8 },
  { name: 'Labour Day', month: 5, day: 1 },
  { name: 'Uganda Martyrs Day', month: 6, day: 3 },
  { name: 'National Heroes Day', month: 6, day: 9 },
  { name: 'Independence Day', month: 10, day: 9 },
  { name: 'Christmas Day', month: 12, day: 25 },
  { name: 'Boxing Day', month: 12, day: 26 }
  // Easter holidays are variable and should be calculated
] as const;

/**
 * Payroll Status Flow
 */
export const PAYROLL_STATUS_FLOW = {
  draft: ['processing', 'cancelled'],
  processing: ['pending_approval', 'draft'],
  pending_approval: ['approved', 'draft'],
  approved: ['pending_payment', 'reversed'],
  pending_payment: ['paid', 'reversed'],
  paid: ['reversed'],
  cancelled: [],
  reversed: []
} as const;

export type PayrollStatus = keyof typeof PAYROLL_STATUS_FLOW;

/**
 * Earnings type labels
 */
export const EARNINGS_TYPE_LABELS: Record<string, string> = {
  basic_salary: 'Basic Salary',
  allowance: 'Allowance',
  overtime: 'Overtime',
  bonus: 'Bonus',
  commission: 'Commission',
  arrears: 'Arrears',
  other: 'Other'
};

/**
 * Deduction type labels
 */
export const DEDUCTION_TYPE_LABELS: Record<string, string> = {
  paye: 'PAYE',
  nssf_employee: 'NSSF (Employee)',
  nssf_employer: 'NSSF (Employer)',
  lst: 'Local Service Tax',
  pension: 'Pension',
  loan: 'Loan Recovery',
  advance: 'Salary Advance Recovery',
  savings: 'Savings',
  insurance: 'Insurance',
  union: 'Union Dues',
  sacco: 'SACCO Contribution',
  garnishment: 'Garnishment',
  child_support: 'Child Support',
  maintenance: 'Maintenance',
  overpayment: 'Overpayment Recovery',
  damage: 'Damage Recovery',
  other: 'Other'
};
