// ============================================================================
// BUDGET LINE DRAWER
// Slide-in detail drawer for a single budget line item.
// Shows: bar chart (budget vs actual vs committed), allocation editor,
// source info, and "Push to Forecast" action.
// ============================================================================

import { useState, useEffect } from 'react';
import { X, ArrowUpRight, Trash2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { SafeResponsiveContainer } from '@/core/components/ui/SafeResponsiveContainer';
import { Button } from '@/core/components/ui/button';
import type { BudgetLineItem, BudgetLineUpdate } from '../../types/budget.types';
import {
  ALLOCATION_METHOD_LABELS,
  FISCAL_MONTHS,
  type AllocationMethod,
} from '../../constants/budget.constants';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  line: BudgetLineItem;
  onSave: (lineId: string, update: BudgetLineUpdate) => Promise<void>;
  onDelete: (lineId: string) => Promise<void>;
  onPushToForecast: (line: BudgetLineItem) => void;
  onClose: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  if (v === 0) return '—';
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manually entered',
  forecast: 'Imported from Forecast',
  procurement: 'Imported from Procurement',
};

// ── Component ───────────────────────────────────────────────────────────────

export function BudgetLineDrawer({ line, onSave, onDelete, onPushToForecast, onClose }: Props) {
  const [annualBudget, setAnnualBudget] = useState(line.annualBudget);
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>(line.allocationMethod);
  const [customAmounts, setCustomAmounts] = useState<number[]>(
    line.periodAmounts.map(p => p.budgetAmount)
  );
  const [notes, setNotes] = useState(line.notes || '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset when line changes
  useEffect(() => {
    setAnnualBudget(line.annualBudget);
    setAllocationMethod(line.allocationMethod);
    setCustomAmounts(line.periodAmounts.map(p => p.budgetAmount));
    setNotes(line.notes || '');
    setConfirmDelete(false);
  }, [line.id]);

  // Chart data
  const chartData = FISCAL_MONTHS.map((fm, i) => {
    const pa = line.periodAmounts[i];
    return {
      month: fm.name.slice(0, 3),
      budget: pa?.budgetAmount || 0,
      actual: pa?.actualAmount || 0,
      committed: pa?.committedAmount || 0,
    };
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const update: BudgetLineUpdate = {
        notes: notes || undefined,
        annualBudget,
        allocationMethod,
      };
      if (allocationMethod === 'custom') {
        update.periodAmounts = customAmounts;
      }
      await onSave(line.id, update);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await onDelete(line.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const sourceType = line.sourceType || 'manual';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card shadow-2xl border-l border-[var(--border-subtle)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">{line.accountName}</h3>
          <p className="text-xs text-[var(--fg-tertiary)] mt-0.5">{line.accountCode}</p>
        </div>
        <button onClick={onClose} className="text-[var(--fg-tertiary)] hover:text-muted-foreground p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Chart */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Monthly Breakdown
          </h4>
          <div className="h-48">
            <SafeResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={1} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1_000_000).toFixed(0)}M`} />
                <Tooltip
                  formatter={(value) => `UGX ${Number(value).toLocaleString()}`}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="budget" fill="#3B82F6" name="Budget" radius={[2, 2, 0, 0]} />
                <Bar dataKey="actual" fill="#10B981" name="Actual" radius={[2, 2, 0, 0]} />
                <Bar dataKey="committed" fill="#F59E0B" name="Committed" radius={[2, 2, 0, 0]} />
              </BarChart>
            </SafeResponsiveContainer>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--bg-sunken)] rounded-lg p-3">
            <p className="text-[10px] font-medium text-[var(--fg-tertiary)] uppercase">Budget</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{fmt(line.annualBudget)}</p>
          </div>
          <div className="bg-[var(--bg-sunken)] rounded-lg p-3">
            <p className="text-[10px] font-medium text-[var(--fg-tertiary)] uppercase">Actual</p>
            <p className="text-lg font-bold text-emerald-600 tabular-nums">{fmt(line.annualActual)}</p>
          </div>
          <div className="bg-[var(--bg-sunken)] rounded-lg p-3">
            <p className="text-[10px] font-medium text-[var(--fg-tertiary)] uppercase">Committed</p>
            <p className="text-lg font-bold text-amber-600 tabular-nums">{fmt(line.annualCommitted)}</p>
          </div>
          <div className="bg-[var(--bg-sunken)] rounded-lg p-3">
            <p className="text-[10px] font-medium text-[var(--fg-tertiary)] uppercase">Available</p>
            <p className="text-lg font-bold text-muted-foreground tabular-nums">{fmt(line.annualAvailable)}</p>
          </div>
        </div>

        {/* Annual budget */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Annual Budget (UGX)</label>
          <input
            type="number"
            className="mt-1 w-full border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={annualBudget}
            onChange={e => setAnnualBudget(parseFloat(e.target.value) || 0)}
            disabled={line.isLocked}
          />
        </div>

        {/* Allocation method */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Allocation Method</label>
          <select
            className="mt-1 w-full border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={allocationMethod}
            onChange={e => setAllocationMethod(e.target.value as AllocationMethod)}
            disabled={line.isLocked}
          >
            {Object.entries(ALLOCATION_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Custom period amounts */}
        {allocationMethod === 'custom' && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Period Amounts</label>
            <div className="mt-2 space-y-1.5">
              {FISCAL_MONTHS.map((fm, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8">{fm.name.slice(0, 3)}</span>
                  <input
                    type="number"
                    className="flex-1 border border-[var(--border-subtle)] rounded px-2 py-1 text-sm tabular-nums text-right focus:outline-none focus:ring-1 focus:ring-blue-300"
                    value={customAmounts[i] || 0}
                    onChange={e => {
                      const next = [...customAmounts];
                      next[i] = parseFloat(e.target.value) || 0;
                      setCustomAmounts(next);
                      setAnnualBudget(next.reduce((s, v) => s + v, 0));
                    }}
                    disabled={line.isLocked}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <textarea
            className="mt-1 w-full border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes..."
          />
        </div>

        {/* Source info */}
        <div className="bg-[var(--bg-sunken)] rounded-lg p-3">
          <p className="text-[10px] font-medium text-[var(--fg-tertiary)] uppercase mb-1">Source</p>
          <p className="text-sm text-muted-foreground">{SOURCE_LABELS[sourceType]}</p>
          {sourceType === 'forecast' && line.sourceForecastId && (
            <p className="text-xs text-blue-500 mt-0.5">Forecast ID: {line.sourceForecastId}</p>
          )}
          {sourceType === 'procurement' && line.sourceProcurementReqId && (
            <p className="text-xs text-amber-600 mt-0.5">Req ID: {line.sourceProcurementReqId}</p>
          )}
        </div>

        {/* Push to Forecast */}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-blue-600 border-blue-200 hover:bg-blue-50"
          onClick={() => onPushToForecast(line)}
        >
          <ArrowUpRight className="w-4 h-4 mr-1.5" />
          Push to Forecast
        </Button>
      </div>

      {/* Footer actions */}
      <div className="border-t border-[var(--border-subtle)] px-5 py-3 flex items-center gap-2">
        {confirmDelete ? (
          <>
            <span className="text-xs text-red-600 flex-1">Are you sure?</span>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={saving || line.annualActual > 0}
            >
              Delete
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600"
              onClick={() => setConfirmDelete(true)}
              disabled={line.isLocked || line.annualActual > 0}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || line.isLocked}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
