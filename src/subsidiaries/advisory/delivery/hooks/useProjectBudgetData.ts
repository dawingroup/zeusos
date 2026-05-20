/**
 * USE PROJECT BUDGET DATA
 *
 * Composite hook that stitches together existing data hooks to provide
 * a unified budget view for the ProjectBudgetPage. No new Firestore
 * queries — all derived data computed via useMemo.
 */

import { useMemo, useCallback } from 'react';
import { Firestore } from 'firebase/firestore';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';
import type { ProjectBudget } from '../types/project-budget';
import type { ControlBOQItem, VarianceBudgetStatus } from '../types/control-boq';
import { calculateTotalBudgetSummary } from '../types/control-boq';
import {
  calculateBudgetSummary,
  formatBudgetAmount,
  type BudgetSummary,
} from '../types/project-budget';
import { useProjectPayments, useProjectRequisitions } from './payment-hooks';
import { useProjectBOQItems } from './boq-hooks';
import { useBudgetUpdate } from './project-hooks';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface SpendingTimelineEntry {
  date: Date;
  label: string;
  amount: number;
  cumulativeSpent: number;
  cumulativeCommitted: number;
  type: 'ipc' | 'requisition' | 'accountability';
  referenceId: string;
}

export interface BudgetLineRow {
  id: string;
  description: string;
  billName: string;
  allocatedAmount: number;
  committedAmount: number;
  spentAmount: number;
  remainingBudget: number;
  varianceStatus: VarianceBudgetStatus;
  variancePercentage: number;
}

export interface VarianceAlert {
  itemId: string;
  description: string;
  severity: 'warning' | 'critical';
  message: string;
  amount: number;
}

export interface CategoryBreakdownItem {
  category: string;
  label: string;
  allocated: number;
  committed: number;
  spent: number;
  percentUsed: number;
  color: string;
}

export interface ProjectBudgetData {
  budget: ProjectBudget;
  summary: BudgetSummary;
  categoryBreakdown: CategoryBreakdownItem[];
  requisitionSummary: {
    totalRequisitioned: number;
    totalPaid: number;
    totalPending: number;
    totalAccountedFor: number;
    count: number;
  };
  spendingTimeline: SpendingTimelineEntry[];
  budgetLines: BudgetLineRow[];
  budgetLineSummary: ReturnType<typeof calculateTotalBudgetSummary>;
  alerts: VarianceAlert[];
  donutSegments: Array<{ label: string; value: number; color: string }>;
  loading: boolean;
  error: Error | null;
  updateBudget: (updates: Partial<ProjectBudget>) => Promise<void>;
  budgetUpdateLoading: boolean;
  refresh: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

const BILL_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6',
  '#F97316', '#06B6D4',
];

// ─────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────

export function useProjectBudgetData(
  db: Firestore,
  project: Project,
  userId: string
): ProjectBudgetData {
  const projectId = project.id;

  // Existing hooks
  const {
    payments,
    loading: paymentsLoading,
    error: paymentsError,
    refresh: refreshPayments,
  } = useProjectPayments(db, projectId);

  const {
    requisitions,
    loading: reqLoading,
    error: reqError,
  } = useProjectRequisitions(db, projectId);

  const {
    items: boqItems,
    byBill,
    loading: boqLoading,
    error: boqError,
    refresh: refreshBOQ,
  } = useProjectBOQItems(db, projectId);

  const {
    updateBudget,
    loading: budgetUpdateLoading,
  } = useBudgetUpdate(db, projectId, userId);

  // Budget summary from project data
  const summary = useMemo(() => calculateBudgetSummary(
    project.budget.totalBudget,
    project.budget.spent,
    project.budget.committed
  ), [project.budget.totalBudget, project.budget.spent, project.budget.committed]);

  // Category breakdown from BOQ bills
  const categoryBreakdown = useMemo<CategoryBreakdownItem[]>(() => {
    const entries = Object.entries(byBill);
    if (entries.length === 0) return [];

    return entries.map(([billName, items], i) => {
      const allocated = items.reduce((s, item) => s + item.amount, 0);
      const committed = items.reduce((s, item) => s + (item.budgetControl?.committedAmount || 0), 0);
      const spent = items.reduce((s, item) => s + (item.budgetControl?.spentAmount || 0), 0);
      return {
        category: billName,
        label: items[0]?.billName || billName,
        allocated,
        committed,
        spent,
        percentUsed: allocated > 0 ? ((committed + spent) / allocated) * 100 : 0,
        color: BILL_COLORS[i % BILL_COLORS.length],
      };
    });
  }, [byBill]);

  // Requisition summary — scoped to requisition-type payments only
  // (paymentSummary.totalPaid includes IPCs + accountabilities which would inflate these numbers)
  const requisitionSummary = useMemo(() => ({
    totalRequisitioned: requisitions.reduce((s, r) => s + (r.grossAmount || 0), 0),
    totalPaid: requisitions
      .filter(r => r.status === 'paid')
      .reduce((s, r) => s + (r.netAmount || 0), 0),
    totalPending: requisitions
      .filter(r => ['submitted', 'under_review', 'approved', 'processing'].includes(r.status))
      .reduce((s, r) => s + (r.netAmount || 0), 0),
    totalAccountedFor: requisitions
      .filter(r => r.accountabilityStatus === 'complete')
      .reduce((s, r) => s + (r.grossAmount || 0), 0),
    count: requisitions.length,
  }), [requisitions]);

  // Spending timeline from payments
  const spendingTimeline = useMemo<SpendingTimelineEntry[]>(() => {
    let cumulativeSpent = 0;
    let cumulativeCommitted = 0;

    return payments
      .filter(p => p.status === 'paid' || p.status === 'approved')
      .sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
        return aTime - bTime;
      })
      .map(payment => {
        if (payment.status === 'approved') {
          cumulativeCommitted += payment.netAmount;
        }
        if (payment.status === 'paid') {
          cumulativeSpent += payment.netAmount;
        }
        return {
          date: payment.createdAt?.toDate?.() || new Date(),
          label: payment.paymentNumber || payment.paymentType,
          amount: payment.netAmount,
          cumulativeSpent,
          cumulativeCommitted,
          type: payment.paymentType,
          referenceId: payment.id,
        };
      });
  }, [payments]);

  // Budget lines from BOQ items with budget control
  const budgetLines = useMemo<BudgetLineRow[]>(() => {
    return boqItems
      .filter((item): item is ControlBOQItem & { budgetControl: NonNullable<ControlBOQItem['budgetControl']> } =>
        !!item.budgetControl
      )
      .map(item => ({
        id: item.id,
        description: item.description,
        billName: item.billName || item.billNumber,
        allocatedAmount: item.budgetControl.allocatedAmount,
        committedAmount: item.budgetControl.committedAmount,
        spentAmount: item.budgetControl.spentAmount,
        remainingBudget: item.budgetControl.remainingBudget,
        varianceStatus: item.budgetControl.varianceStatus,
        variancePercentage: item.budgetControl.variancePercentage,
      }));
  }, [boqItems]);

  // Budget line summary
  const budgetLineSummary = useMemo(
    () => calculateTotalBudgetSummary(boqItems),
    [boqItems]
  );

  // Variance alerts
  const alerts = useMemo<VarianceAlert[]>(() => {
    const result: VarianceAlert[] = [];

    // Overall project budget check
    if (summary.status === 'over_budget' || summary.status === 'critical') {
      result.push({
        itemId: 'project',
        description: 'Overall Project Budget',
        severity: summary.status === 'critical' ? 'critical' : 'warning',
        message: `Project is ${Math.abs(summary.variancePercent).toFixed(1)}% over budget`,
        amount: Math.abs(summary.remaining),
      });
    }

    // Per-BOQ-item alerts
    boqItems.forEach(item => {
      if (!item.budgetControl) return;
      if (item.budgetControl.varianceStatus === 'exceeded') {
        result.push({
          itemId: item.id,
          description: item.description,
          severity: 'critical',
          message: `Budget exceeded by ${formatBudgetAmount(Math.abs(item.budgetControl.remainingBudget), project.budget.currency)}`,
          amount: Math.abs(item.budgetControl.remainingBudget),
        });
      } else if (item.budgetControl.varianceStatus === 'alert') {
        const pct = item.budgetControl.allocatedAmount > 0
          ? (item.budgetControl.committedAmount / item.budgetControl.allocatedAmount) * 100
          : 0;
        result.push({
          itemId: item.id,
          description: item.description,
          severity: 'warning',
          message: `${pct.toFixed(0)}% of budget committed`,
          amount: item.budgetControl.remainingBudget,
        });
      }
    });

    return result.sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1));
  }, [boqItems, summary, project.budget.currency]);

  // Donut chart segments
  const donutSegments = useMemo(() => {
    const spent = project.budget.spent || 0;
    const committed = project.budget.committed || 0;
    const totalBudget = project.budget.totalBudget || 0;
    const contingencyPct = project.budget.contingencyPercent ?? 0;

    const segments: Array<{ label: string; value: number; color: string }> = [
      { label: 'Spent', value: spent, color: '#3B82F6' },
      { label: 'Committed', value: committed, color: '#93C5FD' },
    ];
    const remaining = totalBudget - spent - committed;
    if (remaining > 0) {
      const contingency = totalBudget * (contingencyPct / 100);
      const freeRemaining = Math.max(0, remaining - contingency);
      if (freeRemaining > 0) {
        segments.push({ label: 'Available', value: freeRemaining, color: '#D1FAE5' });
      }
      if (contingency > 0) {
        segments.push({ label: 'Contingency', value: Math.min(contingency, remaining), color: '#FDE68A' });
      }
    }
    return segments;
  }, [project.budget]);

  const loading = paymentsLoading || reqLoading || boqLoading;
  const error = paymentsError || reqError || boqError;

  const refresh = useCallback(async () => {
    await Promise.all([refreshPayments(), refreshBOQ()]);
  }, [refreshPayments, refreshBOQ]);

  return {
    budget: project.budget,
    summary,
    categoryBreakdown,
    requisitionSummary,
    spendingTimeline,
    budgetLines,
    budgetLineSummary,
    alerts,
    donutSegments,
    loading,
    error,
    updateBudget,
    budgetUpdateLoading,
    refresh,
  };
}
