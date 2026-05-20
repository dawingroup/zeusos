/**
 * VariantPricePreview Component
 * Shows base cost + finish modifier = estimated unit cost.
 */

import type { ResolvedPricePreview } from '@/modules/inventory/hooks/useVariantResolver';

interface VariantPricePreviewProps {
  preview: ResolvedPricePreview | null;
  loading?: boolean;
  stockAvailable?: number | null;
}

export function VariantPricePreview({ preview, loading, stockAvailable }: VariantPricePreviewProps) {
  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-3 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-6 bg-gray-200 rounded w-1/2" />
      </div>
    );
  }

  if (!preview) return null;

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-UG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount) + ` ${currency}`;
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
      <p className="text-xs font-medium text-gray-500 uppercase">Price Preview</p>

      <div className="flex items-baseline justify-between text-sm">
        <span className="text-gray-600">Base cost</span>
        <span className="font-mono">{formatCurrency(preview.baseCost, preview.currency)}</span>
      </div>

      {preview.modifierType !== 'none' && (
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-gray-600">
            Finish: {preview.finishName}
            {preview.modifierType === 'percentage' ? ` (${preview.finishModifier}%)` : ''}
          </span>
          <span className="font-mono text-blue-600">
            {preview.modifierType === 'percentage'
              ? `+${((preview.baseCost * preview.finishModifier) / 100).toFixed(0)}`
              : `+${preview.finishModifier}`}
          </span>
        </div>
      )}

      <div className="border-t border-gray-300 pt-1 flex items-baseline justify-between">
        <span className="text-sm font-medium text-gray-900">Estimated unit cost</span>
        <span className="text-lg font-semibold font-mono text-gray-900">
          {formatCurrency(preview.estimatedUnitCost, preview.currency)}
        </span>
      </div>

      {stockAvailable !== undefined && stockAvailable !== null && (
        <div className="flex items-baseline justify-between text-xs pt-1">
          <span className="text-gray-500">Stock available</span>
          <span className={`font-medium ${stockAvailable > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stockAvailable > 0 ? `${stockAvailable} in stock` : 'Not in stock'}
          </span>
        </div>
      )}

      {stockAvailable === null && (
        <p className="text-xs text-gray-400 pt-1">
          No variant exists yet — will be created on first purchase
        </p>
      )}
    </div>
  );
}
