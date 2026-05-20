/**
 * BUDGET PERIOD TYPES
 *
 * Calendar-year budget periods with manual carry-forward.
 * Each program has one active budget period per calendar year.
 * Unspent funds require explicit approval to carry forward.
 */

import { Timestamp } from 'firebase/firestore';
import type { Money } from '../../core/types/money';
import type { CategoryBudget } from './program-budget';

// ─────────────────────────────────────────────────────────────────
// BUDGET PERIOD
// ─────────────────────────────────────────────────────────────────

export type BudgetPeriodStatus = 'planning' | 'active' | 'closing' | 'closed';

export const BUDGET_PERIOD_STATUS_CONFIG: Record<BudgetPeriodStatus, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  planning: { label: 'Planning', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  active: { label: 'Active', color: 'text-green-600', bgColor: 'bg-green-100' },
  closing: { label: 'Closing', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  closed: { label: 'Closed', color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

/**
 * Firestore document in `advisory_programs/{programId}/budget_periods`.
 */
export interface BudgetPeriod {
  id: string;
  programId: string;
  year: number;                     // Calendar year, e.g. 2025
  label: string;                    // e.g. "CY 2025"
  status: BudgetPeriodStatus;
  startDate: Date;                  // Jan 1 of year
  endDate: Date;                    // Dec 31 of year

  // Budget allocation for this period (in program currency = USD)
  allocatedBudget: Money;
  // Carry-forward received from previous year
  carryForwardReceived: Money;
  // Total available = allocated + carry-forward
  totalAvailable: Money;

  // Aggregated from projects (computed via recalculation)
  committed: Money;
  spent: Money;
  remaining: Money;

  // Per-category breakdown (optional — populated on recalculation)
  byCategory?: CategoryBudget[];

  // Carry-forward to next year
  carryForwardAmount?: Money;
  carryForwardStatus?: CarryForwardStatus;

  // Metadata
  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// CARRY-FORWARD REQUEST
// ─────────────────────────────────────────────────────────────────

export type CarryForwardStatus = 'pending' | 'approved' | 'rejected';

export const CARRY_FORWARD_STATUS_CONFIG: Record<CarryForwardStatus, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  pending: { label: 'Pending Review', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  approved: { label: 'Approved', color: 'text-green-600', bgColor: 'bg-green-100' },
  rejected: { label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-100' },
};

/**
 * Firestore document in `advisory_programs/{programId}/carry_forward_requests`.
 * Created when a PM/Finance Officer requests to carry forward unspent funds.
 */
export interface CarryForwardRequest {
  id: string;
  programId: string;
  fromPeriodId: string;
  fromYear: number;
  toPeriodId?: string;              // Set when approved (links to the receiving period)
  toYear: number;
  amount: Money;
  justification: string;

  // Breakdown of which projects' unspent funds are being carried forward
  projectBreakdown: CarryForwardProjectItem[];

  status: CarryForwardStatus;
  requestedBy: string;
  requestedAt: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  reviewNotes?: string;
  createdAt: Timestamp;
}

export interface CarryForwardProjectItem {
  projectId: string;
  projectName: string;
  projectCode: string;
  unspentAmount: Money;
  requestedCarryForward: Money;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

export function getBudgetPeriodStatusColor(status: BudgetPeriodStatus): string {
  return `${BUDGET_PERIOD_STATUS_CONFIG[status].color} ${BUDGET_PERIOD_STATUS_CONFIG[status].bgColor}`;
}

export function getCarryForwardStatusColor(status: CarryForwardStatus): string {
  return `${CARRY_FORWARD_STATUS_CONFIG[status].color} ${CARRY_FORWARD_STATUS_CONFIG[status].bgColor}`;
}

export function isCurrentPeriod(period: BudgetPeriod): boolean {
  const now = new Date();
  return now.getFullYear() === period.year && period.status === 'active';
}

export function calculatePeriodUtilization(period: BudgetPeriod): number {
  const available = period.totalAvailable.amount;
  if (available <= 0) return 0;
  return ((period.committed.amount + period.spent.amount) / available) * 100;
}

/**
 * Create a budget period label from year
 */
export function formatPeriodLabel(year: number): string {
  return `CY ${year}`;
}

/**
 * Initialize a new budget period for a calendar year
 */
export function initializeBudgetPeriod(
  programId: string,
  year: number,
  allocatedBudget: Money,
  carryForward: Money = { amount: 0, currency: allocatedBudget.currency }
): Omit<BudgetPeriod, 'id' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'> {
  const currency = allocatedBudget.currency;
  const totalAvailable = {
    amount: allocatedBudget.amount + carryForward.amount,
    currency,
  };

  return {
    programId,
    year,
    label: formatPeriodLabel(year),
    status: 'planning',
    startDate: new Date(year, 0, 1),
    endDate: new Date(year, 11, 31),
    allocatedBudget,
    carryForwardReceived: carryForward,
    totalAvailable,
    committed: { amount: 0, currency },
    spent: { amount: 0, currency },
    remaining: totalAvailable,
  };
}
