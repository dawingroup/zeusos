/**
 * AIEnhancementPanel Component
 * Dialog for reviewing Claude AI suggestions for a single inventory item.
 * Shows current vs suggested values with accept/reject toggles per field.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { useInventoryAI } from '../hooks/useInventoryAI';
import type { InventoryItem, InventoryItemFormData } from '../types/inventory';
import type { EnhancementSuggestions, FieldSuggestion, DataQualityIssue } from '../types/inventoryAI';

interface AIEnhancementPanelProps {
  open: boolean;
  item: InventoryItem;
  existingItems?: Array<{ name: string; sku: string; category: string; subcategory?: string }>;
  onClose: () => void;
  onApply: (updates: Partial<InventoryItemFormData>) => Promise<void>;
}

type EnhancementStep = 'analyzing' | 'review' | 'applying' | 'done' | 'error';

// Fields we can suggest changes for
const SUGGESTION_FIELDS: Array<{
  key: keyof EnhancementSuggestions;
  label: string;
  isArray?: boolean;
}> = [
  { key: 'name', label: 'Name' },
  { key: 'displayName', label: 'Display Name' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'subcategory', label: 'Subcategory' },
  { key: 'classification', label: 'Classification' },
  { key: 'tags', label: 'Tags', isArray: true },
  { key: 'aliases', label: 'Aliases', isArray: true },
];

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-100 text-green-700 border-green-200';
  if (confidence >= 0.5) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

function getSeverityStyles(severity: DataQualityIssue['severity']) {
  switch (severity) {
    case 'critical':
      return { bg: 'bg-red-50 border-red-200', icon: AlertTriangle, iconColor: 'text-red-500', label: 'Critical' };
    case 'warning':
      return { bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle, iconColor: 'text-amber-500', label: 'Warning' };
    case 'info':
      return { bg: 'bg-blue-50 border-blue-200', icon: Info, iconColor: 'text-blue-500', label: 'Info' };
  }
}

function formatValue(value: string | string[] | undefined | null): string {
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '(none)';
  return value || '(not set)';
}

function hasChanged(suggestion: FieldSuggestion<string | string[]>): boolean {
  const current = suggestion.current;
  const suggested = suggestion.suggested;
  if (Array.isArray(current) && Array.isArray(suggested)) {
    if (current.length !== suggested.length) return true;
    return current.some((v, i) => v !== suggested[i]);
  }
  return current !== suggested;
}

export function AIEnhancementPanel({
  open,
  item,
  existingItems,
  onClose,
  onApply,
}: AIEnhancementPanelProps) {
  const { enhancement, enhancing, enhanceError, runEnhancement, clearEnhancement } =
    useInventoryAI();

  const [step, setStep] = useState<EnhancementStep>('analyzing');
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [applyError, setApplyError] = useState<string | null>(null);

  // Run enhancement on mount
  useEffect(() => {
    if (open && item) {
      setStep('analyzing');
      setAccepted({});
      setApplyError(null);
      runEnhancement(item, existingItems);
    }
    return () => {
      clearEnhancement();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  // Update step based on hook state
  useEffect(() => {
    if (enhancing) {
      setStep('analyzing');
    } else if (enhanceError) {
      setStep('error');
    } else if (enhancement) {
      setStep('review');
      // Pre-accept suggestions with high confidence that actually changed
      const initial: Record<string, boolean> = {};
      for (const field of SUGGESTION_FIELDS) {
        const suggestion = enhancement.suggestions[field.key];
        if (suggestion && hasChanged(suggestion as FieldSuggestion<string | string[]>)) {
          initial[field.key] = suggestion.confidence >= 0.7;
        }
      }
      setAccepted(initial);
    }
  }, [enhancing, enhanceError, enhancement]);

  const handleToggle = useCallback((fieldKey: string) => {
    setAccepted(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  }, []);

  const handleRetry = useCallback(() => {
    setApplyError(null);
    runEnhancement(item, existingItems);
  }, [item, existingItems, runEnhancement]);

  const handleApply = useCallback(async () => {
    if (!enhancement) return;

    setStep('applying');
    setApplyError(null);

    try {
      const updates: Partial<InventoryItemFormData> = {};
      const suggestions = enhancement.suggestions;

      if (accepted.name && hasChanged(suggestions.name as FieldSuggestion<string | string[]>)) {
        updates.name = suggestions.name.suggested as string;
      }
      if (accepted.displayName && hasChanged(suggestions.displayName as FieldSuggestion<string | string[]>)) {
        updates.displayName = suggestions.displayName.suggested as string;
      }
      if (accepted.description && hasChanged(suggestions.description as FieldSuggestion<string | string[]>)) {
        updates.description = suggestions.description.suggested as string;
      }
      if (accepted.category && hasChanged(suggestions.category as FieldSuggestion<string | string[]>)) {
        updates.category = suggestions.category.suggested;
      }
      if (accepted.subcategory && hasChanged(suggestions.subcategory as FieldSuggestion<string | string[]>)) {
        updates.subcategory = suggestions.subcategory.suggested as string;
      }
      if (accepted.classification && hasChanged(suggestions.classification as FieldSuggestion<string | string[]>)) {
        updates.classification = suggestions.classification.suggested as 'material' | 'product';
      }
      if (accepted.tags && hasChanged(suggestions.tags as FieldSuggestion<string | string[]>)) {
        updates.tags = suggestions.tags.suggested as string[];
      }
      if (accepted.aliases && hasChanged(suggestions.aliases as FieldSuggestion<string | string[]>)) {
        updates.aliases = suggestions.aliases.suggested as string[];
      }

      if (Object.keys(updates).length === 0) {
        setStep('review');
        return;
      }

      await onApply(updates);
      setStep('done');
    } catch (err) {
      setApplyError((err as Error).message || 'Failed to apply changes');
      setStep('review');
    }
  }, [enhancement, accepted, onApply]);

  const acceptedCount = Object.values(accepted).filter(Boolean).length;
  const changedCount = enhancement
    ? SUGGESTION_FIELDS.filter(f => {
        const s = enhancement.suggestions[f.key];
        return s && hasChanged(s as FieldSuggestion<string | string[]>);
      }).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl !flex !flex-col max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI Enhancement — {item.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          {/* Analyzing state */}
          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <p className="text-sm text-gray-500">
                Claude is analysing this item...
              </p>
            </div>
          )}

          {/* Error state */}
          {step === 'error' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <p className="text-sm text-red-600">{enhanceError}</p>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Retry
              </Button>
            </div>
          )}

          {/* Done state */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <p className="text-sm text-green-700 font-medium">
                Enhancements applied successfully
              </p>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          )}

          {/* Review state */}
          {(step === 'review' || step === 'applying') && enhancement && (
            <div className="space-y-6 pb-4">
              {/* Overall confidence */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Overall confidence:</span>
                  <Badge
                    variant="outline"
                    className={getConfidenceColor(enhancement.overallConfidence)}
                  >
                    {Math.round(enhancement.overallConfidence * 100)}% —{' '}
                    {getConfidenceLabel(enhancement.overallConfidence)}
                  </Badge>
                </div>
                <span className="text-xs text-gray-400">
                  {acceptedCount} of {changedCount} changes selected
                </span>
              </div>

              {/* Suggestions */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Suggested Improvements</h3>
                {SUGGESTION_FIELDS.map(field => {
                  const suggestion = enhancement.suggestions[field.key] as
                    | FieldSuggestion<string>
                    | FieldSuggestion<string[]>
                    | undefined;
                  if (!suggestion || !hasChanged(suggestion as FieldSuggestion<string | string[]>)) return null;

                  return (
                    <div
                      key={field.key}
                      className="border rounded-lg p-3 space-y-2 bg-white"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!accepted[field.key]}
                            onChange={() => handleToggle(field.key)}
                            disabled={step === 'applying'}
                            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm font-medium">{field.label}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}
                        >
                          {Math.round(suggestion.confidence * 100)}%
                        </Badge>
                      </div>

                      <div className="flex items-start gap-2 text-sm pl-6">
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-400 text-xs block">Current</span>
                          <span className="text-gray-600 break-words">
                            {formatValue(suggestion.current)}
                          </span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-300 mt-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-purple-400 text-xs block">Suggested</span>
                          <span className="text-gray-900 font-medium break-words">
                            {formatValue(suggestion.suggested)}
                          </span>
                        </div>
                      </div>

                      {suggestion.reason && (
                        <p className="text-xs text-gray-400 pl-6 italic">
                          {suggestion.reason}
                        </p>
                      )}
                    </div>
                  );
                })}

                {changedCount === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No improvements suggested — this item looks well-maintained.
                  </p>
                )}
              </div>

              {/* Data quality issues */}
              {enhancement.dataQualityIssues.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Data Quality Issues</h3>
                  {enhancement.dataQualityIssues.map((issue, idx) => {
                    const styles = getSeverityStyles(issue.severity);
                    const SeverityIcon = styles.icon;
                    return (
                      <div
                        key={idx}
                        className={`border rounded-lg p-3 flex gap-3 ${styles.bg}`}
                      >
                        <SeverityIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${styles.iconColor}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{issue.field}</span>
                            <Badge variant="outline" className="text-xs">
                              {styles.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5">{issue.message}</p>
                          {issue.suggestedFix && (
                            <p className="text-xs text-gray-500 mt-1">
                              Fix: {issue.suggestedFix}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* AI Notes */}
              {enhancement.aiNotes && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">AI Notes</h3>
                  <p className="text-sm text-gray-600">{enhancement.aiNotes}</p>
                </div>
              )}

              {/* Apply error */}
              {applyError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{applyError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — pinned at bottom */}
        {(step === 'review' || step === 'applying') && (
          <DialogFooter className="px-6 pb-6 pt-4 border-t flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={handleRetry} disabled={step === 'applying'}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Re-analyse
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={step === 'applying'}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={step === 'applying' || acceptedCount === 0}
              >
                {step === 'applying' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Apply {acceptedCount} Change{acceptedCount !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
