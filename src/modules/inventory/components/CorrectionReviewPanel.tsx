/**
 * CorrectionReviewPanel Component
 * Displays auto-detected and AI-suggested corrections for inventory items.
 * Users can accept/reject individual corrections, then apply them in batch.
 */

import { useMemo } from 'react';
import {
  Wrench,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  X,
  ArrowRight,
  CheckCheck,
  XCircle,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import type {
  CorrectionReviewItem,
  ApplyCorrectionsResponse,
} from '../types/inventoryAI';

interface CorrectionReviewPanelProps {
  corrections: CorrectionReviewItem[];
  applying: boolean;
  error: string | null;
  result: ApplyCorrectionsResponse | null;
  onSetStatus: (correctionId: string, status: CorrectionReviewItem['status']) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onApply: () => Promise<void>;
  onViewItem?: (itemId: string) => void;
}

const CORRECTION_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  'field-update': { label: 'Field Update', color: 'bg-blue-100 text-blue-700' },
  recategorize: { label: 'Recategorise', color: 'bg-orange-100 text-orange-700' },
  'fix-sku': { label: 'Fix SKU', color: 'bg-red-100 text-red-700' },
  'fix-unit': { label: 'Fix Unit', color: 'bg-amber-100 text-amber-700' },
  'fill-missing': { label: 'Fill Missing', color: 'bg-gray-100 text-gray-700' },
  'standardize-name': { label: 'Standardise Name', color: 'bg-indigo-100 text-indigo-700' },
  'archive-stale': { label: 'Archive Stale', color: 'bg-gray-100 text-gray-600' },
  'extract-brand': { label: 'Extract Brand', color: 'bg-teal-100 text-teal-700' },
  'populate-structured-name': { label: 'Structured Name', color: 'bg-cyan-100 text-cyan-700' },
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  deterministic: { label: 'Auto-detected', color: 'bg-green-100 text-green-700' },
  ai: { label: 'AI Suggested', color: 'bg-purple-100 text-purple-700' },
};

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'critical':
      return <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />;
    default:
      return <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />;
  }
}

function formatValue(value: string | number | string[] | null | undefined): string {
  if (value === null || value === undefined) return '(empty)';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '(empty)';
  return String(value);
}

export function CorrectionReviewPanel({
  corrections,
  applying,
  error,
  result,
  onSetStatus,
  onAcceptAll,
  onRejectAll,
  onApply,
  onViewItem: _onViewItem,
}: CorrectionReviewPanelProps) {
  const stats = useMemo(() => {
    const accepted = corrections.filter(c => c.status === 'accepted').length;
    const rejected = corrections.filter(c => c.status === 'rejected').length;
    const pending = corrections.filter(c => c.status === 'pending').length;
    const applied = corrections.filter(c => c.status === 'applied').length;
    return { accepted, rejected, pending, applied, total: corrections.length };
  }, [corrections]);

  // Group corrections by correctionGroup for visual grouping
  const groupedCorrections = useMemo(() => {
    const groups: Array<{ groupId: string | null; items: CorrectionReviewItem[] }> = [];
    const seen = new Set<string>();

    for (const c of corrections) {
      if (c.correctionGroup && !seen.has(c.correctionGroup)) {
        seen.add(c.correctionGroup);
        groups.push({
          groupId: c.correctionGroup,
          items: corrections.filter(x => x.correctionGroup === c.correctionGroup),
        });
      } else if (!c.correctionGroup) {
        groups.push({ groupId: null, items: [c] });
      }
    }
    return groups;
  }, [corrections]);

  if (corrections.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
        <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No corrections needed</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-700">
            Corrections ({stats.total})
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            {stats.accepted > 0 && (
              <span className="text-green-600">{stats.accepted} accepted</span>
            )}
            {stats.rejected > 0 && (
              <span className="text-red-600">{stats.rejected} rejected</span>
            )}
            {stats.pending > 0 && (
              <span>{stats.pending} pending</span>
            )}
            {stats.applied > 0 && (
              <span className="text-blue-600">{stats.applied} applied</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onAcceptAll}
            disabled={applying}
          >
            <CheckCheck className="w-3 h-3 mr-1" />
            Accept All
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onRejectAll}
            disabled={applying}
          >
            <XCircle className="w-3 h-3 mr-1" />
            Reject All
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-700">
            Applied {result.appliedCount} correction{result.appliedCount !== 1 ? 's' : ''} successfully.
            {result.failedCount > 0 && (
              <span className="text-red-600 ml-1">
                {result.failedCount} failed.
              </span>
            )}
          </p>
        </div>
      )}

      {/* Corrections list */}
      <ScrollArea className="max-h-[500px]">
        <div className="space-y-2">
          {groupedCorrections.map(group => {
            const isGrouped = group.groupId !== null && group.items.length > 1;
            const groupItems = group.items;

            return (
              <div key={group.groupId || groupItems[0].id}>
                {isGrouped && (
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <div className="h-px flex-1 bg-teal-200" />
                    <span className="text-xs font-medium text-teal-600">
                      Grouped: {groupItems[0].itemName}
                    </span>
                    <div className="h-px flex-1 bg-teal-200" />
                  </div>
                )}
                <div className={isGrouped ? 'space-y-1 border-l-2 border-teal-300 pl-2' : 'space-y-2'}>
                  {groupItems.map(correction => {
                    const typeStyle = CORRECTION_TYPE_LABELS[correction.type] || {
                      label: correction.type,
                      color: 'bg-gray-100 text-gray-700',
                    };
                    const sourceStyle = SOURCE_LABELS[correction.source] || {
                      label: correction.source,
                      color: 'bg-gray-100 text-gray-700',
                    };

                    const isApplied = correction.status === 'applied';
                    const isRejected = correction.status === 'rejected';

                    return (
                      <div
                        key={correction.id}
                        className={`border rounded-lg p-3 bg-white transition-opacity ${
                          isApplied ? 'opacity-60' : isRejected ? 'opacity-40' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            {getSeverityIcon(correction.severity)}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-900 truncate">
                                  {correction.itemName}
                                </span>
                                {correction.itemSku && (
                                  <span className="text-xs text-gray-400">{correction.itemSku}</span>
                                )}
                                <Badge variant="outline" className={`text-xs ${typeStyle.color}`}>
                                  {typeStyle.label}
                                </Badge>
                                <Badge variant="outline" className={`text-xs ${sourceStyle.color}`}>
                                  {sourceStyle.label}
                                </Badge>
                              </div>

                              <p className="text-sm text-gray-600 mt-0.5">{correction.description}</p>

                              {/* Field change preview */}
                              <div className="flex items-center gap-2 mt-1.5 text-xs">
                                <span className="text-gray-400 font-medium">{correction.field}:</span>
                                <span className="text-gray-500 line-through">
                                  {formatValue(correction.currentValue)}
                                </span>
                                <ArrowRight className="w-3 h-3 text-gray-300" />
                                <span className="text-gray-900 font-medium">
                                  {formatValue(correction.suggestedValue)}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    correction.confidence >= 0.85
                                      ? 'bg-green-100 text-green-700'
                                      : correction.confidence >= 0.6
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {Math.round(correction.confidence * 100)}%
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Accept/reject buttons */}
                          {!isApplied && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() =>
                                  onSetStatus(
                                    correction.id,
                                    correction.status === 'accepted' ? 'pending' : 'accepted'
                                  )
                                }
                                disabled={applying}
                                className={`p-1.5 rounded-md transition-colors ${
                                  correction.status === 'accepted'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-400 hover:text-green-600'
                                }`}
                                title="Accept"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  onSetStatus(
                                    correction.id,
                                    correction.status === 'rejected' ? 'pending' : 'rejected'
                                  )
                                }
                                disabled={applying}
                                className={`p-1.5 rounded-md transition-colors ${
                                  correction.status === 'rejected'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-400 hover:text-red-600'
                                }`}
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          {isApplied && (
                            <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                              Applied
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Apply button */}
      {stats.accepted > 0 && stats.applied < stats.total && (
        <div className="flex justify-end border-t pt-3">
          <Button onClick={onApply} disabled={applying || stats.accepted === 0}>
            {applying ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Applying {stats.accepted} correction{stats.accepted !== 1 ? 's' : ''}...
              </>
            ) : (
              <>
                <Wrench className="w-4 h-4 mr-1" />
                Apply {stats.accepted} Correction{stats.accepted !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
