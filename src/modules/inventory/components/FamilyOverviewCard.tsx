/**
 * FamilyOverviewCard
 * Aggregated stock, cost, and variant summary for family (parent) items.
 * Replaces the normal pricing/stock sections in the Overview tab.
 */

import { Layers, ArrowRight, Loader2 } from 'lucide-react';
import type { FamilyStockRollup } from '../types';

interface FamilyOverviewCardProps {
  rollup: FamilyStockRollup | null;
  loading: boolean;
  onViewVariants: () => void;
  skuCount?: number;
}

export function FamilyOverviewCard({
  rollup,
  loading,
  onViewVariants,
  skuCount,
}: FamilyOverviewCardProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading family data...</span>
      </div>
    );
  }

  const variantCount = rollup?.variantCount ?? skuCount ?? 0;
  const totalStock = rollup?.totalStockQty ?? 0;
  const hasStock = totalStock > 0;
  const avgCost = hasStock ? rollup?.weightedAvgCost ?? 0 : rollup?.simpleAvgCost ?? 0;
  const avgLabel = hasStock ? 'Weighted Valuation Avg' : 'Catalog Valuation Avg';
  const currency = rollup?.currency ?? 'UGX';

  const formatCost = (val: number) => {
    if (val === 0) return '--';
    return `${currency} ${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-4">
      {/* Family indicator */}
      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            Family Item — Non-orderable
          </span>
        </div>
        <span className="text-xs text-blue-600">
          Family pricing derives from SKU valuation cost (UoM + UGX basis)
        </span>
      </div>

      {/* Aggregated stats grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Variant count */}
        <button
          onClick={onViewVariants}
          className="bg-violet-50 rounded-lg p-3 text-center hover:bg-violet-100 transition-colors group"
        >
          <p className="text-lg font-semibold text-violet-700">{variantCount}</p>
          <p className="text-xs text-violet-600">
            Active SKU{variantCount !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-violet-400 mt-1 flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            View all <ArrowRight className="w-3 h-3" />
          </p>
        </button>

        {/* Total stock */}
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-lg font-semibold text-green-700">
            {totalStock.toLocaleString()}
          </p>
          <p className="text-xs text-green-600">Combined Stock</p>
        </div>

        {/* Average cost */}
        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <p className="text-lg font-semibold text-amber-700">
            {formatCost(avgCost)}
          </p>
          <p className="text-xs text-amber-600">{avgLabel}</p>
        </div>
      </div>

      {/* Cost range detail */}
      {rollup && (rollup.costFrom > 0 || rollup.costTo > 0) && (
        <div className="bg-gray-50 rounded-lg px-4 py-3">
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
            Valuation Cost Range Across SKUs
          </h4>
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-gray-500">From</span>
              <p className="text-sm font-medium text-gray-900">{formatCost(rollup.costFrom)}</p>
            </div>
            <div className="flex-1 h-1 bg-gradient-to-r from-green-300 to-amber-300 rounded-full" />
            <div className="text-right">
              <span className="text-xs text-gray-500">To</span>
              <p className="text-sm font-medium text-gray-900">{formatCost(rollup.costTo)}</p>
            </div>
          </div>
          {!hasStock && rollup.simpleAvgCost > 0 && (
            <p className="text-xs text-gray-400 mt-2 italic">
              No stock data yet — showing catalog valuation average
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default FamilyOverviewCard;
