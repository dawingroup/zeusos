/**
 * ALLOCATION SPLITTER
 *
 * Reusable multi-project split UI for both Quick Capture and standard
 * accountability forms. Mobile-first with stacked rows on small screens.
 *
 * Features:
 * - Method selector (Percentage / Fixed Amount / Pro Rata)
 * - Vendor history suggestions ("You split [vendor] before: 60/40")
 * - Project selector per row (excludes already-selected projects)
 * - Budget category per row with available balance indicator
 * - Running total with validation
 * - Required rationale field
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Percent,
  DollarSign,
  Scale,
} from 'lucide-react';
import type { AllocationSplitRow, AllocationMethod, AllocationSuggestion } from '../../types/allocation';
import { ALLOCATION_METHOD_CONFIG } from '../../types/allocation';
import { formatBudgetAmount, type BudgetAllocationType } from '../../types/project-budget';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';

// ─────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────

interface AllocationSplitterProps {
  totalAmount: number;
  currency: 'UGX' | 'USD';
  vendorName: string;
  activeProjects: Project[];
  method: AllocationMethod;
  onMethodChange: (method: AllocationMethod) => void;
  allocations: AllocationSplitRow[];
  onChange: (allocations: AllocationSplitRow[]) => void;
  rationale: string;
  onRationaleChange: (rationale: string) => void;
  suggestions?: AllocationSuggestion[];
}

// Budget category options
const BUDGET_CATEGORIES: { value: BudgetAllocationType; label: string }[] = [
  { value: 'materials', label: 'Materials' },
  { value: 'labor', label: 'Labour' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'overhead', label: 'Overhead' },
  { value: 'contingency', label: 'Contingency' },
  { value: 'other', label: 'Other' },
];

const METHOD_ICONS: Record<AllocationMethod, typeof Percent> = {
  Percentage: Percent,
  FixedAmount: DollarSign,
  ProRata: Scale,
};

export function AllocationSplitter({
  totalAmount,
  currency,
  vendorName,
  activeProjects,
  method,
  onMethodChange,
  allocations,
  onChange,
  rationale,
  onRationaleChange,
  suggestions,
}: AllocationSplitterProps) {
  const [showSuggestion, setShowSuggestion] = useState(true);

  // Compute totals
  const totalAllocated = useMemo(
    () => allocations.reduce((s, a) => s + a.allocatedAmount, 0),
    [allocations]
  );
  const totalPercent = useMemo(
    () => allocations.reduce((s, a) => s + a.percentage, 0),
    [allocations]
  );
  const remaining = totalAmount - totalAllocated;
  const isValid = Math.abs(remaining) < (currency === 'UGX' ? 2 : 0.02) && allocations.length >= 2;

  // Projects not yet selected
  const availableProjects = useMemo(() => {
    const selected = new Set(allocations.map((a) => a.projectId));
    return activeProjects.filter((p) => !selected.has(p.id));
  }, [activeProjects, allocations]);

  // Apply suggestion
  const applySuggestion = useCallback(() => {
    if (!suggestions || suggestions.length < 2) return;
    const newAllocations: AllocationSplitRow[] = suggestions.slice(0, 5).map((s) => {
      const project = activeProjects.find((p) => p.id === s.projectId);
      const amt = Math.round((s.percentage / 100) * totalAmount);
      return {
        projectId: s.projectId,
        projectName: s.projectName,
        programId: project?.programId || '',
        budgetCategory: s.budgetCategory,
        budgetCategoryLabel: BUDGET_CATEGORIES.find((c) => c.value === s.budgetCategory)?.label || s.budgetCategory,
        availableBudget: project?.budget?.remaining ?? 0,
        percentage: s.percentage,
        allocatedAmount: amt,
        rationale: '',
      };
    });
    onChange(newAllocations);
    setShowSuggestion(false);
  }, [suggestions, activeProjects, totalAmount, onChange]);

  // Add a new allocation row
  const addRow = useCallback(() => {
    if (availableProjects.length === 0) return;
    const project = availableProjects[0];
    const remainingPct = Math.max(0, 100 - totalPercent);
    const remainingAmt = Math.max(0, totalAmount - totalAllocated);

    onChange([
      ...allocations,
      {
        projectId: project.id,
        projectName: project.name,
        programId: project.programId,
        budgetCategory: 'materials',
        budgetCategoryLabel: 'Materials',
        availableBudget: project.budget?.remaining ?? 0,
        percentage: Math.round(remainingPct * 10) / 10,
        allocatedAmount: Math.round(remainingAmt),
        rationale: '',
      },
    ]);
  }, [allocations, availableProjects, totalPercent, totalAllocated, totalAmount, onChange]);

  // Remove a row
  const removeRow = useCallback(
    (index: number) => {
      onChange(allocations.filter((_, i) => i !== index));
    },
    [allocations, onChange]
  );

  // Update a row
  const updateRow = useCallback(
    (index: number, updates: Partial<AllocationSplitRow>) => {
      const updated = allocations.map((row, i) => {
        if (i !== index) return row;
        const newRow = { ...row, ...updates };

        // Recalculate amount from percentage or vice versa based on method
        if (method === 'Percentage' && 'percentage' in updates) {
          newRow.allocatedAmount = Math.round((newRow.percentage / 100) * totalAmount);
        } else if (method === 'FixedAmount' && 'allocatedAmount' in updates) {
          newRow.percentage = totalAmount > 0
            ? Math.round((newRow.allocatedAmount / totalAmount) * 1000) / 10
            : 0;
        }

        return newRow;
      });
      onChange(updated);
    },
    [allocations, method, totalAmount, onChange]
  );

  // Handle project selection change
  const handleProjectChange = useCallback(
    (index: number, projectId: string) => {
      const project = activeProjects.find((p) => p.id === projectId);
      if (!project) return;
      updateRow(index, {
        projectId: project.id,
        projectName: project.name,
        programId: project.programId,
        availableBudget: project.budget?.remaining ?? 0,
      });
    },
    [activeProjects, updateRow]
  );

  return (
    <div className="space-y-4">
      {/* Method Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Split Method
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(ALLOCATION_METHOD_CONFIG) as AllocationMethod[]).map(
            (m) => {
              const Icon = METHOD_ICONS[m];
              const isActive = method === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onMethodChange(m)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs transition-colors min-h-[56px] ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{ALLOCATION_METHOD_CONFIG[m].label}</span>
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Vendor Suggestion Banner */}
      {showSuggestion && suggestions && suggestions.length >= 2 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-800">
              You&apos;ve split <strong>{vendorName}</strong> before:{' '}
              {suggestions.map((s) => `${s.percentage}%`).join('/')}
            </p>
            <button
              type="button"
              onClick={applySuggestion}
              className="text-sm font-medium text-amber-700 underline mt-1"
            >
              Use this pattern
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowSuggestion(false)}
            className="text-amber-400 hover:text-amber-600"
          >
            &times;
          </button>
        </div>
      )}

      {/* Allocation Rows */}
      <div className="space-y-3">
        {allocations.map((row, index) => {
          const selectedIds = new Set(allocations.map((a) => a.projectId));
          const projectOptions = activeProjects.filter(
            (p) => p.id === row.projectId || !selectedIds.has(p.id)
          );
          const exceedsBudget = row.allocatedAmount > row.availableBudget && row.availableBudget > 0;

          return (
            <div
              key={`${row.projectId}-${index}`}
              className="border border-gray-200 rounded-lg p-3 space-y-2"
            >
              {/* Row Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase">
                  Project {index + 1}
                </span>
                {allocations.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Project Selector */}
              <select
                value={row.projectId}
                onChange={(e) => handleProjectChange(index, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
              >
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectCode})
                  </option>
                ))}
              </select>

              {/* Budget Category */}
              <select
                value={row.budgetCategory}
                onChange={(e) => {
                  const cat = BUDGET_CATEGORIES.find((c) => c.value === e.target.value);
                  updateRow(index, {
                    budgetCategory: e.target.value,
                    budgetCategoryLabel: cat?.label || e.target.value,
                  });
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
              >
                {BUDGET_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>

              {/* Percentage + Amount */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Percentage</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="99.9"
                      value={row.percentage || ''}
                      onChange={(e) =>
                        updateRow(index, { percentage: parseFloat(e.target.value) || 0 })
                      }
                      disabled={method === 'FixedAmount'}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm pr-8 min-h-[44px] disabled:bg-gray-50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      %
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount</label>
                  <input
                    type="number"
                    min="1"
                    value={row.allocatedAmount || ''}
                    onChange={(e) =>
                      updateRow(index, {
                        allocatedAmount: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={method === 'Percentage'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px] disabled:bg-gray-50"
                  />
                </div>
              </div>

              {/* Budget Indicator */}
              <div className={`text-xs px-2 py-1 rounded ${exceedsBudget ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
                {exceedsBudget && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                Available: {formatBudgetAmount(row.availableBudget, currency)}
                {exceedsBudget && ' — exceeds budget'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Project Button */}
      {availableProjects.length > 0 && allocations.length < 5 && (
        <button
          type="button"
          onClick={addRow}
          className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Add Project
        </button>
      )}

      {/* Summary Bar */}
      <div className={`flex items-center justify-between p-3 rounded-lg border ${isValid ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
        <div>
          <p className="text-sm font-medium text-gray-900">
            Allocated: {formatBudgetAmount(totalAllocated, currency)}{' '}
            <span className="text-gray-500">of {formatBudgetAmount(totalAmount, currency)}</span>
          </p>
          <p className="text-xs text-gray-500">{totalPercent.toFixed(1)}% assigned</p>
        </div>
        <div className="text-right">
          {isValid ? (
            <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Balanced
            </span>
          ) : remaining > 0 ? (
            <span className="text-sm text-amber-600 font-medium">
              {formatBudgetAmount(remaining, currency)} unallocated
            </span>
          ) : remaining < 0 ? (
            <span className="text-sm text-red-600 font-medium">
              {formatBudgetAmount(Math.abs(remaining), currency)} over
            </span>
          ) : null}
        </div>
      </div>

      {/* Rationale (Required) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Allocation Rationale <span className="text-red-500">*</span>
        </label>
        <textarea
          value={rationale}
          onChange={(e) => onRationaleChange(e.target.value)}
          placeholder="Explain why this purchase is being split across these projects..."
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm resize-none"
        />
      </div>
    </div>
  );
}
