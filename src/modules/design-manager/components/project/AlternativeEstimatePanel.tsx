/**
 * Alternative Estimate Panel
 * Shows side-by-side comparison of tier-based estimates generated from
 * material alternative mappings. Rendered below the standard estimate.
 */

import { useState } from 'react';
import {
  Layers,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Minus,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileText,
} from 'lucide-react';
import type { ConsolidatedEstimate } from '../../types/estimate';
import type { AlternativeEstimateSet, AlternativeEstimate } from '../../types/estimate';
import type { MaterialQualityTier } from '@/shared/types';
import { MATERIAL_QUALITY_TIER_LABELS } from '@/shared/types';
import { generateAlternativeEstimates } from '../../services/alternativeEstimateService';
import type { EstimateConfig } from '../../types/estimate';
import { DEFAULT_ESTIMATE_CONFIG } from '../../types/estimate';

// ============================================
// Types
// ============================================

interface AlternativeEstimatePanelProps {
  projectId: string;
  standardEstimate: ConsolidatedEstimate;
  alternativeEstimates?: AlternativeEstimateSet;
  userId: string;
  config?: EstimateConfig;
  onEstimatesGenerated: () => void;
  onCreateQuoteVariants?: (alternative: AlternativeEstimate) => void;
}

const TIER_COLORS: Record<MaterialQualityTier, { bg: string; text: string; border: string; accent: string }> = {
  economy: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200', accent: 'bg-green-100' },
  standard: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', accent: 'bg-blue-100' },
  premium: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200', accent: 'bg-purple-100' },
  luxury: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', accent: 'bg-amber-100' },
};

// ============================================
// Component
// ============================================

export function AlternativeEstimatePanel({
  projectId,
  standardEstimate,
  alternativeEstimates,
  userId,
  config = DEFAULT_ESTIMATE_CONFIG,
  onEstimatesGenerated,
  onCreateQuoteVariants,
}: AlternativeEstimatePanelProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  const alternatives = alternativeEstimates?.alternatives || [];
  const hasAlternatives = alternatives.length > 0;
  const isStale = alternativeEstimates?.isStale;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generateAlternativeEstimates(projectId, standardEstimate, userId, config);
      onEstimatesGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate alternative estimates');
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return `${Math.round(amount).toLocaleString()} ${standardEstimate.currency || 'UGX'}`;
  };

  const getDeltaDisplay = (alt: AlternativeEstimate) => {
    if (alt.deltaFromStandard === 0) {
      return { icon: <Minus className="w-4 h-4 text-gray-400" />, label: 'Same', color: 'text-gray-500' };
    }
    if (alt.deltaFromStandard < 0) {
      return {
        icon: <TrendingDown className="w-4 h-4 text-green-600" />,
        label: `${alt.deltaPercent}% (${formatCurrency(alt.deltaFromStandard)})`,
        color: 'text-green-700',
      };
    }
    return {
      icon: <TrendingUp className="w-4 h-4 text-red-600" />,
      label: `+${alt.deltaPercent}% (+${formatCurrency(alt.deltaFromStandard)})`,
      color: 'text-red-700',
    };
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-purple-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Alternative Estimates</h3>
              <p className="text-sm text-gray-500">
                Tier-based estimates using real material cost substitutions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isStale && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                <AlertCircle className="w-3 h-3" />
                Outdated
              </span>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {hasAlternatives ? 'Regenerate' : 'Generate Alternatives'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-2 text-sm text-red-800">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        </div>
      )}

      {/* Content */}
      {!hasAlternatives && !generating && (
        <div className="px-4 py-8 text-center text-gray-500">
          <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">
            No alternative estimates yet. Map material alternatives in the Material Palette,
            then click "Generate Alternatives" to create tier-based estimates.
          </p>
        </div>
      )}

      {hasAlternatives && (
        <>
          {/* Comparison Cards */}
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Standard Estimate Card */}
              <div className={`p-4 rounded-lg border-2 ${TIER_COLORS.standard.border} ${TIER_COLORS.standard.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${TIER_COLORS.standard.text}`}>
                    {MATERIAL_QUALITY_TIER_LABELS.standard}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                    <CheckCircle className="w-3 h-3" />
                    Current
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {formatCurrency(standardEstimate.total)}
                </div>
                <div className="text-xs text-gray-500">
                  {standardEstimate.lineItems.length} line items | Tax: {formatCurrency(standardEstimate.taxAmount)}
                </div>
              </div>

              {/* Alternative Estimate Cards */}
              {alternatives.map((alt) => {
                const colors = TIER_COLORS[alt.qualityTier] || TIER_COLORS.standard;
                const delta = getDeltaDisplay(alt);
                const isExpanded = expandedTier === alt.id;

                return (
                  <div
                    key={alt.id}
                    className={`p-4 rounded-lg border-2 ${colors.border} ${colors.bg}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-semibold ${colors.text}`}>
                        {alt.tierLabel}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${delta.color}`}>
                        {delta.icon}
                        {delta.label}
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {formatCurrency(alt.total)}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      {alt.substitutions.length} material{alt.substitutions.length !== 1 ? 's' : ''} substituted
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => setExpandedTier(isExpanded ? null : alt.id)}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        {isExpanded ? 'Hide' : 'Show'} substitutions
                      </button>
                      {onCreateQuoteVariants && (
                        <button
                          onClick={() => onCreateQuoteVariants(alt)}
                          className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          Create Quote
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expanded Substitution Details */}
          {expandedTier && (
            <div className="px-4 pb-4">
              {alternatives
                .filter(alt => alt.id === expandedTier)
                .map(alt => (
                  <div key={alt.id} className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                      {alt.tierLabel} Material Substitutions
                    </h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 uppercase">
                          <th className="pb-2">Original Material</th>
                          <th className="pb-2">Alternative</th>
                          <th className="pb-2 text-right">Original Cost</th>
                          <th className="pb-2 text-right">New Cost</th>
                          <th className="pb-2 text-right">Delta</th>
                          <th className="pb-2 text-right">Items Affected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {alt.substitutions.map((sub, idx) => (
                          <tr key={idx}>
                            <td className="py-2 text-gray-900">{sub.originalMaterialName}</td>
                            <td className="py-2 text-gray-700">{sub.alternativeMaterialName}</td>
                            <td className="py-2 text-right text-gray-600">
                              {sub.originalUnitCost.toLocaleString()}
                            </td>
                            <td className="py-2 text-right text-gray-900 font-medium">
                              {sub.alternativeUnitCost.toLocaleString()}
                            </td>
                            <td className={`py-2 text-right font-medium ${
                              sub.costDelta < 0 ? 'text-green-700' :
                              sub.costDelta > 0 ? 'text-red-700' : 'text-gray-500'
                            }`}>
                              {sub.costDelta > 0 ? '+' : ''}{sub.costDelta.toLocaleString()}
                            </td>
                            <td className="py-2 text-right text-gray-500">
                              {sub.affectedDesignItemIds.length}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
            </div>
          )}

          {/* Actions placeholder — individual "Create Quote" buttons are on each tier card */}
        </>
      )}
    </div>
  );
}
