/**
 * ChangeOrderPriceImpactCard — renders a pricing impact summary
 * (revenue delta, cost delta, margin impact, warnings) for a CO.
 *
 * Designed to be embedded in the creation wizard review step and the
 * CO detail page. Handles the "cost estimate incomplete" state with a
 * soft warning rather than hiding the card.
 */

import { TrendingUp, TrendingDown, AlertTriangle, Info } from 'lucide-react';
import type { ChangeOrderPriceImpact } from '../types';

interface Props {
  impact: ChangeOrderPriceImpact | null;
  currency?: string;
  loading?: boolean;
  error?: string | null;
  compact?: boolean;
}

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(1)}%`;
}

export default function ChangeOrderPriceImpactCard({
  impact,
  currency = 'UGX',
  loading = false,
  error,
  compact = false,
}: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400" />
          Calculating price impact…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        Failed to compute pricing impact: {error}
      </div>
    );
  }

  if (!impact) {
    return null;
  }

  const revenueUp = impact.deltaRevenue >= 0;
  const marginNegative = impact.marginDelta !== null && impact.marginDelta < 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
      {/* Headline */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Price Impact
          </span>
          <span
            className={`inline-flex items-center gap-1 text-sm font-bold ${
              revenueUp ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {revenueUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {revenueUp ? '+' : ''}
            {formatCurrency(impact.deltaRevenue, currency)}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-gray-500">Previous total</span>
          <span className="text-gray-700">{formatCurrency(impact.previousOrderTotal, currency)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-gray-500">New total</span>
          <span className="font-semibold text-gray-900">
            {formatCurrency(impact.newOrderTotal, currency)}
          </span>
        </div>
      </div>

      {!compact && (
        <div className="px-4 py-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Added revenue</span>
            <span className="text-emerald-600">
              +{formatCurrency(impact.addedRevenue, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Removed revenue</span>
            <span className="text-rose-600">
              -{formatCurrency(impact.removedRevenue, currency)}
            </span>
          </div>
          {impact.modifiedRevenue !== 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Modified revenue</span>
              <span className={impact.modifiedRevenue >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {impact.modifiedRevenue >= 0 ? '+' : ''}
                {formatCurrency(impact.modifiedRevenue, currency)}
              </span>
            </div>
          )}
          {(impact.negotiatedAdjustmentRevenue ?? 0) !== 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Negotiated adjustment</span>
              <span
                className={
                  (impact.negotiatedAdjustmentRevenue ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }
              >
                {(impact.negotiatedAdjustmentRevenue ?? 0) >= 0 ? '+' : ''}
                {formatCurrency(impact.negotiatedAdjustmentRevenue ?? 0, currency)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Cost + margin */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Margin
          </span>
          {impact.marginBelowMinimum && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="h-3 w-3" />
              Below minimum
            </span>
          )}
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-gray-400 uppercase">Before</p>
            <p className="text-sm font-semibold text-gray-700">
              {formatPercent(impact.previousMargin)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase">After</p>
            <p
              className={`text-sm font-semibold ${
                impact.marginBelowMinimum ? 'text-amber-600' : 'text-gray-900'
              }`}
            >
              {formatPercent(impact.newMargin)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase">Delta</p>
            <p
              className={`text-sm font-semibold ${
                marginNegative ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {impact.marginDelta === null
                ? '—'
                : `${impact.marginDelta >= 0 ? '+' : ''}${impact.marginDelta.toFixed(1)} pt`}
            </p>
          </div>
        </div>

        {impact.minimumMarginPercent !== null && (
          <p className="text-[10px] text-gray-400 mt-2">
            Policy minimum: {impact.minimumMarginPercent}%
          </p>
        )}
      </div>

      {/* Warnings */}
      {(impact.warnings.length > 0 || !impact.costEstimateIsComplete) && (
        <div className="px-4 py-3 bg-amber-50/40">
          {!impact.costEstimateIsComplete && (
            <div className="flex items-start gap-2 mb-1.5">
              <Info className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800">
                Cost estimate incomplete — {impact.missingCostItemIds.length} item(s) missing
                design-item cost data.
              </p>
            </div>
          )}
          {impact.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800">{w}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
