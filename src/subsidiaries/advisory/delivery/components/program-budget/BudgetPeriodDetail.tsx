/**
 * BudgetPeriodDetail
 *
 * Expandable detail panel for a selected budget period. Shows allocated
 * budget, carry-forward received, total available, committed, spent,
 * remaining. Progress bar for utilization. Category breakdown bars if
 * `byCategory` exists. Carry-forward status badge if applicable.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Layers, ArrowRight } from 'lucide-react';
import {
  BUDGET_PERIOD_STATUS_CONFIG,
  calculatePeriodUtilization,
} from '../../types/budget-period';
import { CARRY_FORWARD_STATUS_CONFIG } from '../../types/budget-period';
import type { BudgetPeriod } from '../../types/budget-period';
import { BUDGET_CATEGORIES } from '../../types/program-budget';
import type { CategoryBudget } from '../../types/program-budget';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface BudgetPeriodDetailProps {
  period: BudgetPeriod | null;
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const fmtUSD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function utilizationColor(pct: number): string {
  if (pct > 100) return 'bg-red-500';
  if (pct > 90) return 'bg-amber-500';
  if (pct > 70) return 'bg-blue-500';
  return 'bg-green-500';
}

function utilizationTextColor(pct: number): string {
  if (pct > 100) return 'text-red-600';
  if (pct > 90) return 'text-amber-600';
  return 'text-gray-700';
}

// Category bar colors (rotating)
const CATEGORY_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-orange-500',
];

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function BudgetPeriodDetail({ period }: BudgetPeriodDetailProps) {
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(true);

  if (!period) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
        Select a budget period to view details.
      </div>
    );
  }

  const statusCfg = BUDGET_PERIOD_STATUS_CONFIG[period.status];
  const utilization = calculatePeriodUtilization(period);
  const hasCategories = period.byCategory && period.byCategory.length > 0;
  const hasCarryForward =
    period.carryForwardAmount && period.carryForwardAmount.amount > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-blue-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{period.label}</h3>
            <p className="text-xs text-gray-500">
              {new Date(period.startDate).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}{' '}
              -{' '}
              {new Date(period.endDate).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.color} ${statusCfg.bgColor}`}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* Budget figures */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Allocated Budget</p>
            <p className="text-lg font-semibold text-gray-900">
              {fmtUSD.format(period.allocatedBudget.amount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Carry-Forward Received</p>
            <p className="text-lg font-semibold text-gray-900">
              {fmtUSD.format(period.carryForwardReceived.amount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Available</p>
            <p className="text-lg font-semibold text-blue-600">
              {fmtUSD.format(period.totalAvailable.amount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Committed</p>
            <p className="text-lg font-semibold text-amber-600">
              {fmtUSD.format(period.committed.amount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Spent</p>
            <p className="text-lg font-semibold text-green-600">
              {fmtUSD.format(period.spent.amount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Remaining</p>
            <p
              className={`text-lg font-semibold ${
                period.remaining.amount < 0 ? 'text-red-600' : 'text-gray-900'
              }`}
            >
              {fmtUSD.format(period.remaining.amount)}
            </p>
          </div>
        </div>

        {/* Utilization progress bar */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-gray-600">Utilization</span>
            <span className={`font-semibold ${utilizationTextColor(utilization)}`}>
              {utilization.toFixed(1)}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${utilizationColor(utilization)}`}
              style={{ width: `${Math.min(utilization, 100)}%` }}
            />
          </div>
          {utilization > 100 && (
            <p className="text-xs text-red-500 mt-1">
              Over-committed by {fmtUSD.format(
                (period.committed.amount + period.spent.amount) - period.totalAvailable.amount
              )}
            </p>
          )}
        </div>

        {/* Carry-forward outgoing */}
        {hasCarryForward && period.carryForwardStatus && (
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Carry-Forward to Next Year
                  </p>
                  <p className="text-xs text-gray-500">
                    {fmtUSD.format(period.carryForwardAmount!.amount)}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  CARRY_FORWARD_STATUS_CONFIG[period.carryForwardStatus].color
                } ${CARRY_FORWARD_STATUS_CONFIG[period.carryForwardStatus].bgColor}`}
              >
                {CARRY_FORWARD_STATUS_CONFIG[period.carryForwardStatus].label}
              </span>
            </div>
          </div>
        )}

        {/* Category breakdown */}
        {hasCategories && (
          <div className="border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setIsCategoryExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors w-full"
            >
              {isCategoryExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              Category Breakdown
            </button>

            {isCategoryExpanded && (
              <div className="mt-3 space-y-3">
                {period.byCategory!.map((cat: CategoryBudget, idx: number) => {
                  const catConfig = BUDGET_CATEGORIES[cat.category];
                  const catAllocated = cat.allocated.amount;
                  const catSpent = cat.spent.amount + cat.committed.amount;
                  const catPct = catAllocated > 0 ? (catSpent / catAllocated) * 100 : 0;
                  const barColor = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">
                          {catConfig?.label ?? cat.category}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>
                            {fmtUSD.format(catSpent)} / {fmtUSD.format(catAllocated)}
                          </span>
                          <span
                            className={`font-medium ${
                              catPct > 100
                                ? 'text-red-600'
                                : catPct > 90
                                  ? 'text-amber-600'
                                  : 'text-gray-700'
                            }`}
                          >
                            {catPct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            catPct > 100 ? 'bg-red-500' : barColor
                          }`}
                          style={{ width: `${Math.min(catPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {period.notes && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500">Notes</p>
            <p className="text-sm text-gray-700 mt-0.5">{period.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
