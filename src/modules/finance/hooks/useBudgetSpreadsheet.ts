// ============================================================================
// USE BUDGET SPREADSHEET HOOK
// Composes useBudgets + useBudget for the spreadsheet page.
// Manages budget selection, grouped line items, inline editing,
// and expand/collapse state.
// ============================================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useBudgets } from './useBudgets';
import { useBudget } from './useBudget';
import type { BudgetLineItem } from '../types/budget.types';
import type { AccountType } from '../constants/account.constants';
import { FISCAL_MONTHS } from '../constants/budget.constants';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GroupedLines {
  accountType: AccountType;
  label: string;
  lines: BudgetLineItem[];
  totals: PeriodTotals;
}

export interface PeriodTotals {
  periods: number[];           // 12 budget amounts
  annualBudget: number;
  annualActual: number;
  annualCommitted: number;
  annualAvailable: number;
  annualVariance: number;
}

const ACCOUNT_TYPE_ORDER: AccountType[] = [
  'revenue', 'expense', 'asset', 'liability', 'equity',
];

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  revenue: 'REVENUE',
  expense: 'EXPENSES',
  asset: 'ASSETS',
  liability: 'LIABILITIES',
  equity: 'EQUITY',
};

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseBudgetSpreadsheetOptions {
  companyId: string;
}

export function useBudgetSpreadsheet({ companyId }: UseBudgetSpreadsheetOptions) {
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const pendingEdits = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Budget list
  const {
    budgets,
    loading: budgetsLoading,
    refresh: refreshBudgets,
  } = useBudgets({ companyId });

  // Selected budget + lines
  const {
    budget,
    lines,
    loading: budgetLoading,
    linesLoading,
    saving,
    error,
    createBudget,
    updateBudget,
    addLine,
    updateLine,
    deleteLine,
    refresh: refreshBudget,
    refreshLines,
    submitForApproval,
    approve,
    reject,
    activate,
  } = useBudget({
    companyId,
    budgetId: selectedBudgetId ?? undefined,
    autoLoad: !!selectedBudgetId,
  });

  // Auto-select first budget
  useEffect(() => {
    if (!selectedBudgetId && budgets.length > 0) {
      setSelectedBudgetId(budgets[0].id);
    }
  }, [budgets, selectedBudgetId]);

  // Group lines by accountType
  const groupedLines = useMemo((): GroupedLines[] => {
    const groups: Record<string, BudgetLineItem[]> = {};
    for (const line of lines) {
      const type = line.accountType || 'expense';
      if (!groups[type]) groups[type] = [];
      groups[type].push(line);
    }

    return ACCOUNT_TYPE_ORDER
      .filter(type => groups[type]?.length)
      .map(type => {
        const groupLines = groups[type].sort((a, b) =>
          a.accountName.localeCompare(b.accountName)
        );

        const totals: PeriodTotals = {
          periods: Array(12).fill(0),
          annualBudget: 0,
          annualActual: 0,
          annualCommitted: 0,
          annualAvailable: 0,
          annualVariance: 0,
        };

        for (const line of groupLines) {
          totals.annualBudget += line.annualBudget;
          totals.annualActual += line.annualActual;
          totals.annualCommitted += line.annualCommitted;
          totals.annualAvailable += line.annualAvailable;
          totals.annualVariance += line.annualVariance;

          for (let i = 0; i < 12; i++) {
            totals.periods[i] += line.periodAmounts[i]?.budgetAmount || 0;
          }
        }

        return {
          accountType: type,
          label: ACCOUNT_TYPE_LABELS[type] || type.toUpperCase(),
          lines: groupLines,
          totals,
        };
      });
  }, [lines]);

  // Grand totals
  const grandTotals = useMemo((): PeriodTotals => {
    const t: PeriodTotals = {
      periods: Array(12).fill(0),
      annualBudget: 0,
      annualActual: 0,
      annualCommitted: 0,
      annualAvailable: 0,
      annualVariance: 0,
    };
    for (const group of groupedLines) {
      t.annualBudget += group.totals.annualBudget;
      t.annualActual += group.totals.annualActual;
      t.annualCommitted += group.totals.annualCommitted;
      t.annualAvailable += group.totals.annualAvailable;
      t.annualVariance += group.totals.annualVariance;
      for (let i = 0; i < 12; i++) {
        t.periods[i] += group.totals.periods[i];
      }
    }
    return t;
  }, [groupedLines]);

  // Fiscal month headers
  const fiscalMonthHeaders = useMemo(() =>
    FISCAL_MONTHS.map(fm => ({
      label: fm.name.slice(0, 3),
      fullLabel: fm.name,
      fiscalMonth: fm.fiscalMonth,
      calendarMonth: fm.month,
    })),
    []
  );

  // Toggle group expand/collapse
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  // Inline cell edit (debounced save)
  const editCell = useCallback((
    lineId: string,
    periodIndex: number,
    value: number
  ) => {
    // Cancel any pending save for this line
    const existing = pendingEdits.current.get(lineId);
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(async () => {
      const line = lines.find(l => l.id === lineId);
      if (!line) return;

      const newPeriodAmounts = line.periodAmounts.map((p, i) =>
        i === periodIndex ? value : p.budgetAmount
      );
      const newAnnual = newPeriodAmounts.reduce((s, v) => s + v, 0);

      await updateLine(lineId, {
        annualBudget: newAnnual,
        allocationMethod: 'custom',
        periodAmounts: newPeriodAmounts,
      });

      pendingEdits.current.delete(lineId);
    }, 600);

    pendingEdits.current.set(lineId, timeout);
  }, [lines, updateLine]);

  // Select budget
  const selectBudget = useCallback((budgetId: string) => {
    setSelectedBudgetId(budgetId);
    setExpandedGroups({});
  }, []);

  const isLoading = budgetsLoading || budgetLoading || linesLoading;

  return {
    // Budget list
    budgets,
    selectedBudgetId,
    selectBudget,

    // Selected budget data
    budget,
    lines,
    groupedLines,
    grandTotals,
    fiscalMonthHeaders,

    // UI state
    expandedGroups,
    toggleGroup,
    isLoading,
    saving,
    error,

    // CRUD actions
    createBudget,
    updateBudget,
    addLine,
    updateLine,
    deleteLine,
    editCell,

    // Workflow
    submitForApproval,
    approve,
    reject,
    activate,

    // Refresh
    refreshBudgets,
    refreshBudget,
    refreshLines,
  };
}
