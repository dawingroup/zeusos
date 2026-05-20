/**
 * Labor Rate Calculator
 *
 * Calculates a blended labor cost per hour from actual payroll data:
 *   blendedCostPerHour = weightedMonthlyCost / plannedMonthlyHours
 *
 * - Production department staff are weighted at 100%
 * - Partial contributors from other departments are weighted by their allocation %
 * - Planned hours = headcount × hoursPerDay × workingDaysPerMonth
 */

import { employeeService } from '@/modules/hr-central/services/employee.service';
import { getActiveContractForEmployee } from '@/modules/hr-central/services/contract.service';
import { getPayrollHistory } from '@/modules/hr-central/payroll/services/payroll-calculator.service';
import { calculateNSSF } from '@/modules/hr-central/payroll/utils/tax-calculator';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import {
  resolvePricingAssumptions,
  type PricingAssumptions,
} from '@/shared/types/pricingAssumptions';

/** Default productive utilization (% of paid hours that are billable / on-task). */
const DEFAULT_PRODUCTIVE_HOURS_PERCENT = 85;

/**
 * Add the employer-side NSSF contribution to a gross figure so every
 * compensation source returns a fully-loaded monthly cost. Uses the
 * same NSSF calculator the payroll engine uses, so if the rate or cap
 * changes there it stays in sync here.
 */
function applyEmployerNSSF(grossMonthly: number): number {
  if (grossMonthly <= 0) return 0;
  const breakdown = calculateNSSF(grossMonthly);
  return grossMonthly + (breakdown.employerContribution || 0);
}

// ============================================
// Types
// ============================================

export interface LaborRateStaffEntry {
  employeeId: string;
  name: string;
  department: string;
  monthlyPayCost: number;
  paySource: 'payroll' | 'contract' | 'employee_record';
  costBucket: 'direct' | 'overhead';
  allocation: number;            // 1.0 for full-time production, 0.XX for partial
  weightedCost: number;          // monthlyPayCost × allocation
}

export interface LaborRateCalculation {
  staff: LaborRateStaffEntry[];
  directWeightedMonthlyCost: number;
  overheadWeightedMonthlyCost: number;
  totalWeightedMonthlyCost: number;
  directRatePerHour: number;
  overheadRatePerHour: number;
  totalPlannedMonthlyHours: number;
  calculatedRatePerHour: number;
  headcount: {
    fullTime: number;
    partial: number;
  };
  /** Set when the configured production department matched no employees
   *  and the calculator fell back to averaging across all active staff.
   *  The UI surfaces this so users know the rate isn't a true production
   *  cost. */
  usedOrgWideFallback?: boolean;
  /** Productive % actually applied to the denominator. Surfaced so the
   *  UI can show "X paid hours → Y productive hours". */
  productiveHoursPercent?: number;
}

interface ResolveLaborRateOptions {
  assumptions?: Partial<PricingAssumptions> | null;
  fallbackRate?: number;
}

export type LaborRateSource =
  | 'manual_override'
  | 'live_payroll'
  | 'cached_calculated'
  | 'default_fallback';

export interface EffectiveLaborRateResult {
  rate: number;
  source: LaborRateSource;
}

interface ActiveEmployeeLite {
  id: string;
  fullName: string;
  departmentId: string;
  departmentName?: string;
}

// ============================================
// Calculator
// ============================================

/**
 * Calculate the blended labor rate per hour from employee payroll data.
 *
 * @param config - The labor config from PricingAssumptions
 * @returns Calculation result with per-employee breakdown and final rate
 */
export async function calculateLaborRate(
  config: PricingAssumptions['labor']
): Promise<LaborRateCalculation> {
  const staff: LaborRateStaffEntry[] = [];
  let fullTimeCount = 0;
  let partialCount = 0;
  const contributorMatchedCounts: number[] = [];
  let activeEmployeesPromise: Promise<ActiveEmployeeLite[]> | null = null;

  const getActiveEmployees = (): Promise<ActiveEmployeeLite[]> => {
    if (!activeEmployeesPromise) {
      activeEmployeesPromise = listAllActiveEmployees();
    }
    return activeEmployeesPromise;
  };

  // 1. Fetch production department employees (100% allocation)
  if (config.productionDepartmentId) {
    const prodEmployees = await resolveEmployeesForDepartment(
      config.productionDepartmentId,
      getActiveEmployees
    );

    for (const emp of prodEmployees) {
      const compensation = await getEmployeeMonthlyCompensation(emp.id);
      if (compensation.amount > 0) {
        staff.push({
          employeeId: emp.id,
          name: emp.fullName,
          department: emp.departmentName || 'Production',
          monthlyPayCost: compensation.amount,
          paySource: compensation.source,
          costBucket: 'direct',
          allocation: 1.0,
          weightedCost: compensation.amount,
        });
        fullTimeCount++;
      }
    }
  }

  // 2. Fetch partial contributor departments
  for (const [index, contributor] of config.partialContributors.entries()) {
    if (!contributor.departmentId || contributor.allocationPercent <= 0) continue;

    const deptEmployees = await resolveEmployeesForDepartment(
      contributor.departmentId,
      getActiveEmployees
    );
    const allocationFraction = contributor.allocationPercent / 100;
    const costBucket = contributor.costBucket === 'direct' ? 'direct' : 'overhead';
    let matchedWithPayData = 0;

    for (const emp of deptEmployees) {
      const compensation = await getEmployeeMonthlyCompensation(emp.id);
      if (compensation.amount > 0) {
        staff.push({
          employeeId: emp.id,
          name: emp.fullName,
          department: contributor.departmentName || emp.departmentName || 'Unknown',
          monthlyPayCost: compensation.amount,
          paySource: compensation.source,
          costBucket,
          allocation: allocationFraction,
          weightedCost: Math.round(compensation.amount * allocationFraction),
        });
        partialCount++;
        matchedWithPayData++;
      }
    }

    contributorMatchedCounts[index] = matchedWithPayData;
  }

  // 3. Calculate totals
  const directWeightedMonthlyCost = staff
    .filter(s => s.costBucket === 'direct')
    .reduce((sum, s) => sum + s.weightedCost, 0);
  const overheadWeightedMonthlyCost = staff
    .filter(s => s.costBucket === 'overhead')
    .reduce((sum, s) => sum + s.weightedCost, 0);
  const totalWeightedMonthlyCost = directWeightedMonthlyCost + overheadWeightedMonthlyCost;

  const hoursPerDay = config.hoursPerDay || 8;
  const workingDaysPerMonth = config.workingDaysPerMonth || 22;
  const productivePct = (config.productiveHoursPercent ?? DEFAULT_PRODUCTIVE_HOURS_PERCENT) / 100;
  // Productive hours net of leave, public holidays, sick, idle. Using
  // paid hours as the denominator under-recovers cost on every job.
  const hoursPerMonth = hoursPerDay * workingDaysPerMonth * productivePct;

  // Planned direct hours = production full-time + direct partial contributors.
  // Overhead is burdened onto direct production hours.
  const directPlannedMonthlyHours =
    (fullTimeCount * hoursPerMonth) +
    config.partialContributors.reduce((sum, c, idx) => {
      if (c.costBucket !== 'direct') return sum;
      const employeeCount = contributorMatchedCounts[idx] || 0;
      return sum + (employeeCount * hoursPerMonth * (c.allocationPercent / 100));
    }, 0);

  const overheadPlannedMonthlyHours = config.partialContributors.reduce((sum, c, idx) => {
    if (c.costBucket === 'direct') return sum;
    const employeeCount = contributorMatchedCounts[idx] || 0;
    return sum + (employeeCount * hoursPerMonth * (c.allocationPercent / 100));
  }, 0);

  const denominatorHours = directPlannedMonthlyHours > 0
    ? directPlannedMonthlyHours
    : directPlannedMonthlyHours + overheadPlannedMonthlyHours;

  const directRatePerHour = denominatorHours > 0
    ? Math.round(directWeightedMonthlyCost / denominatorHours)
    : 0;
  const overheadRatePerHour = denominatorHours > 0
    ? Math.round(overheadWeightedMonthlyCost / denominatorHours)
    : 0;
  const calculatedRatePerHour = denominatorHours > 0
    ? Math.round(totalWeightedMonthlyCost / denominatorHours)
    : 0;

  if (staff.length === 0 || calculatedRatePerHour <= 0) {
    // eslint-disable-next-line no-console
    console.info('[laborRate] No staff matched configured departments — falling back to org-wide path.', {
      productionDepartmentId: config.productionDepartmentId,
      partialContributors: config.partialContributors?.length ?? 0,
      fullTimeCount,
      partialCount,
    });
    return calculateOrganizationWideLaborCalculation(config);
  }

  return {
    staff,
    directWeightedMonthlyCost,
    overheadWeightedMonthlyCost,
    totalWeightedMonthlyCost,
    directRatePerHour,
    overheadRatePerHour,
    totalPlannedMonthlyHours: Math.round(denominatorHours * 10) / 10,
    calculatedRatePerHour,
    headcount: {
      fullTime: fullTimeCount,
      partial: partialCount,
    },
    productiveHoursPercent: productivePct * 100,
  };
}

/**
 * Resolve the effective labor rate for costing.
 * Priority:
 * 1) Manual override
 * 2) Live payroll-driven recalculation
 * 3) Last cached calculated rate
 * 4) Fallback rate
 */
export async function resolveEffectiveLaborRate(
  options: ResolveLaborRateOptions = {}
): Promise<number> {
  const result = await resolveEffectiveLaborRateWithSource(options);
  return result.rate;
}

export async function resolveEffectiveLaborRateWithSource(
  options: ResolveLaborRateOptions = {}
): Promise<EffectiveLaborRateResult> {
  const fallbackRate = options.fallbackRate ?? 0;
  const assumptions = resolvePricingAssumptions(options.assumptions);
  const labor = assumptions.labor;

  if (labor.manualOverride != null && labor.manualOverride > 0) {
    return { rate: labor.manualOverride, source: 'manual_override' };
  }

  try {
    const recalculated = await calculateLaborRate(labor);
    if (recalculated.staff.length > 0 && recalculated.calculatedRatePerHour > 0) {
      return { rate: recalculated.calculatedRatePerHour, source: 'live_payroll' };
    }
  } catch {
    // fall back to cached/default rate
  }

  if (labor.calculatedRate && labor.calculatedRate > 0) {
    return { rate: labor.calculatedRate, source: 'cached_calculated' };
  }
  return { rate: fallbackRate, source: 'default_fallback' };
}

// ============================================
// Helpers
// ============================================

/**
 * Resolve an employee's latest monthly compensation. Three sources, in
 * priority order:
 *   1. Latest payroll record  — reflects what was actually paid.
 *   2. Active contract        — formal agreed pay.
 *   3. Employee customFields  — basicSalary + allowances stored on the
 *      employee record itself. This is where PayrollPage reads salary
 *      from today, so it's the source of truth before any payroll has
 *      been run or contracts have been uploaded.
 *
 * Without source #3 the calculator returned zero compensation for any
 * org that hadn't run payroll yet, blocking pricing setup.
 */
async function getEmployeeMonthlyCompensation(
  employeeId: string
): Promise<{ amount: number; source: 'payroll' | 'contract' | 'employee_record' }> {
  // Each source gets its own try/catch so a transient failure in one
  // (e.g. a missing index on the payroll history query) doesn't stop
  // us from falling through to the next source. A single outer try
  // would silently zero out compensation any time *any* read failed.

  try {
    const payrollHistory = await getPayrollHistory(employeeId, { limitCount: 1 });
    const latestPayroll = payrollHistory[0];
    if (latestPayroll) {
      const payrollCost = (latestPayroll.grossPay || 0) + (latestPayroll.nssfBreakdown?.employerContribution || 0);
      if (payrollCost > 0) {
        return { amount: payrollCost, source: 'payroll' };
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[laborRate] payroll history read failed for', employeeId, err);
  }

  try {
    const contract = await getActiveContractForEmployee(employeeId);
    if (contract?.compensation?.baseSalary) {
      // Add employer NSSF so the cost is fully loaded — matches the
      // payroll path which already includes employerContribution.
      return {
        amount: applyEmployerNSSF(contract.compensation.baseSalary),
        source: 'contract',
      };
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[laborRate] contract read failed for', employeeId, err);
  }

  // Final fallback: salary fields stashed on the employee record itself
  // (matches the shape PayrollPage uses for live payroll calculation).
  try {
    const employeeSnap = await getDoc(doc(db, 'employees', employeeId));
    if (employeeSnap.exists()) {
      const data = employeeSnap.data() as Record<string, unknown>;
      const cf = (data.customFields ?? {}) as Record<string, unknown>;
      const gross =
        (Number(cf.basicSalary) || 0) +
        (Number(cf.housingAllowance) || 0) +
        (Number(cf.transportAllowance) || 0) +
        (Number(cf.lunchAllowance) || 0) +
        (Number(cf.otherAllowances) || 0);
      if (gross > 0) {
        // Burden with employer NSSF for parity with the payroll path.
        return { amount: applyEmployerNSSF(gross), source: 'employee_record' };
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[laborRate] employee record read failed for', employeeId, err);
  }

  return { amount: 0, source: 'contract' };
}

function normalizeDepartmentKey(value?: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function listAllActiveEmployees(): Promise<ActiveEmployeeLite[]> {
  const employeesRef = collection(db, 'employees');
  const q = query(
    employeesRef,
    where('isDeleted', '==', false),
    where('employmentStatus', 'in', ['active', 'probation', 'on_leave'])
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnapshot) => {
    const data = docSnapshot.data() as any;
    const departmentId = String(data?.position?.departmentId || '');
    return {
      id: String(data?.id || docSnapshot.id),
      fullName: `${data?.firstName || ''} ${data?.lastName || ''}`.trim() || 'Unknown Employee',
      departmentId,
      departmentName: formatDepartmentLabel(departmentId),
    };
  });
}

async function resolveEmployeesForDepartment(
  departmentId: string,
  getActiveEmployees: () => Promise<ActiveEmployeeLite[]>
) {
  const exactMatches = await employeeService.getEmployeesByDepartment(departmentId);
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  const normalizedTarget = normalizeDepartmentKey(departmentId);
  if (!normalizedTarget) {
    return exactMatches;
  }

  const activeEmployees = await getActiveEmployees();
  const matchingIds = new Set(
    activeEmployees
      .filter((emp) =>
        normalizeDepartmentKey(emp.departmentId) === normalizedTarget ||
        normalizeDepartmentKey(emp.departmentName) === normalizedTarget
      )
      .map((emp) => emp.id)
  );

  if (!matchingIds.size) {
    return exactMatches;
  }

  return activeEmployees
    .filter((emp) => matchingIds.has(emp.id))
    .map((emp) => ({
      id: emp.id,
      fullName: emp.fullName,
      departmentName: emp.departmentName,
    }));
}

async function calculateOrganizationWideLaborCalculation(
  laborConfig: PricingAssumptions['labor']
): Promise<LaborRateCalculation> {
  const activeEmployees = await listAllActiveEmployees();
  const staff: LaborRateStaffEntry[] = [];
  const diagnostics: Array<{ id: string; name: string; amount: number; source: string }> = [];

  for (const employee of activeEmployees) {
    const compensation = await getEmployeeMonthlyCompensation(employee.id);
    diagnostics.push({ id: employee.id, name: employee.fullName, amount: compensation.amount, source: compensation.source });
    if (compensation.amount > 0) {
      staff.push({
        employeeId: employee.id,
        name: employee.fullName,
        department: employee.departmentName || 'Organization',
        monthlyPayCost: compensation.amount,
        paySource: compensation.source,
        costBucket: 'direct',
        allocation: 1,
        weightedCost: compensation.amount,
      });
    }
  }

  // eslint-disable-next-line no-console
  console.info('[laborRate] Org-wide pass:', {
    activeEmployees: activeEmployees.length,
    staffWithComp: staff.length,
    sampleDiagnostics: diagnostics.slice(0, 10),
  });

  const directWeightedMonthlyCost = staff.reduce((sum, entry) => sum + entry.weightedCost, 0);
  const overheadWeightedMonthlyCost = 0;
  const totalWeightedMonthlyCost = directWeightedMonthlyCost;

  const hoursPerDay = laborConfig.hoursPerDay || 8;
  const workingDaysPerMonth = laborConfig.workingDaysPerMonth || 22;
  const productivePct = (laborConfig.productiveHoursPercent ?? DEFAULT_PRODUCTIVE_HOURS_PERCENT) / 100;
  const totalPlannedMonthlyHours = staff.length * hoursPerDay * workingDaysPerMonth * productivePct;

  const calculatedRatePerHour = totalPlannedMonthlyHours > 0
    ? Math.round(totalWeightedMonthlyCost / totalPlannedMonthlyHours)
    : 0;

  return {
    staff,
    directWeightedMonthlyCost,
    overheadWeightedMonthlyCost,
    totalWeightedMonthlyCost,
    directRatePerHour: calculatedRatePerHour,
    overheadRatePerHour: 0,
    totalPlannedMonthlyHours: Math.round(totalPlannedMonthlyHours * 10) / 10,
    calculatedRatePerHour,
    headcount: {
      fullTime: staff.length,
      partial: 0,
    },
    usedOrgWideFallback: true,
    productiveHoursPercent: productivePct * 100,
  };
}

function formatDepartmentLabel(departmentId: string): string {
  return departmentId
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
