/**
 * Payroll Calculator Service
 * ZeusOS HR Central - Payroll Module
 * 
 * Comprehensive payroll calculation engine with Uganda-specific
 * tax computations, proration, overtime, and deduction handling.
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc,
  query, 
  where, 
  orderBy,
  Timestamp,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from '../../../../shared/services/firebase/firestore';

import {
  EmployeePayroll,
  EarningsItem,
  DeductionItem,
  ProrationDetails,
  YearToDateTotals,
  CalculatePayrollInput,
  LoanRecovery,
  OvertimeRecord,
  PAYEBreakdown,
  NSSFBreakdown,
  LSTBreakdown,
  EmployeePayrollSummary,
  PayrollSummary
} from '../types/payroll.types';

import {
  calculatePAYE,
  calculateNSSF,
  calculateLST,
  calculateTaxableIncome,
  calculateNSSFApplicableIncome,
  calculateOvertime,
  calculateProrationFactor,
  getAllowanceTaxTreatment,
  roundCurrency,
  getTaxYear,
  getFiscalYearDates,
  getDaysInMonth,
  getRemainingMonthsInFiscalYear,
  getPeriodString
} from '../utils/tax-calculator';

import {
  AllowanceType
} from '../constants/uganda-tax-constants';

import { Employee } from '../../types/employee.types';
import { Contract } from '../../types/contract.types';

import { advanceService, otherDeductionsService } from './payroll-records.service';

// ============================================================================
// Collection Constants
// ============================================================================

const PAYROLL_COLLECTION = 'payroll';
// const PAYROLL_PERIODS_COLLECTION = 'payroll_periods';
const EMPLOYEE_COLLECTION = 'employees';
const CONTRACT_COLLECTION = 'contracts';
const LOAN_COLLECTION = 'loan_recoveries';
// Match the collection name used by the OvertimeTab / overtimeService —
// previously this read 'overtime_records' (the original schema) and so
// silently ignored every entry submitted through the UI.
const OVERTIME_COLLECTION = 'overtime';
const YTD_COLLECTION = 'payroll_ytd';
const ATTENDANCE_COLLECTION = 'attendance';
const SALARY_ADVANCES_COLLECTION = 'salaryAdvances';
const OTHER_DEDUCTIONS_COLLECTION = 'employeeDeductions';

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return doc(collection(db, '_')).id;
}

// ============================================================================
// Main Payroll Calculation
// ============================================================================

/**
 * Calculate payroll for a single employee
 */
export async function calculateEmployeePayroll(
  input: CalculatePayrollInput,
  performedBy: string
): Promise<EmployeePayroll> {
  const { employeeId, year, month, overrides, recalculate } = input;

  // Check for existing payroll
  const existingPayroll = await getEmployeePayrollForPeriod(employeeId, year, month);
  if (existingPayroll && !recalculate) {
    throw new Error(`Payroll already calculated for ${year}-${month}. Use recalculate option to override.`);
  }

  // Fetch employee data
  const employee = await getEmployee(employeeId);
  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`);
  }

  // Check employee status. Allowlist of statuses that still earn a
  // payslip: active, on_leave (paid leave categories like maternity /
  // study), and probation (probationary employees draw a full salary —
  // probation is a trial period, not a no-pay state). Terminated,
  // resigned, retired, and suspended are rejected by default; if you
  // need to pay a notice_period or final-month run, add the status
  // here explicitly so the call doesn't silently start paying.
  const PAYABLE_STATUSES = ['active', 'on_leave', 'probation'] as const;
  if (!(PAYABLE_STATUSES as readonly string[]).includes(employee.employmentStatus)) {
    throw new Error(`Cannot calculate payroll for employee with status: ${employee.employmentStatus}`);
  }

  // Fetch active contract
  const contract = await getActiveContract(employeeId);
  if (!contract) {
    throw new Error(`No active contract found for employee: ${employeeId}`);
  }

  // Fetch year-to-date totals
  const ytd = await getYearToDateTotals(employeeId, year, month);

  // Calculate proration. If the caller didn't pass an explicit
  // unpaidLeaveDays override, derive it from the attendance collection
  // for this period — so editing the matrix actually moves the gross.
  const unpaidLeaveDays = overrides?.unpaidLeaveDays
    ?? await getUnpaidAttendanceDaysForPeriod(employeeId, year, month);
  const proration = calculateProration(employee, year, month, unpaidLeaveDays);

  // Build earnings
  const earnings = await buildEarnings(
    employee,
    contract,
    proration,
    overrides,
    year,
    month
  );

  // Calculate totals
  const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
  const grossPay = roundCurrency(totalEarnings);
  const taxableIncome = calculateTaxableIncome(earnings);
  const nssfApplicableIncome = calculateNSSFApplicableIncome(earnings);

  // Calculate statutory deductions
  const payeBreakdown = calculatePAYE(taxableIncome);
  const nssfBreakdown = calculateNSSF(nssfApplicableIncome, {
    employeeAge: calculateAge(employee.dateOfBirth),
    employmentCategory: employee.employmentType
  });
  const lstBreakdown = calculateLST(
    grossPay,
    ytd.grossEarnings,
    ytd.lst,
    getRemainingMonthsInFiscalYear(new Date(year, month - 1, 1))
  );

  // Build deductions
  const deductions = await buildDeductions(
    employeeId,
    payeBreakdown,
    nssfBreakdown,
    lstBreakdown,
    contract,
    overrides,
    year,
    month
  );

  // Calculate deduction totals
  const totalStatutoryDeductions = deductions
    .filter(d => d.category === 'statutory')
    .reduce((sum, d) => sum + d.amount, 0);
  const totalVoluntaryDeductions = deductions
    .filter(d => d.category !== 'statutory')
    .reduce((sum, d) => sum + d.amount, 0);
  const totalDeductions = roundCurrency(totalStatutoryDeductions + totalVoluntaryDeductions);

  // Calculate net pay
  const netPay = roundCurrency(grossPay - totalDeductions);

  // Get payment details from employee
  const paymentDetails = getPaymentDetails(employee);

  // Build payroll record
  const payrollId = existingPayroll?.id || generateId();
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);
  const basicSalaryAmount = overrides?.basicSalary ?? contract.compensation.baseSalary;

  // Snapshot the employee's subsidiary allocation at calc time so
  // batch-scoped cost shares don't silently change if the employee's
  // split is edited later. Stored alongside hostSubsidiaryId
  // (= employee.subsidiaryId) for Model A intercompany recharge.
  const allocationSnapshot = Array.isArray(employee.subsidiaryAllocations) && employee.subsidiaryAllocations.length > 0
    ? employee.subsidiaryAllocations.map(a => ({
        subsidiaryId: a.subsidiaryId,
        allocationPercent: Math.max(0, Math.min(100, Number(a.allocationPercent) || 0)),
      }))
    : undefined;

  const payroll: EmployeePayroll = {
    id: payrollId,
    payrollPeriodId: '', // Will be set when added to batch
    subsidiaryId: employee.subsidiaryId,
    subsidiaryAllocations: allocationSnapshot,
    employeeId: employee.id,
    employeeNumber: employee.employeeNumber,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    departmentId: employee.position.departmentId,
    departmentName: '', // Will be resolved from department lookup
    position: employee.position.title,
    contractId: contract.id,

    year,
    month,
    periodStart,
    periodEnd,
    paymentDate: new Date(year, month - 1, 28), // Default to 28th
    paymentFrequency: (contract.compensation.paymentFrequency as EmployeePayroll['paymentFrequency']) || 'monthly',

    paymentMethod: paymentDetails.method,
    bankDetails: paymentDetails.bankDetails,
    mobileMoneyDetails: paymentDetails.mobileMoneyDetails,

    proration,
    basicSalary: roundCurrency(basicSalaryAmount * proration.prorationFactor),
    earnings,
    totalEarnings: roundCurrency(totalEarnings),
    grossPay,

    taxableIncome,
    payeBreakdown,
    nssfBreakdown,
    lstBreakdown,

    deductions,
    totalStatutoryDeductions: roundCurrency(totalStatutoryDeductions),
    totalVoluntaryDeductions: roundCurrency(totalVoluntaryDeductions),
    totalDeductions,

    netPay,

    ytd: updateYTD(ytd, {
      grossEarnings: grossPay,
      basicSalary: basicSalaryAmount * proration.prorationFactor,
      allowances: earnings.filter(e => e.type === 'allowance').reduce((s, e) => s + e.amount, 0),
      overtime: earnings.filter(e => e.type === 'overtime').reduce((s, e) => s + e.amount, 0),
      bonuses: earnings.filter(e => e.type === 'bonus').reduce((s, e) => s + e.amount, 0),
      commissions: earnings.filter(e => e.type === 'commission').reduce((s, e) => s + e.amount, 0),
      taxableEarnings: taxableIncome,
      nssfApplicableEarnings: nssfApplicableIncome,
      paye: payeBreakdown.netPAYE,
      nssfEmployee: nssfBreakdown.employeeContribution,
      nssfEmployer: nssfBreakdown.employerContribution,
      lst: lstBreakdown.monthlyLST,
      voluntaryDeductions: totalVoluntaryDeductions,
      netPay
    }, year, month),

    status: 'calculated',

    calculatedBy: performedBy,
    calculatedAt: new Date(),
    createdAt: existingPayroll?.createdAt || new Date(),
    updatedAt: new Date(),
    version: existingPayroll ? existingPayroll.version + 1 : 1
  };

  // Save payroll record
  await savePayroll(payroll);

  // Update YTD totals
  await saveYearToDateTotals(payroll.ytd, employeeId, year, month);

  return payroll;
}

// ============================================================================
// Earnings Building
// ============================================================================

/**
 * Build earnings array from contract and overrides
 */
async function buildEarnings(
  employee: Employee,
  contract: Contract,
  proration: ProrationDetails,
  overrides: CalculatePayrollInput['overrides'],
  year: number,
  month: number
): Promise<EarningsItem[]> {
  const earnings: EarningsItem[] = [];
  const compensation = contract.compensation;

  // Basic salary (prorated)
  const basicAmount = overrides?.basicSalary ?? compensation.baseSalary;
  const proratedBasic = roundCurrency(basicAmount * proration.prorationFactor);
  
  earnings.push({
    id: generateId(),
    type: 'basic_salary',
    category: 'basic',
    description: 'Basic Salary',
    amount: proratedBasic,
    taxable: true,
    taxableAmount: proratedBasic,
    nssfApplicable: true,
    nssfApplicableAmount: proratedBasic
  });

  // Contract allowances (prorated)
  if (compensation.allowances && Array.isArray(compensation.allowances)) {
    for (const allowance of compensation.allowances) {
      const treatment = getAllowanceTaxTreatment(allowance.type as AllowanceType);
      const proratedAmount = roundCurrency(allowance.amount * proration.prorationFactor);
      const isTaxable = allowance.taxable ?? treatment.taxable;
      
      earnings.push({
        id: generateId(),
        type: 'allowance',
        category: allowance.type as AllowanceType,
        description: formatAllowanceName(allowance.type),
        amount: proratedAmount,
        taxable: isTaxable,
        taxableAmount: isTaxable ? roundCurrency(proratedAmount * treatment.taxRate) : 0,
        nssfApplicable: treatment.nssfApplicable,
        nssfApplicableAmount: treatment.nssfApplicable ? proratedAmount : 0
      });
    }
  }

  // Overtime records — trust the stored amount (computed by the
  // overtimeService at create time using the employee's actual hourly
  // rate and the configured multiplier). Falling back to a recompute
  // from baseSalary leads to a UI/payslip mismatch when the salary
  // changes between approval and payroll run.
  const overtimeRecords = await getApprovedOvertimeForPeriod(employee.id, year, month);
  for (const overtime of overtimeRecords) {
    const storedAmount = Number((overtime as { amount?: number }).amount) || 0;
    const fallback = calculateOvertime(
      compensation.baseSalary,
      overtime.hours,
      overtime.type,
    );
    const amount = storedAmount > 0 ? storedAmount : fallback.amount;

    earnings.push({
      id: generateId(),
      type: 'overtime',
      category: 'overtime',
      description: `${formatOvertimeType(overtime.type)} Overtime - ${overtime.hours} hours`,
      amount,
      taxable: true,
      taxableAmount: amount,
      nssfApplicable: true,
      nssfApplicableAmount: amount,
      metadata: {
        hours: overtime.hours,
        rate: (overtime as { multiplier?: number }).multiplier ?? fallback.multiplier,
      },
    });
  }

  // Additional earnings from overrides
  if (overrides?.additionalEarnings) {
    for (const additional of overrides.additionalEarnings) {
      const treatment = getAllowanceTaxTreatment(additional.type as AllowanceType);
      const isTaxable = additional.taxable ?? treatment.taxable;
      
      earnings.push({
        id: generateId(),
        type: 'other',
        category: additional.type as AllowanceType,
        description: additional.description,
        amount: roundCurrency(additional.amount),
        taxable: isTaxable,
        taxableAmount: isTaxable ? roundCurrency(additional.amount * treatment.taxRate) : 0,
        nssfApplicable: treatment.nssfApplicable,
        nssfApplicableAmount: treatment.nssfApplicable ? roundCurrency(additional.amount) : 0
      });
    }
  }

  return earnings;
}

// ============================================================================
// Deductions Building
// ============================================================================

/**
 * Build deductions array
 */
async function buildDeductions(
  employeeId: string,
  payeBreakdown: PAYEBreakdown,
  nssfBreakdown: NSSFBreakdown,
  lstBreakdown: LSTBreakdown,
  contract: Contract,
  overrides: CalculatePayrollInput['overrides'],
  year: number,
  month: number
): Promise<DeductionItem[]> {
  const deductions: DeductionItem[] = [];

  // PAYE
  if (payeBreakdown.netPAYE > 0) {
    deductions.push({
      id: generateId(),
      type: 'paye',
      category: 'statutory',
      description: `PAYE - ${(payeBreakdown.effectiveRate * 100).toFixed(2)}% effective rate`,
      amount: payeBreakdown.netPAYE,
      mandatory: true
    });
  }

  // NSSF Employee Contribution
  if (nssfBreakdown.employeeContribution > 0) {
    deductions.push({
      id: generateId(),
      type: 'nssf_employee',
      category: 'statutory',
      description: 'NSSF Employee Contribution (5%)',
      amount: nssfBreakdown.employeeContribution,
      mandatory: true
    });
  }

  // LST
  if (lstBreakdown.monthlyLST > 0) {
    deductions.push({
      id: generateId(),
      type: 'lst',
      category: 'statutory',
      description: `Local Service Tax - ${lstBreakdown.bandLabel}`,
      amount: lstBreakdown.monthlyLST,
      mandatory: true
    });
  }

  // Contract-based deductions
  if (contract.compensation.deductions && Array.isArray(contract.compensation.deductions)) {
    for (const deduction of contract.compensation.deductions) {
      // Skip statutory deductions already handled
      if (['nssf', 'paye', 'lst'].includes(deduction.type)) continue;
      
      deductions.push({
        id: generateId(),
        type: deduction.type as DeductionItem['type'],
        category: deduction.mandatory ? 'statutory' : 'voluntary',
        description: `${formatDeductionType(deduction.type)} Deduction`,
        amount: roundCurrency(deduction.amount || 0),
        mandatory: deduction.mandatory ?? false
      });
    }
  }

  // Loan recoveries. Clamp the installment to the remaining balance so
  // the final period doesn't over-deduct the employee.
  const loanRecoveries = await getActiveLoanRecoveries(employeeId);
  for (const loan of loanRecoveries) {
    const balance = Number(loan.balanceRemaining);
    const installment = Number(loan.monthlyDeduction) || 0;
    const thisMonth = Number.isFinite(balance) && balance > 0
      ? Math.min(installment, balance)
      : installment;
    if (thisMonth <= 0) continue;
    deductions.push({
      id: generateId(),
      type: 'loan',
      category: 'recovery',
      description: `${formatLoanType(loan.loanType)} Recovery`,
      amount: roundCurrency(thisMonth),
      mandatory: true,
      reference: loan.id,
      metadata: {
        installmentNumber: loan.paidInstallments + 1,
        totalInstallments: loan.installments,
        balanceRemaining: loan.balanceRemaining,
        loanId: loan.id
      }
    });
  }

  // Salary advance recoveries — one line per active advance so we can
  // record recovery against the right advanceId when the payroll is
  // marked paid (see markPayrollPaid).
  const advances = await getActiveSalaryAdvancesForPeriod(employeeId, year, month);
  for (const adv of advances) {
    deductions.push({
      id: generateId(),
      type: 'advance',
      category: 'recovery',
      description: 'Salary Advance Recovery',
      amount: roundCurrency(adv.amount),
      mandatory: true,
      reference: adv.id,
      metadata: {
        advanceId: adv.id,
        installmentNumber: adv.installmentNumber,
        totalInstallments: adv.totalInstallments,
        balanceRemaining: adv.balanceRemaining,
      },
    });
  }

  // Other deductions: food contributions, savings, disciplinary
  // recoveries (damaged/lost property), one-time fines, etc. Each
  // deduction record's schedule is evaluated against the period.
  // Carry scheduleKind + deductionId so markPayrollPaid knows which
  // ones to amortise.
  const otherItems = await getOtherDeductionsForPeriod(employeeId, year, month);
  for (const item of otherItems) {
    // Categorize: statutory-style payroll deductions (savings, union)
    // belong to 'voluntary'; recoveries (property damage, overpayment)
    // belong to 'recovery'. Defaults to voluntary.
    const recoveryTypes = new Set(['property_damage', 'lost_property', 'overpayment']);
    const category: DeductionItem['category'] = recoveryTypes.has(item.type)
      ? 'recovery'
      : 'voluntary';
    deductions.push({
      id: generateId(),
      type: 'other' as DeductionItem['type'],
      category,
      description: item.description,
      amount: roundCurrency(item.amount),
      mandatory: false,
      reference: item.reference,
      metadata: {
        deductionId: item.reference,
        scheduleKind: item.scheduleKind,
        balanceRemaining: item.balanceRemaining,
      },
    });
  }

  // Additional deductions from overrides
  if (overrides?.additionalDeductions) {
    for (const additional of overrides.additionalDeductions) {
      deductions.push({
        id: generateId(),
        type: additional.type as DeductionItem['type'],
        category: 'voluntary',
        description: additional.description,
        amount: roundCurrency(additional.amount),
        mandatory: false
      });
    }
  }

  return deductions;
}

// ============================================================================
// Proration Calculation
// ============================================================================

/**
 * Calculate proration for partial month
 */
function calculateProration(
  employee: Employee,
  year: number,
  month: number,
  unpaidLeaveDays?: number
): ProrationDetails {
  const daysInMonth = getDaysInMonth(year, month);
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);
  
  const joiningDateTs = employee.employmentDates?.joiningDate;
  const exitDateTs = employee.employmentDates?.lastWorkingDate;
  const joiningDate = joiningDateTs ? (joiningDateTs.toDate?.() || new Date(joiningDateTs as any)) : null;
  const exitDate = exitDateTs ? (exitDateTs.toDate?.() || new Date(exitDateTs as any)) : null;

  let workedDays = daysInMonth;
  let reason: ProrationDetails['reason'] = 'none';
  let isProrated = false;
  let effectiveFrom: Date | undefined;
  let effectiveTo: Date | undefined;

  // Check if joined during this month
  if (joiningDate && joiningDate >= periodStart && joiningDate <= periodEnd) {
    workedDays = daysInMonth - joiningDate.getDate() + 1;
    reason = 'joining';
    isProrated = true;
    effectiveFrom = joiningDate;
  }

  // Check if exiting during this month
  if (exitDate && exitDate >= periodStart && exitDate <= periodEnd) {
    const exitDays = exitDate.getDate();
    workedDays = Math.min(workedDays, exitDays);
    reason = 'exit';
    isProrated = true;
    effectiveTo = exitDate;
  }

  // Deduct unpaid leave days
  if (unpaidLeaveDays && unpaidLeaveDays > 0) {
    workedDays = Math.max(0, workedDays - unpaidLeaveDays);
    reason = 'unpaid_leave';
    isProrated = true;
  }

  const prorationFactor = calculateProrationFactor(workedDays, daysInMonth);

  return {
    isProrated,
    reason,
    totalDays: daysInMonth,
    workedDays,
    prorationFactor,
    effectiveFrom,
    effectiveTo,
    unpaidDays: unpaidLeaveDays
  };
}

// ============================================================================
// Payment Details
// ============================================================================

/**
 * Get payment details from employee
 */
function getPaymentDetails(employee: Employee): {
  method: EmployeePayroll['paymentMethod'];
  bankDetails?: EmployeePayroll['bankDetails'];
  mobileMoneyDetails?: EmployeePayroll['mobileMoneyDetails'];
} {
  // Check preferred payment method and available accounts
  const primaryBank = employee.bankAccounts?.find(b => b.isPrimary) || employee.bankAccounts?.[0];
  const primaryMobile = employee.mobileMoneyAccounts?.find(m => m.isPrimary) || employee.mobileMoneyAccounts?.[0];

  // Check for bank details
  if (employee.preferredPaymentMethod === 'bank' && primaryBank?.accountNumber) {
    return {
      method: 'bank_transfer',
      bankDetails: {
        bankName: primaryBank.bankName || '',
        branchName: primaryBank.branchName,
        accountNumber: primaryBank.accountNumber,
        accountName: primaryBank.accountName || `${employee.firstName} ${employee.lastName}`,
        swiftCode: primaryBank.swiftCode
      }
    };
  }

  // Check for mobile money
  if (employee.preferredPaymentMethod === 'mobile_money' && primaryMobile?.phoneNumber) {
    return {
      method: 'mobile_money',
      mobileMoneyDetails: {
        provider: primaryMobile.provider as 'mtn' | 'airtel',
        phoneNumber: primaryMobile.phoneNumber,
        registeredName: primaryMobile.accountName || `${employee.firstName} ${employee.lastName}`
      }
    };
  }

  // Fallback to bank if available
  if (primaryBank?.accountNumber) {
    return {
      method: 'bank_transfer',
      bankDetails: {
        bankName: primaryBank.bankName || '',
        branchName: primaryBank.branchName,
        accountNumber: primaryBank.accountNumber,
        accountName: primaryBank.accountName || `${employee.firstName} ${employee.lastName}`,
        swiftCode: primaryBank.swiftCode
      }
    };
  }

  // Fallback to mobile money if available
  if (primaryMobile?.phoneNumber) {
    return {
      method: 'mobile_money',
      mobileMoneyDetails: {
        provider: primaryMobile.provider as 'mtn' | 'airtel',
        phoneNumber: primaryMobile.phoneNumber,
        registeredName: primaryMobile.accountName || `${employee.firstName} ${employee.lastName}`
      }
    };
  }

  return { method: 'cash' };
}

// ============================================================================
// YTD Calculations
// ============================================================================

/**
 * Update YTD totals with current period
 */
function updateYTD(
  ytd: YearToDateTotals,
  current: Partial<YearToDateTotals>,
  year: number,
  month: number
): YearToDateTotals {
  return {
    ...ytd,
    grossEarnings: ytd.grossEarnings + (current.grossEarnings || 0),
    basicSalary: ytd.basicSalary + (current.basicSalary || 0),
    allowances: ytd.allowances + (current.allowances || 0),
    overtime: ytd.overtime + (current.overtime || 0),
    bonuses: ytd.bonuses + (current.bonuses || 0),
    commissions: ytd.commissions + (current.commissions || 0),
    taxableEarnings: ytd.taxableEarnings + (current.taxableEarnings || 0),
    nssfApplicableEarnings: ytd.nssfApplicableEarnings + (current.nssfApplicableEarnings || 0),
    totalDeductions: ytd.totalDeductions + (current.paye || 0) + 
                     (current.nssfEmployee || 0) + (current.lst || 0) + 
                     (current.voluntaryDeductions || 0),
    paye: ytd.paye + (current.paye || 0),
    nssfEmployee: ytd.nssfEmployee + (current.nssfEmployee || 0),
    nssfEmployer: ytd.nssfEmployer + (current.nssfEmployer || 0),
    lst: ytd.lst + (current.lst || 0),
    voluntaryDeductions: ytd.voluntaryDeductions + (current.voluntaryDeductions || 0),
    netPay: ytd.netPay + (current.netPay || 0),
    periodsProcessed: ytd.periodsProcessed + 1,
    lastProcessedPeriod: getPeriodString(year, month)
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate age from date of birth.
 *
 * Accepts any of the date shapes Firestore round-trips can produce:
 *   - real Date instance
 *   - ISO string / millis number
 *   - Firestore Timestamp (has .toDate())
 *   - de-serialized Timestamp ({ seconds, nanoseconds }) — common when a
 *     doc is read through a path that strips the SDK's prototype.
 *
 * Returns 30 (a neutral default for NSSF age-band selection) when the
 * value is missing or can't be parsed, so the calculator never crashes
 * for one employee with a malformed DOB.
 */
function calculateAge(dateOfBirth?: unknown): number {
  if (!dateOfBirth) return 30;

  let birthDate: Date | undefined;
  if (dateOfBirth instanceof Date) {
    birthDate = dateOfBirth;
  } else if (typeof dateOfBirth === 'string' || typeof dateOfBirth === 'number') {
    birthDate = new Date(dateOfBirth);
  } else if (typeof dateOfBirth === 'object') {
    const v = dateOfBirth as { toDate?: () => Date; seconds?: number };
    if (typeof v.toDate === 'function') {
      try { birthDate = v.toDate(); } catch { /* fall through */ }
    }
    if (!birthDate && typeof v.seconds === 'number') {
      birthDate = new Date(v.seconds * 1000);
    }
  }

  if (!birthDate || isNaN(birthDate.getTime())) return 30;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Format allowance name for display
 */
function formatAllowanceName(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') + ' Allowance';
}

/**
 * Format overtime type for display
 */
function formatOvertimeType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format deduction type for display
 */
function formatDeductionType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format loan type for display
 */
function formatLoanType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// Data Access Functions
// ============================================================================

/**
 * Get employee by ID
 */
async function getEmployee(employeeId: string): Promise<Employee | null> {
  const docRef = doc(db, EMPLOYEE_COLLECTION, employeeId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return { id: docSnap.id, ...docSnap.data() } as Employee;
}

/**
 * Get active contract for employee
 */
async function getActiveContract(employeeId: string): Promise<Contract | null> {
  const q = query(
    collection(db, CONTRACT_COLLECTION),
    where('employeeId', '==', employeeId),
    where('status', '==', 'active'),
    firestoreLimit(1)
  );

  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Contract;
  }

  // Fallback: derive a minimal contract from the employee record's
  // customFields. PayrollPage's "live" view reads salary directly from
  // there (basicSalary + housing/transport/lunch/other allowances) — so
  // before formal contracts are uploaded, the calculator can run off
  // the same data instead of throwing "No active contract found".
  const empRef = doc(db, EMPLOYEE_COLLECTION, employeeId);
  const empSnap = await getDoc(empRef);
  if (!empSnap.exists()) return null;
  const data = empSnap.data() as Record<string, unknown>;
  const cf = (data.customFields ?? {}) as Record<string, unknown>;
  const baseSalary = Number(cf.basicSalary) || 0;
  if (baseSalary <= 0) return null;

  const allowanceFields: Array<{
    key: string;
    type: 'housing' | 'transport' | 'lunch' | 'other';
    name: string;
  }> = [
    { key: 'housingAllowance', type: 'housing', name: 'Housing Allowance' },
    { key: 'transportAllowance', type: 'transport', name: 'Transport Allowance' },
    { key: 'lunchAllowance', type: 'lunch', name: 'Lunch Allowance' },
    { key: 'otherAllowances', type: 'other', name: 'Other Allowances' },
  ];

  const allowances = allowanceFields
    .map(({ key, type, name }) => ({
      type,
      name,
      amount: Number(cf[key]) || 0,
      frequency: 'monthly' as const,
      taxable: type !== 'lunch', // Conservative default: non-cash perks vary
    }))
    .filter((a) => a.amount > 0);

  // Synthetic contract — only populates the fields the calculator
  // actually reads (compensation.* and id). Cast through unknown
  // because this is a stand-in for the formal record, not a forged
  // signed agreement.
  return {
    id: `synthetic-${employeeId}`,
    employeeId,
    compensation: {
      baseSalary,
      currency: 'UGX',
      paymentFrequency: 'monthly',
      paymentMethod: 'bank_transfer',
      allowances,
      deductions: [],
    },
  } as unknown as Contract;
}

/**
 * Sum of unpaid absence days from the attendance collection for the
 * employee's selected period. Counts:
 *   - status 'absent'                     → 1.0 day
 *   - status 'half_day'                   → 0.5 day
 *   - status 'leave' with leaveType 'unpaid' → 1.0 day
 * Everything else (present / late / paid leave / sick / holiday /
 * weekend) is paid time and contributes 0.
 *
 * Returns 0 on read failure rather than throwing — proration without
 * attendance data is still valid (defaults to a full month).
 */
async function getUnpaidAttendanceDaysForPeriod(
  employeeId: string,
  year: number,
  month: number,
): Promise<number> {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      where('employeeId', '==', employeeId),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
    );
    const snap = await getDocs(q);
    let unpaid = 0;
    for (const d of snap.docs) {
      const r = d.data() as { status?: string; leaveType?: string };
      if (r.status === 'absent') unpaid += 1;
      else if (r.status === 'half_day') unpaid += 0.5;
      else if (r.status === 'leave' && r.leaveType === 'unpaid') unpaid += 1;
    }
    return unpaid;
  } catch {
    return 0;
  }
}

/**
 * Resolve all "other deductions" (food contributions, savings,
 * disciplinary recoveries, etc.) that should apply for the given
 * employee + period. Returns ready-made deduction line items.
 *
 * Schedule semantics:
 *   - one_time     → applies only when effectivePeriod === period
 *   - recurring    → applies when startMonth ≤ period ≤ endMonth
 *                    (open-ended if endMonth missing)
 *   - installments → applies when startMonth ≤ period AND
 *                    balanceRemaining > 0; deduction = min(installmentAmount, balance)
 */
async function getOtherDeductionsForPeriod(
  employeeId: string,
  year: number,
  month: number,
): Promise<Array<{
  description: string;
  amount: number;
  type: string;
  reference?: string;
  scheduleKind: 'one_time' | 'recurring' | 'installments';
  balanceRemaining?: number;
}>> {
  try {
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const q = query(
      collection(db, OTHER_DEDUCTIONS_COLLECTION),
      where('employeeId', '==', employeeId),
      where('status', '==', 'active'),
    );
    const snap = await getDocs(q);
    const out: Array<{ description: string; amount: number; type: string; reference?: string; scheduleKind: 'one_time' | 'recurring' | 'installments'; balanceRemaining?: number }> = [];

    for (const d of snap.docs) {
      const r = d.data() as {
        type: string;
        description: string;
        schedule: 'one_time' | 'recurring' | 'installments';
        effectivePeriod?: string;
        startMonth?: string;
        endMonth?: string;
        installmentAmount?: number;
        balanceRemaining?: number;
      };

      let amount = 0;
      let balanceForLine: number | undefined;

      if (r.schedule === 'one_time') {
        if (r.effectivePeriod === period) {
          amount = Number(r.installmentAmount) || 0;
        }
      } else if (r.schedule === 'recurring') {
        const startOk = !r.startMonth || r.startMonth <= period;
        const endOk = !r.endMonth || period <= r.endMonth;
        if (startOk && endOk) {
          amount = Number(r.installmentAmount) || 0;
        }
      } else if (r.schedule === 'installments') {
        const startOk = !r.startMonth || r.startMonth <= period;
        const balance = Number(r.balanceRemaining || 0);
        if (startOk && balance > 0) {
          amount = Math.min(Number(r.installmentAmount) || 0, balance);
          balanceForLine = balance;
        }
      }

      if (amount > 0) {
        out.push({
          description: r.description,
          amount,
          type: r.type,
          reference: d.id,
          scheduleKind: r.schedule,
          balanceRemaining: balanceForLine,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Sum of monthly recovery installments for active salary advances on
 * this employee that are due for the *given* batch period.
 *
 * Period-aware so back-dated advances (e.g. an advance entered in May
 * for a March disbursement with recoveryStartMonth = "2026-03") are
 * picked up by re-runs of the right month and skipped by months
 * before the recoveryStartMonth.
 *
 * PayrollPage's "live current month" view aggregates these the same
 * way — both code paths now match.
 */
async function getActiveSalaryAdvancesForPeriod(
  employeeId: string,
  year: number,
  month: number,
): Promise<Array<{
  id: string;
  amount: number;
  balanceRemaining: number;
  installmentNumber: number;
  totalInstallments: number;
}>> {
  try {
    const period = `${year}-${String(month).padStart(2, '0')}`; // YYYY-MM
    const q = query(
      collection(db, SALARY_ADVANCES_COLLECTION),
      where('employeeId', '==', employeeId),
      where('status', 'in', ['disbursed', 'partially_recovered']),
    );
    const snap = await getDocs(q);
    const out: Array<{ id: string; amount: number; balanceRemaining: number; installmentNumber: number; totalInstallments: number }> = [];
    for (const d of snap.docs) {
      const a = d.data() as {
        monthlyDeduction?: number;
        balanceRemaining?: number;
        recoveryStartMonth?: string;
        repaymentMonths?: number;
        recoveryHistory?: Array<{ payrollId?: string }>;
      };
      // Skip advances whose recovery hasn't started yet for this batch
      // period. recoveryStartMonth is "YYYY-MM" so string compare works.
      const startMonth = a.recoveryStartMonth || '';
      if (startMonth && startMonth > period) continue;

      const installment = Number(a.monthlyDeduction) || 0;
      // Don't deduct more than what's still owed (last installment may
      // be smaller than the standard monthly amount).
      const balance = Number(a.balanceRemaining) || 0;
      const thisMonth = balance > 0 ? Math.min(installment, balance) : installment;
      if (thisMonth <= 0) continue;

      const totalInstallments = Number(a.repaymentMonths) || 0;
      const installmentNumber = (a.recoveryHistory?.length || 0) + 1;
      out.push({
        id: d.id,
        amount: thisMonth,
        balanceRemaining: balance,
        installmentNumber,
        totalInstallments,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Get existing payroll for employee/period
 */
async function getEmployeePayrollForPeriod(
  employeeId: string,
  year: number,
  month: number
): Promise<EmployeePayroll | null> {
  const q = query(
    collection(db, PAYROLL_COLLECTION),
    where('employeeId', '==', employeeId),
    where('year', '==', year),
    where('month', '==', month),
    firestoreLimit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  // Match getPayroll / getPayrollHistory: coerce Timestamp fields back
  // to Date so callers can hand the record straight to savePayroll's
  // Timestamp.fromDate without crashing. (savePayroll's toDateSafe
  // already absorbs raw Timestamps, but normalising at read time keeps
  // the in-memory shape consistent with the other fetchers.)
  const data = snapshot.docs[0].data();
  return {
    id: snapshot.docs[0].id,
    ...data,
    periodStart: data.periodStart?.toDate?.() || data.periodStart,
    periodEnd: data.periodEnd?.toDate?.() || data.periodEnd,
    paymentDate: data.paymentDate?.toDate?.() || data.paymentDate,
    calculatedAt: data.calculatedAt?.toDate?.() || data.calculatedAt,
    createdAt: data.createdAt?.toDate?.() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
  } as EmployeePayroll;
}

/**
 * Get year-to-date totals
 */
async function getYearToDateTotals(
  employeeId: string,
  year: number,
  month: number
): Promise<YearToDateTotals> {
  const taxYear = getTaxYear(new Date(year, month - 1, 1));
  const { start, end } = getFiscalYearDates(new Date(year, month - 1, 1));
  
  const docId = `${employeeId}_${taxYear}`;
  const docRef = doc(db, YTD_COLLECTION, docId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data() as YearToDateTotals;
  }

  // Return empty YTD
  return {
    taxYear,
    fiscalYearStart: start,
    fiscalYearEnd: end,
    grossEarnings: 0,
    basicSalary: 0,
    allowances: 0,
    overtime: 0,
    bonuses: 0,
    commissions: 0,
    otherEarnings: 0,
    taxableEarnings: 0,
    nssfApplicableEarnings: 0,
    totalDeductions: 0,
    paye: 0,
    nssfEmployee: 0,
    nssfEmployer: 0,
    lst: 0,
    voluntaryDeductions: 0,
    loanRecoveries: 0,
    otherDeductions: 0,
    netPay: 0,
    periodsProcessed: 0,
    lastProcessedPeriod: ''
  };
}

/**
 * Save year-to-date totals
 */
async function saveYearToDateTotals(
  ytd: YearToDateTotals,
  employeeId: string,
  year: number,
  month: number
): Promise<void> {
  const taxYear = getTaxYear(new Date(year, month - 1, 1));
  const docId = `${employeeId}_${taxYear}`;
  const docRef = doc(db, YTD_COLLECTION, docId);
  
  await setDoc(docRef, {
    ...ytd,
    lastProcessedPeriod: getPeriodString(year, month),
    updatedAt: Timestamp.now()
  }, { merge: true });
}

/**
 * Get approved overtime records for period
 */
async function getApprovedOvertimeForPeriod(
  employeeId: string,
  year: number,
  month: number
): Promise<OvertimeRecord[]> {
  // OvertimeTab stores `date` as a YYYY-MM-DD string, so the period
  // bounds are also strings (Firestore compares lexically — works
  // because the format is sortable).
  const mm = String(month).padStart(2, '0');
  const startDate = `${year}-${mm}-01`;
  const endDate = `${year}-${mm}-31`;

  // Explicit orderBy so this query lines up with the declared composite
  // index (employeeId ASC + status ASC + date DESC). Without it Firestore
  // implicitly orders ASCENDING on the inequality field and rejects the
  // query as needing a separate ASC index.
  const q = query(
    collection(db, OVERTIME_COLLECTION),
    where('employeeId', '==', employeeId),
    where('status', '==', 'approved'),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc'),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => {
    const data = d.data() as Record<string, unknown> & { date?: string | { toDate?: () => Date } };
    return {
      id: d.id,
      ...data,
      date: typeof data.date === 'string'
        ? data.date
        : data.date?.toDate?.() || data.date,
    };
  }) as unknown as OvertimeRecord[];
}

/**
 * Get active loan recoveries for employee
 */
async function getActiveLoanRecoveries(employeeId: string): Promise<LoanRecovery[]> {
  const q = query(
    collection(db, LOAN_COLLECTION),
    where('employeeId', '==', employeeId),
    where('status', '==', 'active')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  })) as LoanRecovery[];
}

/**
 * Coerce any date-ish value (real Date, ISO string, ms number,
 * Firestore Timestamp, or de-serialised { seconds, nanoseconds })
 * to a real Date. Falls back to `now` if the value can't be parsed —
 * better to have a stamped row than to crash the whole calculation.
 */
function toDateSafe(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return isNaN(value.getTime()) ? new Date() : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (typeof value === 'object') {
    const v = value as { toDate?: () => Date; seconds?: number };
    if (typeof v.toDate === 'function') {
      try {
        const d = v.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return d;
      } catch { /* fall through */ }
    }
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  }
  return new Date();
}

/**
 * Save payroll record. Coerces every date field through toDateSafe so
 * recalculation (where existingPayroll.createdAt comes back as a raw
 * Firestore Timestamp instead of a real Date) doesn't crash on
 * Timestamp.fromDate's getTime() call.
 */
async function savePayroll(payroll: EmployeePayroll): Promise<void> {
  const docRef = doc(db, PAYROLL_COLLECTION, payroll.id);
  await setDoc(docRef, {
    ...payroll,
    periodStart: Timestamp.fromDate(toDateSafe(payroll.periodStart)),
    periodEnd: Timestamp.fromDate(toDateSafe(payroll.periodEnd)),
    paymentDate: Timestamp.fromDate(toDateSafe(payroll.paymentDate)),
    calculatedAt: Timestamp.fromDate(toDateSafe(payroll.calculatedAt)),
    createdAt: Timestamp.fromDate(toDateSafe(payroll.createdAt)),
    updatedAt: Timestamp.now()
  });
}

// ============================================================================
// Public Query Functions
// ============================================================================

/**
 * Get payroll by ID
 */
export async function getPayroll(payrollId: string): Promise<EmployeePayroll | null> {
  const docRef = doc(db, PAYROLL_COLLECTION, payrollId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    periodStart: data.periodStart?.toDate?.() || data.periodStart,
    periodEnd: data.periodEnd?.toDate?.() || data.periodEnd,
    paymentDate: data.paymentDate?.toDate?.() || data.paymentDate,
    calculatedAt: data.calculatedAt?.toDate?.() || data.calculatedAt,
    createdAt: data.createdAt?.toDate?.() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
  } as EmployeePayroll;
}

/**
 * Get payroll history for employee
 */
export async function getPayrollHistory(
  employeeId: string,
  options?: {
    year?: number;
    limitCount?: number;
  }
): Promise<EmployeePayroll[]> {
  let q;
  
  if (options?.year) {
    q = query(
      collection(db, PAYROLL_COLLECTION),
      where('employeeId', '==', employeeId),
      where('year', '==', options.year),
      orderBy('month', 'desc')
    );
  } else {
    q = query(
      collection(db, PAYROLL_COLLECTION),
      where('employeeId', '==', employeeId),
      orderBy('year', 'desc'),
      orderBy('month', 'desc'),
      firestoreLimit(options?.limitCount || 24)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      periodStart: data.periodStart?.toDate?.() || data.periodStart,
      periodEnd: data.periodEnd?.toDate?.() || data.periodEnd,
      paymentDate: data.paymentDate?.toDate?.() || data.paymentDate,
      calculatedAt: data.calculatedAt?.toDate?.() || data.calculatedAt,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
    };
  }) as EmployeePayroll[];
}

/**
 * Get payroll records for a period
 */
export async function getPayrollsForPeriod(
  subsidiaryId: string,
  year: number,
  month: number
): Promise<EmployeePayrollSummary[]> {
  const q = query(
    collection(db, PAYROLL_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    where('year', '==', year),
    where('month', '==', month),
    orderBy('employeeName', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      employeeId: data.employeeId,
      employeeNumber: data.employeeNumber,
      employeeName: data.employeeName,
      departmentName: data.departmentName,
      position: data.position,
      grossPay: data.grossPay,
      totalDeductions: data.totalDeductions,
      netPay: data.netPay,
      status: data.status,
      paymentMethod: data.paymentMethod
    };
  }) as EmployeePayrollSummary[];
}

/**
 * Get payroll summary for a period
 */
export async function getPayrollSummary(
  subsidiaryId: string,
  year: number,
  month: number
): Promise<PayrollSummary> {
  const payrolls = await getPayrollsForPeriod(subsidiaryId, year, month);
  
  // Initialize department breakdown map
  const departmentMap = new Map<string, PayrollSummary['departmentBreakdown'][0]>();
  const paymentMethodMap = new Map<string, { count: number; amount: number }>();
  const bankMap = new Map<string, { count: number; amount: number }>();
  
  // Initialize totals
  const totals = {
    employeeCount: 0,
    totalGross: 0,
    totalTaxableIncome: 0,
    totalPAYE: 0,
    totalNSSFEmployee: 0,
    totalNSSFEmployer: 0,
    totalLST: 0,
    totalVoluntaryDeductions: 0,
    totalNet: 0
  };

  // Process each payroll
  for (const payroll of payrolls) {
    const fullPayroll = await getPayroll(payroll.id);
    if (!fullPayroll) continue;

    // Update totals
    totals.employeeCount++;
    totals.totalGross += fullPayroll.grossPay;
    totals.totalTaxableIncome += fullPayroll.taxableIncome;
    totals.totalPAYE += fullPayroll.payeBreakdown.netPAYE;
    totals.totalNSSFEmployee += fullPayroll.nssfBreakdown.employeeContribution;
    totals.totalNSSFEmployer += fullPayroll.nssfBreakdown.employerContribution;
    totals.totalLST += fullPayroll.lstBreakdown.monthlyLST;
    totals.totalVoluntaryDeductions += fullPayroll.totalVoluntaryDeductions;
    totals.totalNet += fullPayroll.netPay;

    // Update department breakdown
    const deptKey = fullPayroll.departmentId;
    if (!departmentMap.has(deptKey)) {
      departmentMap.set(deptKey, {
        departmentId: fullPayroll.departmentId,
        departmentName: fullPayroll.departmentName,
        employeeCount: 0,
        totalGross: 0,
        totalNet: 0,
        totalPAYE: 0,
        totalNSSF: 0,
        totalLST: 0
      });
    }
    const dept = departmentMap.get(deptKey)!;
    dept.employeeCount++;
    dept.totalGross += fullPayroll.grossPay;
    dept.totalNet += fullPayroll.netPay;
    dept.totalPAYE += fullPayroll.payeBreakdown.netPAYE;
    dept.totalNSSF += fullPayroll.nssfBreakdown.employeeContribution;
    dept.totalLST += fullPayroll.lstBreakdown.monthlyLST;

    // Update payment method breakdown
    const methodKey = fullPayroll.paymentMethod;
    if (!paymentMethodMap.has(methodKey)) {
      paymentMethodMap.set(methodKey, { count: 0, amount: 0 });
    }
    const method = paymentMethodMap.get(methodKey)!;
    method.count++;
    method.amount += fullPayroll.netPay;

    // Update bank breakdown
    if (fullPayroll.bankDetails?.bankName) {
      const bankKey = fullPayroll.bankDetails.bankName;
      if (!bankMap.has(bankKey)) {
        bankMap.set(bankKey, { count: 0, amount: 0 });
      }
      const bank = bankMap.get(bankKey)!;
      bank.count++;
      bank.amount += fullPayroll.netPay;
    }
  }

  return {
    period: getPeriodString(year, month),
    subsidiaryId,
    departmentBreakdown: Array.from(departmentMap.values()),
    totals,
    paymentMethodBreakdown: Array.from(paymentMethodMap.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      amount: data.amount
    })),
    bankBreakdown: Array.from(bankMap.entries()).map(([bankName, data]) => ({
      bankName,
      count: data.count,
      amount: data.amount
    }))
  };
}

/**
 * Approve payroll record
 */
export async function approvePayroll(
  payrollId: string,
  approvedBy: string,
  notes?: string
): Promise<EmployeePayroll> {
  const payroll = await getPayroll(payrollId);
  if (!payroll) throw new Error('Payroll not found');
  
  if (payroll.status !== 'calculated' && payroll.status !== 'reviewed') {
    throw new Error(`Cannot approve payroll in status: ${payroll.status}`);
  }

  const docRef = doc(db, PAYROLL_COLLECTION, payrollId);
  await updateDoc(docRef, {
    status: 'approved',
    approvedBy,
    approvedAt: Timestamp.now(),
    notes: notes || payroll.notes,
    updatedAt: Timestamp.now(),
    version: payroll.version + 1
  });

  return { ...payroll, status: 'approved', approvedBy, approvedAt: new Date() };
}

/**
 * Mark payroll as paid and apply all amortising recoveries (loans,
 * salary advances, installment-schedule other-deductions). Each
 * recovery handler is idempotent on payrollId so re-marking a
 * regenerated payroll paid won't double-decrement balances.
 */
export async function markPayrollPaid(
  payrollId: string,
  _paidBy: string
): Promise<EmployeePayroll> {
  const payroll = await getPayroll(payrollId);
  if (!payroll) throw new Error('Payroll not found');

  if (payroll.status !== 'approved') {
    throw new Error(`Cannot mark as paid - payroll must be approved first`);
  }

  const docRef = doc(db, PAYROLL_COLLECTION, payrollId);
  await updateDoc(docRef, {
    status: 'paid',
    updatedAt: Timestamp.now(),
    version: payroll.version + 1
  });

  await applyRecoveriesForPayroll(payroll);

  return { ...payroll, status: 'paid' };
}

/**
 * Apply amortising recoveries for a payroll. Exported so the batch
 * payment path can fire the same recoveries when it flips multiple
 * payrolls to paid at once.
 */
export async function applyRecoveriesForPayroll(payroll: EmployeePayroll): Promise<void> {
  const period = `${payroll.year}-${String(payroll.month).padStart(2, '0')}`;
  for (const deduction of payroll.deductions) {
    const meta = deduction.metadata;
    if (deduction.type === 'loan' && meta?.loanId) {
      await updateLoanRecoveryAfterPayment(meta.loanId, deduction.amount, period, payroll.id);
    } else if (deduction.type === 'advance' && meta?.advanceId) {
      await advanceService.recordRecovery(meta.advanceId, deduction.amount, period, payroll.id);
    } else if (deduction.type === 'other' && meta?.scheduleKind === 'installments' && meta?.deductionId) {
      await otherDeductionsService.recordRecovery(meta.deductionId, deduction.amount, period, payroll.id);
    }
  }
}

/**
 * Reverse amortising recoveries for a payroll — symmetric to
 * applyRecoveriesForPayroll. Used by the batch reversal path so a
 * paid batch that gets reversed restores every affected loan / advance
 * / installment balance. Each reversal handler is idempotent on
 * payrollId (it only acts if the matching history entry is present),
 * so partial-retry is safe.
 */
export async function reverseRecoveriesForPayroll(payroll: EmployeePayroll): Promise<void> {
  for (const deduction of payroll.deductions) {
    const meta = deduction.metadata;
    if (deduction.type === 'loan' && meta?.loanId) {
      await reverseLoanRecovery(meta.loanId, payroll.id);
    } else if (deduction.type === 'advance' && meta?.advanceId) {
      await advanceService.reverseRecovery(meta.advanceId, payroll.id);
    } else if (deduction.type === 'other' && meta?.scheduleKind === 'installments' && meta?.deductionId) {
      await otherDeductionsService.reverseRecovery(meta.deductionId, payroll.id);
    }
  }
}

/**
 * Update loan recovery after payment. Idempotent on payrollId — re-marking
 * the same payroll paid (e.g. after regenerate) is a no-op.
 */
async function updateLoanRecoveryAfterPayment(
  loanId: string,
  amountPaid: number,
  period: string,
  payrollId: string,
): Promise<void> {
  const docRef = doc(db, LOAN_COLLECTION, loanId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return;

  const loan = docSnap.data() as LoanRecovery;
  const history = loan.recoveryHistory || [];

  if (history.some(h => h.payrollId === payrollId)) {
    return;
  }

  const newPaidInstallments = loan.paidInstallments + 1;
  const newBalance = Math.max(0, loan.balanceRemaining - amountPaid);
  const newStatus = newBalance <= 0 ? 'completed' : 'active';

  await updateDoc(docRef, {
    paidInstallments: newPaidInstallments,
    balanceRemaining: newBalance,
    status: newStatus,
    recoveryHistory: [...history, {
      month: period,
      amount: amountPaid,
      payrollId,
      date: Timestamp.now(),
    }],
    updatedAt: Timestamp.now()
  });
}

/**
 * Reverse a previously-applied loan recovery. Symmetric to
 * updateLoanRecoveryAfterPayment: finds the recoveryHistory entry by
 * payrollId, removes it, adds the amount back to balanceRemaining,
 * decrements paidInstallments, and flips status back to 'active' if
 * the loan had been auto-completed by the final installment.
 * Idempotent — no-op if the matching entry isn't present.
 */
async function reverseLoanRecovery(loanId: string, payrollId: string): Promise<void> {
  const docRef = doc(db, LOAN_COLLECTION, loanId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return;

  const loan = docSnap.data() as LoanRecovery;
  const history = loan.recoveryHistory || [];
  const entry = history.find(h => h.payrollId === payrollId);
  if (!entry) return;

  const remainingHistory = history.filter(h => h.payrollId !== payrollId);
  const newPaidInstallments = Math.max(0, loan.paidInstallments - 1);
  const newBalance = Math.min(loan.totalAmount, loan.balanceRemaining + entry.amount);

  await updateDoc(docRef, {
    paidInstallments: newPaidInstallments,
    balanceRemaining: newBalance,
    status: loan.status === 'completed' && newBalance > 0 ? 'active' : loan.status,
    recoveryHistory: remainingHistory,
    updatedAt: Timestamp.now(),
  });
}
