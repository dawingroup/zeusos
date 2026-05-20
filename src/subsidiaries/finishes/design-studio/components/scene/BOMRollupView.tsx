/**
 * BOMRollupView — Renders a SceneBOMRollup at any scope level
 *
 * Categories are collapsible. Project-level shows appearingIn attribution.
 */
import { useState } from 'react';
import type { SceneBOMRollup, BOMCategoryRollup } from '../../types/assembly.types';

interface BOMRollupViewProps {
  rollup: SceneBOMRollup;
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === 'USD') return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  return `UGX ${amount.toLocaleString('en-UG', { minimumFractionDigits: 0 })}`;
}

export function BOMRollupView({ rollup }: BOMRollupViewProps) {
  const categories = Object.values(rollup.byCategory);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{rollup.scopeName}</h3>
        <span className="text-xs text-gray-500">
          {rollup.totalParts} parts — {formatCurrency(rollup.totalCost, rollup.currency)}
        </span>
      </div>

      {categories.map(cat => (
        <CategorySection key={cat.category} category={cat} level={rollup.level} currency={rollup.currency} />
      ))}
    </div>
  );
}

function CategorySection({
  category,
  level,
  currency,
}: {
  category: BOMCategoryRollup;
  level: string;
  currency: string;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-50"
      >
        <span className="capitalize">{category.category.replace('_', ' ')}</span>
        <span className="font-normal normal-case text-gray-400">
          {category.partCount}p — {formatCurrency(category.subtotal, currency)}
        </span>
      </button>

      {expanded && (
        <div className="border-t divide-y">
          {category.lineItems.map((line, i) => (
            <div key={i} className="px-3 py-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-700 truncate max-w-[50%]">
                  {line.description || line.inventoryItemName}
                </span>
                <div className="flex gap-3 text-gray-500">
                  <span>{line.quantity} {line.unit}</span>
                  {line.totalCost > 0 && (
                    <span className="w-20 text-right">{formatCurrency(line.totalCost, currency)}</span>
                  )}
                </div>
              </div>

              {/* Per-cabinet attribution (project level only) */}
              {level === 'project' && line.appearingIn.length > 1 && (
                <div className="flex gap-2 mt-0.5 flex-wrap">
                  {line.appearingIn.map((cab, j) => (
                    <span key={j} className="text-[10px] text-gray-400">
                      {cab.cabinetName} ({cab.qty}×)
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
