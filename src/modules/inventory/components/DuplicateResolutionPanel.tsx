/**
 * DuplicateResolutionPanel Component
 * Displays detected duplicate groups and allows the user to review,
 * select a merge strategy, and resolve duplicates.
 */

import { useState, useCallback } from 'react';
import {
  GitMerge,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Users,
  Star,
  Archive,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import type {
  DuplicateGroup,
  DuplicateMergeStrategy,
  DuplicateMergeRequest,
  DuplicateMergeResult,
} from '../types/inventoryAI';

interface DuplicateResolutionPanelProps {
  groups: DuplicateGroup[];
  merging: boolean;
  mergeError: string | null;
  mergeResult: DuplicateMergeResult | null;
  onMerge: (request: DuplicateMergeRequest) => Promise<void>;
  onViewItem?: (itemId: string) => void;
}

const DUPLICATE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  'exact-name': { label: 'Exact Name', color: 'bg-red-100 text-red-700' },
  'fuzzy-name': { label: 'Similar Name', color: 'bg-orange-100 text-orange-700' },
  'same-mpn': { label: 'Same MPN', color: 'bg-purple-100 text-purple-700' },
  'same-specs': { label: 'Same Specs', color: 'bg-blue-100 text-blue-700' },
  'sku-variant': { label: 'SKU Variant', color: 'bg-gray-100 text-gray-700' },
};

const RESOLUTION_LABELS: Record<string, string> = {
  merge: 'Merge into primary',
  'create-family': 'Create family group',
  alias: 'Add as aliases',
  review: 'Manual review needed',
};

const STRATEGY_OPTIONS: Array<{ value: DuplicateMergeStrategy; label: string; description: string }> = [
  {
    value: 'keep-primary',
    label: 'Keep Primary Only',
    description: 'Archive duplicates, keep primary unchanged',
  },
  {
    value: 'merge-best-fields',
    label: 'Merge Best Fields',
    description: 'Combine best data from all items into primary',
  },
  {
    value: 'create-parent',
    label: 'Create Parent',
    description: 'Create a family parent from the group',
  },
];

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.85) return 'bg-green-100 text-green-700';
  if (confidence >= 0.6) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

export function DuplicateResolutionPanel({
  groups,
  merging,
  mergeError,
  mergeResult,
  onMerge,
  onViewItem,
}: DuplicateResolutionPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedStrategies, setSelectedStrategies] = useState<Record<string, DuplicateMergeStrategy>>({});
  const [archiveMode, setArchiveMode] = useState<Record<string, boolean>>({});
  const [selectedPrimary, setSelectedPrimary] = useState<Record<string, string>>({});

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const handleMerge = useCallback(
    async (group: DuplicateGroup) => {
      const strategy = selectedStrategies[group.id] || 'merge-best-fields';
      const primaryId = selectedPrimary[group.id] || group.primaryItemId;
      const archive = archiveMode[group.id] !== false; // default true

      const itemsToMerge = group.candidates
        .filter(c => c.itemId !== primaryId)
        .map(c => c.itemId);

      await onMerge({
        groupId: group.id,
        primaryItemId: primaryId,
        itemsToMerge,
        strategy,
        archiveDuplicates: archive,
      });
    },
    [selectedStrategies, selectedPrimary, archiveMode, onMerge]
  );

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
        <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No duplicate groups detected</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-500" />
          <h3 className="text-sm font-semibold text-gray-700">
            Duplicate Groups ({groups.length})
          </h3>
        </div>
      </div>

      {mergeError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{mergeError}</p>
        </div>
      )}

      {mergeResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700">{mergeResult.aiNotes}</p>
        </div>
      )}

      <ScrollArea className="max-h-[500px]">
        <div className="space-y-3">
          {groups.map(group => {
            const isExpanded = expandedGroups.has(group.id);
            const typeStyle = DUPLICATE_TYPE_LABELS[group.duplicateType] || {
              label: group.duplicateType,
              color: 'bg-gray-100 text-gray-700',
            };
            const currentPrimary = selectedPrimary[group.id] || group.primaryItemId;
            const currentStrategy = selectedStrategies[group.id] || 'merge-best-fields';
            const currentArchive = archiveMode[group.id] !== false;

            return (
              <div key={group.id} className="border rounded-lg bg-white">
                {/* Group header */}
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                  onClick={() => toggleGroup(group.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {group.summary}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <Badge variant="outline" className={`text-xs ${typeStyle.color}`}>
                      {typeStyle.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getConfidenceColor(group.confidence)}`}
                    >
                      {Math.round(group.confidence * 100)}%
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {group.candidates.length} items
                    </span>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t px-3 pb-3 space-y-3">
                    {/* Candidates */}
                    <div className="space-y-1 mt-3">
                      {group.candidates.map(candidate => {
                        const isPrimary = candidate.itemId === currentPrimary;
                        return (
                          <div
                            key={candidate.itemId}
                            className={`flex items-center justify-between p-2 rounded-md ${
                              isPrimary ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isPrimary && (
                                <Star className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                              )}
                              <div className="min-w-0">
                                <span className="text-sm font-medium text-gray-900 truncate block">
                                  {candidate.itemName}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {candidate.itemSku || 'No SKU'} | {candidate.category}
                                  {candidate.subcategory ? ` / ${candidate.subcategory}` : ''}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!isPrimary && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() =>
                                    setSelectedPrimary(prev => ({
                                      ...prev,
                                      [group.id]: candidate.itemId,
                                    }))
                                  }
                                >
                                  <Star className="w-3 h-3 mr-1" />
                                  Set Primary
                                </Button>
                              )}
                              {onViewItem && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => onViewItem(candidate.itemId)}
                                >
                                  View
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-xs text-gray-500 italic">
                      Suggested: {RESOLUTION_LABELS[group.suggestedResolution] || group.suggestedResolution}
                    </p>

                    {/* Strategy selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">Merge Strategy</label>
                      <div className="grid grid-cols-3 gap-2">
                        {STRATEGY_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() =>
                              setSelectedStrategies(prev => ({
                                ...prev,
                                [group.id]: opt.value,
                              }))
                            }
                            className={`text-left p-2 rounded-md border text-xs transition-colors ${
                              currentStrategy === opt.value
                                ? 'border-purple-300 bg-purple-50 text-purple-700'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            <span className="font-medium block">{opt.label}</span>
                            <span className="text-gray-400">{opt.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Archive toggle */}
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentArchive}
                        onChange={() =>
                          setArchiveMode(prev => ({
                            ...prev,
                            [group.id]: !currentArchive,
                          }))
                        }
                        className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <Archive className="w-3 h-3" />
                      Archive duplicates (soft-delete) instead of permanently removing
                    </label>

                    {/* Merge button */}
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleMerge(group)}
                        disabled={merging}
                      >
                        {merging ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Merging...
                          </>
                        ) : (
                          <>
                            <GitMerge className="w-4 h-4 mr-1" />
                            Merge Group
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
