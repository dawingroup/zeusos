/**
 * BudgetPeriodTimeline
 *
 * Horizontal timeline of calendar-year budget periods. Each year is
 * rendered as a pill/badge. The active period gets a highlighted ring.
 * Clicking a period selects it (or deselects if already selected).
 * Allocated + carry-forward amounts are shown beneath each year badge.
 */

import { Calendar, ChevronRight } from 'lucide-react';
import {
  BUDGET_PERIOD_STATUS_CONFIG,
} from '../../types/budget-period';
import type { BudgetPeriod } from '../../types/budget-period';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface BudgetPeriodTimelineProps {
  periods: BudgetPeriod[];
  activePeriod: BudgetPeriod | null;
  selectedPeriodId: string | null;
  onSelectPeriod: (periodId: string | null) => void;
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const fmtCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function BudgetPeriodTimeline({
  periods,
  activePeriod,
  selectedPeriodId,
  onSelectPeriod,
}: BudgetPeriodTimelineProps) {
  // Sort periods chronologically by year
  const sorted = [...periods].sort((a, b) => a.year - b.year);

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        No budget periods configured.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-gray-500" />
        <h3 className="text-lg font-semibold text-gray-900">Budget Periods</h3>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {/* Scrollable horizontal timeline */}
        <div className="flex items-start gap-2 overflow-x-auto pb-2">
          {sorted.map((period, idx) => {
            const isActive = activePeriod?.id === period.id;
            const isSelected = selectedPeriodId === period.id;
            const statusCfg = BUDGET_PERIOD_STATUS_CONFIG[period.status];
            const carryForward = period.carryForwardReceived.amount;

            return (
              <div key={period.id} className="flex items-start flex-shrink-0">
                {/* Period pill */}
                <button
                  type="button"
                  onClick={() =>
                    onSelectPeriod(isSelected ? null : period.id)
                  }
                  className={`
                    flex flex-col items-center gap-1.5 rounded-xl px-4 py-3
                    transition-all cursor-pointer min-w-[120px]
                    ${
                      isSelected
                        ? 'bg-blue-50 border-2 border-blue-500 shadow-sm'
                        : isActive
                          ? 'bg-green-50 border-2 border-green-400 ring-2 ring-green-200'
                          : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }
                  `}
                >
                  {/* Year label */}
                  <span
                    className={`text-base font-semibold ${
                      isSelected
                        ? 'text-blue-700'
                        : isActive
                          ? 'text-green-700'
                          : 'text-gray-900'
                    }`}
                  >
                    {period.label}
                  </span>

                  {/* Status badge */}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.color} ${statusCfg.bgColor}`}
                  >
                    {statusCfg.label}
                  </span>

                  {/* Amounts */}
                  <div className="text-center space-y-0.5 mt-1">
                    <p className="text-xs text-gray-600">
                      Allocated:{' '}
                      <span className="font-medium">
                        {fmtCompact.format(period.allocatedBudget.amount)}
                      </span>
                    </p>
                    {carryForward > 0 && (
                      <p className="text-xs text-amber-600">
                        +CF:{' '}
                        <span className="font-medium">
                          {fmtCompact.format(carryForward)}
                        </span>
                      </p>
                    )}
                  </div>
                </button>

                {/* Connector arrow */}
                {idx < sorted.length - 1 && (
                  <div className="flex items-center self-center px-1 pt-1">
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400 ring-1 ring-green-200" />
            Active
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
            Selected
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300" />
            Other
          </span>
        </div>
      </div>
    </div>
  );
}
