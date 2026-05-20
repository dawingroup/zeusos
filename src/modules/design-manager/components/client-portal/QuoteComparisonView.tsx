/**
 * Quote Comparison View
 * Internal team view for comparing variant quotes side-by-side.
 * Shows tier-based quotes in a comparison layout with material substitution summaries.
 */

import { useState, useEffect } from 'react';
import {
  Layers,
  Star,
  Send,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { ClientQuote, QuoteComparisonGroup } from '../../types/clientPortal';
import type { MaterialQualityTier } from '@/shared/types';
import { MATERIAL_QUALITY_TIER_LABELS } from '@/shared/types';
import { getQuote, sendQuoteToClient } from '../../services/clientPortalService';
import {
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';

// ============================================
// Types
// ============================================

interface QuoteComparisonViewProps {
  comparisonGroup: QuoteComparisonGroup;
  onGroupUpdated?: () => void;
  className?: string;
}

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  economy: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-300' },
  standard: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-300' },
  premium: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-300' },
  luxury: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
};

// ============================================
// Component
// ============================================

export function QuoteComparisonView({
  comparisonGroup,
  onGroupUpdated,
  className = '',
}: QuoteComparisonViewProps) {
  const [quotes, setQuotes] = useState<ClientQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [settingRecommended, setSettingRecommended] = useState<string | null>(null);

  // Load all quotes in the comparison group
  useEffect(() => {
    async function loadQuotes() {
      setLoading(true);
      try {
        const loaded = await Promise.all(
          comparisonGroup.quoteIds.map(id => getQuote(id))
        );
        // Filter out nulls and sort by tier order
        const tierOrder: Record<string, number> = { economy: 0, standard: 1, premium: 2, luxury: 3 };
        const validQuotes = loaded.filter(Boolean) as ClientQuote[];
        validQuotes.sort((a, b) => {
          const aOrder = tierOrder[a.qualityTier || 'standard'] ?? 99;
          const bOrder = tierOrder[b.qualityTier || 'standard'] ?? 99;
          return aOrder - bOrder;
        });
        setQuotes(validQuotes);
      } catch (err) {
        console.error('Failed to load comparison quotes:', err);
      } finally {
        setLoading(false);
      }
    }
    loadQuotes();
  }, [comparisonGroup.quoteIds]);

  const standardQuote = quotes.find(q => q.qualityTier === 'standard');
  const standardTotal = standardQuote?.total || 0;

  const formatCurrency = (amount: number, currency: string = 'UGX') =>
    `${Math.round(amount).toLocaleString()} ${currency}`;

  const getDelta = (total: number) => {
    if (!standardTotal || total === standardTotal) {
      return { icon: <Minus className="w-3 h-3 text-gray-400" />, label: 'Base', color: 'text-gray-500' };
    }
    const delta = total - standardTotal;
    const percent = Math.round((delta / standardTotal) * 1000) / 10;
    if (delta < 0) {
      return {
        icon: <TrendingDown className="w-3 h-3 text-green-600" />,
        label: `${percent}%`,
        color: 'text-green-700',
      };
    }
    return {
      icon: <TrendingUp className="w-3 h-3 text-red-600" />,
      label: `+${percent}%`,
      color: 'text-red-700',
    };
  };

  const handleSetRecommended = async (quoteId: string) => {
    setSettingRecommended(quoteId);
    try {
      // Update the group
      await updateDoc(doc(db, 'quoteComparisonGroups', comparisonGroup.id), {
        recommendedQuoteId: quoteId,
      });

      // Update isRecommendedVariant on all quotes
      for (const q of quotes) {
        await updateDoc(doc(db, 'clientQuotes', q.id), {
          isRecommendedVariant: q.id === quoteId,
        });
      }

      onGroupUpdated?.();
    } catch (err) {
      console.error('Failed to set recommended quote:', err);
    } finally {
      setSettingRecommended(null);
    }
  };

  const handleSendQuote = async (quoteId: string) => {
    setSending(quoteId);
    try {
      await sendQuoteToClient(quoteId, '');
      onGroupUpdated?.();
    } catch (err) {
      console.error('Failed to send quote:', err);
    } finally {
      setSending(null);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading quote variants...</span>
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        No quotes found in this comparison group.
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Quote Comparison</h3>
              <p className="text-sm text-gray-500">
                {quotes.length} variant{quotes.length !== 1 ? 's' : ''} |{' '}
                Status: <span className="font-medium">{comparisonGroup.status}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="p-4">
        <div className={`grid gap-4 ${
          quotes.length <= 2 ? 'grid-cols-1 md:grid-cols-2' :
          quotes.length <= 3 ? 'grid-cols-1 md:grid-cols-3' :
          'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
        }`}>
          {quotes.map((quote) => {
            const tier = (quote.qualityTier || 'standard') as string;
            const colors = TIER_COLORS[tier] || TIER_COLORS.standard;
            const isRecommended = quote.id === comparisonGroup.recommendedQuoteId;
            const isSelected = quote.id === comparisonGroup.selectedQuoteId;
            const delta = getDelta(quote.total);

            return (
              <div
                key={quote.id}
                className={`rounded-lg border-2 overflow-hidden ${
                  isRecommended ? colors.border : 'border-gray-200'
                } ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}
              >
                {/* Tier Header */}
                <div className={`px-4 py-2 ${colors.bg} flex items-center justify-between`}>
                  <span className={`text-sm font-semibold ${colors.text}`}>
                    {MATERIAL_QUALITY_TIER_LABELS[tier as MaterialQualityTier] || tier}
                  </span>
                  <div className="flex items-center gap-1">
                    {isRecommended && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        <Star className="w-3 h-3" />
                        Recommended
                      </span>
                    )}
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Selected
                      </span>
                    )}
                  </div>
                </div>

                {/* Quote Details */}
                <div className="p-4">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {formatCurrency(quote.total, quote.currency)}
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium mb-3 ${delta.color}`}>
                    {delta.icon}
                    {delta.label}
                  </div>

                  <div className="space-y-1 text-sm text-gray-600">
                    <div>Quote: {quote.quoteNumber}</div>
                    <div>Items: {quote.lineItems.length}</div>
                    <div>Status: <span className="font-medium capitalize">{quote.status}</span></div>
                  </div>

                  {/* Material Substitutions */}
                  {quote.materialSubstitutions && quote.materialSubstitutions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        Material Changes
                      </div>
                      <ul className="space-y-1">
                        {quote.materialSubstitutions.slice(0, 3).map((sub, idx) => (
                          <li key={idx} className="text-xs text-gray-600">
                            {sub.originalMaterial} → {sub.alternativeMaterial}
                          </li>
                        ))}
                        {quote.materialSubstitutions.length > 3 && (
                          <li className="text-xs text-gray-400 italic">
                            +{quote.materialSubstitutions.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 flex gap-2">
                    {!isRecommended && (
                      <button
                        onClick={() => handleSetRecommended(quote.id)}
                        disabled={!!settingRecommended}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 rounded hover:bg-yellow-100 disabled:opacity-50"
                      >
                        {settingRecommended === quote.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Star className="w-3 h-3" />
                        )}
                        Recommend
                      </button>
                    )}
                    {quote.status === 'draft' && (
                      <button
                        onClick={() => handleSendQuote(quote.id)}
                        disabled={!!sending}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {sending === quote.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        Send
                      </button>
                    )}
                    {quote.accessUrl && (
                      <a
                        href={quote.accessUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-2 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="px-4 pb-4">
        <div className="bg-gray-50 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                <th className="px-4 py-3">Metric</th>
                {quotes.map(q => (
                  <th key={q.id} className="px-4 py-3">
                    {MATERIAL_QUALITY_TIER_LABELS[(q.qualityTier || 'standard') as MaterialQualityTier] || q.qualityTier}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 font-medium text-gray-700">Subtotal</td>
                {quotes.map(q => (
                  <td key={q.id} className="px-4 py-2 text-gray-900">
                    {formatCurrency(q.subtotal, q.currency)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-gray-700">Tax</td>
                {quotes.map(q => (
                  <td key={q.id} className="px-4 py-2 text-gray-600">
                    {formatCurrency(q.taxAmount, q.currency)}
                  </td>
                ))}
              </tr>
              <tr className="font-semibold">
                <td className="px-4 py-2 text-gray-900">Total</td>
                {quotes.map(q => (
                  <td key={q.id} className="px-4 py-2 text-gray-900">
                    {formatCurrency(q.total, q.currency)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-gray-700">vs Standard</td>
                {quotes.map(q => {
                  const d = getDelta(q.total);
                  return (
                    <td key={q.id} className={`px-4 py-2 font-medium ${d.color}`}>
                      <span className="inline-flex items-center gap-1">
                        {d.icon} {d.label}
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
