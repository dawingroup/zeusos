/**
 * SupplierCostAnalysis Component
 * Displays ranked supplier comparison with pricing, performance, and recommendations
 */

import { useState } from 'react';
import {
  Trophy,
  Clock,
  Award,
  Star,
  ChevronDown,
  ChevronUp,
  Loader2,
  BarChart3,
  TrendingDown,
  Building2,
  SlidersHorizontal,
} from 'lucide-react';
import { useSupplierAnalysis } from '../hooks/useSupplierAnalysis';
import type { SupplierInventoryPricing, SupplierRankingWeights } from '../types';
import { DEFAULT_RANKING_WEIGHTS } from '../types';

interface SupplierCostAnalysisProps {
  supplierPricing: SupplierInventoryPricing[];
  itemName: string;
  currency?: string;
}

const RECOMMENDATION_STYLES: Record<string, { label: string; color: string; icon: typeof Trophy }> = {
  'best-value': { label: 'Best Value', color: 'bg-green-100 text-green-700', icon: Trophy },
  'fastest': { label: 'Fastest', color: 'bg-blue-100 text-blue-700', icon: Clock },
  'highest-quality': { label: 'Top Quality', color: 'bg-purple-100 text-purple-700', icon: Award },
  'preferred': { label: 'Preferred', color: 'bg-amber-100 text-amber-700', icon: Star },
  'standard': { label: '', color: '', icon: Building2 },
};

export function SupplierCostAnalysis({
  supplierPricing,
  itemName: _itemName,
  currency: defaultCurrency = 'UGX',
}: SupplierCostAnalysisProps) {
  const [showWeights, setShowWeights] = useState(false);
  const [weights, setWeights] = useState<SupplierRankingWeights>(DEFAULT_RANKING_WEIGHTS);

  const { rankings, priceSummary, loading, error, recalculate } = useSupplierAnalysis(supplierPricing);

  const formatCurrency = (amount: number, curr?: string) => {
    const c = curr || defaultCurrency;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: c,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleWeightChange = (key: keyof SupplierRankingWeights, value: number) => {
    const newWeights = { ...weights, [key]: value };
    setWeights(newWeights);
    recalculate(newWeights);
  };

  if (supplierPricing.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
        <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p>No suppliers to analyze.</p>
        <p className="text-xs mt-1">Add supplier pricing to see cost analysis and recommendations.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Analyzing suppliers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Price Summary */}
      {priceSummary && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-gray-500" />
            <h4 className="font-medium text-gray-900">Price Summary</h4>
            <span className="text-xs text-gray-500">({priceSummary.supplierCount} suppliers)</span>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Lowest</p>
              <p className="text-lg font-semibold text-green-600">
                {formatCurrency(priceSummary.minPrice, priceSummary.currency)}
              </p>
              {priceSummary.cheapestSupplierName && (
                <p className="text-xs text-gray-500 truncate">{priceSummary.cheapestSupplierName}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Highest</p>
              <p className="text-lg font-semibold text-red-600">
                {formatCurrency(priceSummary.maxPrice, priceSummary.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Average</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(priceSummary.avgPrice, priceSummary.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Price Spread</p>
              <p className="text-lg font-semibold text-gray-700">
                {priceSummary.priceSpreadPercent}%
              </p>
              {priceSummary.preferredSavingsPercent > 0 && (
                <p className="text-xs text-green-600">
                  {priceSummary.preferredSavingsPercent}% savings possible
                </p>
              )}
            </div>
          </div>

          {/* Visual price range bar */}
          {priceSummary.priceSpread > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="relative h-2 bg-gray-200 rounded-full">
                <div
                  className="absolute h-2 bg-gradient-to-r from-green-400 to-red-400 rounded-full"
                  style={{ width: '100%' }}
                />
                {rankings.map((r) => {
                  const position = ((r.unitPrice - priceSummary.minPrice) / priceSummary.priceSpread) * 100;
                  return (
                    <div
                      key={r.supplierId}
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-gray-700 rounded-full"
                      style={{ left: `${Math.min(Math.max(position, 2), 98)}%` }}
                      title={`${r.supplierName}: ${formatCurrency(r.unitPrice, r.currency)}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>{formatCurrency(priceSummary.minPrice, priceSummary.currency)}</span>
                <span>{formatCurrency(priceSummary.maxPrice, priceSummary.currency)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Adjustable Weights */}
      <div>
        <button
          type="button"
          onClick={() => setShowWeights(!showWeights)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Ranking Weights</span>
          {showWeights ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showWeights && (
          <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
            {([
              { key: 'price' as const, label: 'Price', color: 'accent-green-500' },
              { key: 'delivery' as const, label: 'Delivery', color: 'accent-blue-500' },
              { key: 'quality' as const, label: 'Quality', color: 'accent-purple-500' },
              { key: 'reliability' as const, label: 'Reliability', color: 'accent-amber-500' },
            ]).map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-700 w-20">{label}</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(weights[key] * 100)}
                  onChange={(e) => handleWeightChange(key, parseInt(e.target.value) / 100)}
                  className="flex-1 h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-gray-600 w-10 text-right">
                  {Math.round(weights[key] * 100)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ranked Supplier Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-10">
                #
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Supplier
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                Unit Price
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                Lead Time
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                Quality
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                On-Time
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                Score
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                Recommendation
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rankings.map((r) => {
              const rec = RECOMMENDATION_STYLES[r.recommendation];
              const RecIcon = rec?.icon || Building2;
              return (
                <tr
                  key={r.supplierId}
                  className={r.rank === 1 ? 'bg-green-50/50' : ''}
                >
                  <td className="px-3 py-3 text-sm font-bold text-gray-400">
                    {r.rank}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        {r.supplierName}
                      </span>
                      {r.isPreferred && (
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      )}
                    </div>
                    {r.rating && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-2.5 h-2.5 ${
                              i < Math.round(r.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
                            }`}
                          />
                        ))}
                        <span className="text-xs text-gray-500 ml-1">{r.rating?.toFixed(1)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="font-semibold text-sm text-gray-900">
                      {formatCurrency(r.unitPrice, r.currency)}
                    </span>
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-green-500 h-1 rounded-full"
                        style={{ width: `${r.priceScore}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-sm text-gray-600">
                    {r.leadTimeDays != null ? `${r.leadTimeDays}d` : '-'}
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-1 mx-auto max-w-[60px]">
                      <div
                        className="bg-blue-500 h-1 rounded-full"
                        style={{ width: `${r.deliveryScore}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-sm text-gray-600">
                    {r.qualityScore ?? '-'}
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-1 mx-auto max-w-[60px]">
                      <div
                        className="bg-purple-500 h-1 rounded-full"
                        style={{ width: `${r.qualityScoreComputed}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-sm text-gray-600">
                    {r.onTimeDeliveryRate != null ? `${Math.round(r.onTimeDeliveryRate)}%` : '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-bold text-sm text-gray-900">
                      {r.overallScore}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {r.recommendation !== 'standard' && rec && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${rec.color}`}>
                        <RecIcon className="w-3 h-3" />
                        {rec.label}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SupplierCostAnalysis;
