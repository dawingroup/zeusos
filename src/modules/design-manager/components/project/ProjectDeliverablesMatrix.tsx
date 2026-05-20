/**
 * ProjectDeliverablesMatrix
 * Project-level deliverables manager — mirrors item-level DeliverablesManager
 * but aggregated across all project items.
 *
 * Features:
 * - Requirements matrix: items × deliverable types
 * - Full deliverables list grouped by type, with item badges
 * - Upload files assigned to one or many items
 * - RAG impact preview per deliverable type
 * - Handles consolidated files (e.g. shop travellers from cutlist)
 */

import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  Minus,
  Upload,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Loader2,
  Link2,
  Zap,
  Clock,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/core/components/ui/tooltip';
import type { DesignItem, Deliverable, DeliverableType, DeliverableRequirementsProfile } from '../../types';
import { useProjectDeliverables } from '../../hooks/useProjectDeliverables';
import {
  DELIVERABLE_TYPES,
  DELIVERABLE_TYPE_LABELS,
  DELIVERABLE_RAG_MAP,
  AUTO_GENERATED_DELIVERABLE_TYPES,
} from '../../constants/deliverableConstants';
import { StageBadge } from '../design-item/StageBadge';
import { BulkFileUploadDialog } from './BulkFileUploadDialog';

// ============================================
// Types
// ============================================

interface ProjectDeliverablesMatrixProps {
  projectId: string;
  items: DesignItem[];
  userId: string;
  deliverableProfile?: DeliverableRequirementsProfile;
}

type CellStatus = 'approved' | 'in-progress' | 'missing';

type ViewMode = 'matrix' | 'list';

// Short labels for compact column headers
const SHORT_LABELS: Record<DeliverableType, string> = {
  'concept-sketch': 'Sketch',
  'mood-board': 'Mood',
  '3d-model': '3D',
  'rendering': 'Render',
  'shop-drawing': 'Shop',
  'cut-list': 'Cut',
  'bom': 'BOM',
  'assembly-instructions': 'Asm',
  'specification-sheet': 'Spec',
  'client-presentation': 'Pres',
  'handoff-bundle': 'Handoff',
  'other': 'Other',
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-700' },
  review: { label: 'In Review', bg: 'bg-amber-100', text: 'text-amber-800' },
  approved: { label: 'Approved', bg: 'bg-green-100', text: 'text-green-800' },
  superseded: { label: 'Superseded', bg: 'bg-red-100', text: 'text-red-700' },
};

// ============================================
// Helpers
// ============================================

const autoGenSet = new Set<string>(AUTO_GENERATED_DELIVERABLE_TYPES);

function isAutoGenType(type: DeliverableType): boolean {
  return autoGenSet.has(type);
}

function getCellStatus(deliverables: Deliverable[], type: DeliverableType): CellStatus {
  const matching = deliverables.filter(
    d => d.type === type || d.coversTypes?.includes(type)
  );
  if (matching.length === 0) return 'missing';
  if (matching.some(d => d.status === 'approved')) return 'approved';
  return 'in-progress';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ============================================
// Sub-components
// ============================================

/** Compact item badge */
function ItemBadge({ item }: { item: DesignItem }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-gray-100 text-gray-700 border border-gray-200">
      <span className="font-medium">{item.itemCode}</span>
      <span className="text-gray-400 hidden sm:inline">- {item.name}</span>
    </span>
  );
}

// ============================================
// Main Component
// ============================================

export function ProjectDeliverablesMatrix({
  projectId,
  items,
  userId,
  deliverableProfile,
}: ProjectDeliverablesMatrixProps) {
  const { deliverablesByItem, loading, refresh } = useProjectDeliverables(projectId, items);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadPreselection, setUploadPreselection] = useState<Set<string>>(new Set());
  const [defaultType, setDefaultType] = useState<DeliverableType | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [expandedTypes, setExpandedTypes] = useState<Set<DeliverableType>>(new Set());
  const [showLegend, setShowLegend] = useState(false);

  // Build item lookup
  const itemById = useMemo(() => {
    const map = new Map<string, DesignItem>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  // Compute visible deliverable types based on profile + existing deliverables
  const visibleTypes = useMemo(() => {
    if (!deliverableProfile?.requiredTypes?.length) return DELIVERABLE_TYPES;

    const requiredSet = new Set(deliverableProfile.requiredTypes);

    // Also include types that already have uploaded deliverables (don't hide existing work)
    const typesWithUploads = new Set<DeliverableType>();
    for (const deliverables of deliverablesByItem.values()) {
      for (const d of deliverables) {
        typesWithUploads.add(d.type as DeliverableType);
        if (d.coversTypes) d.coversTypes.forEach(t => typesWithUploads.add(t));
      }
    }

    return DELIVERABLE_TYPES.filter(dt =>
      requiredSet.has(dt.value) || typesWithUploads.has(dt.value)
    );
  }, [deliverableProfile, deliverablesByItem]);

  // Compute matrix data
  const matrixData = useMemo(() => {
    return items.map(item => {
      const deliverables = deliverablesByItem.get(item.id) || [];
      const typeStatuses: Record<DeliverableType, CellStatus> = {} as any;
      let coveredCount = 0;

      for (const dt of DELIVERABLE_TYPES) {
        const status = getCellStatus(deliverables, dt.value);
        typeStatuses[dt.value] = status;
        if (status !== 'missing') coveredCount++;
      }

      return {
        item,
        deliverables,
        typeStatuses,
        completionPct: Math.round((coveredCount / DELIVERABLE_TYPES.length) * 100),
      };
    });
  }, [items, deliverablesByItem]);

  // Column completion percentages (only visible types)
  const columnStats = useMemo(() => {
    const stats: Record<DeliverableType, { covered: number; total: number }> = {} as any;
    for (const dt of visibleTypes) {
      stats[dt.value] = { covered: 0, total: items.length };
    }
    for (const row of matrixData) {
      for (const dt of visibleTypes) {
        if (row.typeStatuses[dt.value] !== 'missing') {
          stats[dt.value].covered++;
        }
      }
    }
    return stats;
  }, [matrixData, items.length, visibleTypes]);

  // Overall stats (only visible types)
  const overallStats = useMemo(() => {
    let totalCells = 0;
    let coveredCells = 0;
    for (const row of matrixData) {
      for (const dt of visibleTypes) {
        totalCells++;
        if (row.typeStatuses[dt.value] !== 'missing') coveredCells++;
      }
    }
    return { total: totalCells, covered: coveredCells };
  }, [matrixData, visibleTypes]);

  // All deliverables grouped by type (for list view)
  const deliverablesByType = useMemo(() => {
    const grouped = new Map<DeliverableType, Array<Deliverable & { itemId: string }>>();

    for (const [itemId, deliverables] of deliverablesByItem.entries()) {
      for (const del of deliverables) {
        const type = del.type as DeliverableType;
        if (!grouped.has(type)) grouped.set(type, []);
        grouped.get(type)!.push({ ...del, itemId });
      }
    }

    return grouped;
  }, [deliverablesByItem]);

  // Unique files across items (grouped by storageUrl to detect shared files)
  const sharedFileGroups = useMemo(() => {
    const urlGroups = new Map<string, Array<{ deliverable: Deliverable; itemId: string }>>();

    for (const [itemId, deliverables] of deliverablesByItem.entries()) {
      for (const del of deliverables) {
        const key = del.storageUrl || del.id;
        if (!urlGroups.has(key)) urlGroups.set(key, []);
        urlGroups.get(key)!.push({ deliverable: del, itemId });
      }
    }

    return urlGroups;
  }, [deliverablesByItem]);

  // Total unique files count
  const totalFiles = sharedFileGroups.size;
  const totalDeliverableRecords = Array.from(deliverablesByItem.values()).reduce((sum, d) => sum + d.length, 0);

  const handleCellClick = (itemId: string, type: DeliverableType, status: CellStatus) => {
    if (status === 'missing') {
      setUploadPreselection(new Set([itemId]));
      setDefaultType(type);
      setShowUploadDialog(true);
    }
  };

  const handleUploadAll = () => {
    setUploadPreselection(new Set(items.map(i => i.id)));
    setDefaultType(undefined);
    setShowUploadDialog(true);
  };

  const handleUploadForType = (type: DeliverableType) => {
    setUploadPreselection(new Set(items.map(i => i.id)));
    setDefaultType(type);
    setShowUploadDialog(true);
  };

  const handleUploadComplete = () => {
    setShowUploadDialog(false);
    setUploadPreselection(new Set());
    setDefaultType(undefined);
    refresh();
  };

  const toggleType = (type: DeliverableType) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  if (items.length === 0) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        {/* Header Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                Files & Deliverables
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {loading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                  </span>
                ) : (
                  <>
                    {totalFiles} file{totalFiles !== 1 ? 's' : ''} uploaded
                    {totalDeliverableRecords > totalFiles && (
                      <span className="text-gray-400"> ({totalDeliverableRecords} assignments across {items.length} items)</span>
                    )}
                    {' '}&middot;{' '}
                    {overallStats.covered}/{overallStats.total} requirements covered ({overallStats.total > 0 ? Math.round((overallStats.covered / overallStats.total) * 100) : 0}%)
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('matrix')}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    viewMode === 'matrix' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  Matrix
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  Files
                </button>
              </div>
              <button
                onClick={handleUploadAll}
                className="flex items-center gap-2 px-4 py-2 bg-[#1d1d1f] text-white text-sm font-medium rounded-lg hover:bg-[#2d2d2f] transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload File
              </button>
            </div>
          </div>

          {/* Info banner about shared files */}
          <div className="px-6 pb-3">
            <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <Link2 className="w-3.5 h-3.5 inline mr-1 text-blue-500" />
              Files uploaded here are assigned as deliverables to each selected item. Consolidated files (e.g. shop travellers from cutlists) can be linked to all items they cover. Changes appear in each item's Files & Deliverables tab.
            </p>
          </div>
        </div>

        {/* Matrix View */}
        {viewMode === 'matrix' && !loading && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2.5 text-left font-medium text-gray-600 min-w-[200px]">
                      Item
                    </th>
                    {visibleTypes.map(dt => {
                      const ragAspects = DELIVERABLE_RAG_MAP[dt.value];
                      const colStat = columnStats[dt.value];
                      const pct = colStat?.total > 0 ? Math.round((colStat.covered / colStat.total) * 100) : 0;
                      const isAuto = isAutoGenType(dt.value);

                      return (
                        <th key={dt.value} className="px-1.5 py-2.5 text-center font-medium text-gray-600 min-w-[52px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-help">
                                <div className="text-[11px] leading-tight">{SHORT_LABELS[dt.value]}</div>
                                {isAuto && (
                                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                                    <Zap className="w-2.5 h-2.5 text-blue-500" />
                                    <span className="text-[9px] font-medium text-blue-600">Auto</span>
                                  </div>
                                )}
                                <div className={cn(
                                  'text-[10px]',
                                  !isAuto && 'mt-0.5',
                                  pct === 100 ? 'text-green-600' : pct > 0 ? 'text-amber-600' : 'text-gray-400'
                                )}>
                                  {pct}%
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px]">
                              <p className="font-medium">{dt.label}</p>
                              {isAuto && (
                                <p className="text-[11px] text-blue-400 mt-1">
                                  Auto-generated from project data
                                </p>
                              )}
                              {ragAspects && ragAspects.length > 0 && (
                                <div className="mt-1.5">
                                  <p className="text-[10px] text-gray-300 uppercase tracking-wide">Auto-updates RAG:</p>
                                  {ragAspects.map(a => (
                                    <div key={a.path} className="flex items-center gap-1 mt-0.5">
                                      <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                                      <span className="text-xs">{a.label}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <p className="text-[10px] text-gray-400 mt-1.5">
                                {colStat?.covered ?? 0}/{colStat?.total ?? 0} items covered
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </th>
                      );
                    })}
                    <th className="px-3 py-2.5 text-center font-medium text-gray-600 min-w-[50px]">%</th>
                  </tr>
                </thead>
                <tbody>
                  {matrixData.map(row => (
                    <tr key={row.item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">{row.item.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-gray-400">{row.item.itemCode}</span>
                              <StageBadge stage={row.item.currentStage} size="xs" />
                            </div>
                          </div>
                        </div>
                      </td>
                      {visibleTypes.map(dt => {
                        const status = row.typeStatuses[dt.value];
                        const isAuto = isAutoGenType(dt.value);
                        // Check if the actual deliverable is auto-generated
                        const itemDeliverables = deliverablesByItem.get(row.item.id) || [];
                        const matchingDel = itemDeliverables.find(
                          d => d.type === dt.value || d.coversTypes?.includes(dt.value)
                        );
                        const isAutoGenerated = matchingDel?.isAutoGenerated === true;

                        return (
                          <td key={dt.value} className="px-1.5 py-2 text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    // Don't open upload dialog for missing auto-gen types
                                    if (isAuto && status === 'missing') return;
                                    handleCellClick(row.item.id, dt.value, status);
                                  }}
                                  className={cn(
                                    'w-7 h-7 rounded-md flex items-center justify-center mx-auto transition-all',
                                    // Auto-generated & present: blue styling
                                    isAutoGenerated && status === 'approved' && 'bg-blue-50 text-blue-600',
                                    isAutoGenerated && status === 'in-progress' && 'bg-blue-50 text-blue-500',
                                    // Manual & present: standard green/amber
                                    !isAutoGenerated && status === 'approved' && 'bg-green-50 text-green-600',
                                    !isAutoGenerated && status === 'in-progress' && 'bg-amber-50 text-amber-600',
                                    // Missing auto-gen: muted clock (no hover upload prompt)
                                    isAuto && status === 'missing' && 'bg-gray-50/50 text-gray-300 cursor-default',
                                    // Missing manual: clickable upload prompt
                                    !isAuto && status === 'missing' && 'bg-gray-50 text-gray-300 hover:bg-blue-50 hover:text-blue-400 cursor-pointer',
                                  )}
                                >
                                  {/* Auto-generated present: blue check with zap */}
                                  {isAutoGenerated && status !== 'missing' && <CheckCircle2 className="w-4 h-4" />}
                                  {/* Manual present */}
                                  {!isAutoGenerated && status === 'approved' && <CheckCircle2 className="w-4 h-4" />}
                                  {!isAutoGenerated && status === 'in-progress' && <Circle className="w-4 h-4 fill-current" />}
                                  {/* Missing auto-gen: clock icon */}
                                  {isAuto && status === 'missing' && <Clock className="w-3.5 h-3.5" />}
                                  {/* Missing manual: dash */}
                                  {!isAuto && status === 'missing' && <Minus className="w-3.5 h-3.5" />}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[220px]">
                                {isAuto && status === 'missing' ? (
                                  <p className="text-xs text-gray-400">
                                    Will be auto-generated when parts are fully defined
                                  </p>
                                ) : isAutoGenerated ? (
                                  <div>
                                    <p className="text-xs font-medium text-blue-400">
                                      Auto-generated &mdash; {dt.label}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                      {matchingDel?.autoGenSource === 'parts-data'
                                        ? 'Generated from parts data'
                                        : 'Generated from production optimization'}
                                    </p>
                                  </div>
                                ) : status === 'missing' ? (
                                  <p className="text-xs">Click to upload {dt.label}</p>
                                ) : (
                                  <p className="text-xs font-medium">
                                    {status === 'approved' ? 'Approved' : 'In progress'} &mdash; {dt.label}
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center">
                        <span className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          row.completionPct === 100 && 'bg-green-100 text-green-700',
                          row.completionPct > 0 && row.completionPct < 100 && 'bg-amber-100 text-amber-700',
                          row.completionPct === 0 && 'bg-gray-100 text-gray-500',
                        )}>
                          {row.completionPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* RAG Impact Legend */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={() => setShowLegend(!showLegend)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showLegend ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                RAG Impact Legend
              </button>
              {showLegend && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(DELIVERABLE_RAG_MAP).map(([type, aspects]) => (
                    <div key={type} className="text-xs text-gray-600">
                      <span className="font-medium">{DELIVERABLE_TYPE_LABELS[type as DeliverableType]}</span>
                      <span className="text-gray-400"> &rarr; </span>
                      {aspects.map(a => a.label).join(', ')}
                    </div>
                  ))}
                  <div className="col-span-full mt-1 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Approved</span>
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /> Auto-generated</span>
                    <span className="flex items-center gap-1"><Circle className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Draft/Review</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-300" /> Pending auto-gen</span>
                    <span className="flex items-center gap-1"><Minus className="w-3.5 h-3.5 text-gray-300" /> Missing</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* List View — Deliverables grouped by type */}
        {viewMode === 'list' && !loading && (
          <div className="space-y-3">
            {visibleTypes.map(dt => {
              const typeDeliverables = deliverablesByType.get(dt.value) || [];
              const ragAspects = DELIVERABLE_RAG_MAP[dt.value];
              const colStat = columnStats[dt.value];
              const isExpanded = expandedTypes.has(dt.value);
              const hasFiles = typeDeliverables.length > 0;
              const isAuto = isAutoGenType(dt.value);

              // Deduplicate by storageUrl to group shared files
              const fileGroups: Array<{
                deliverable: Deliverable;
                itemIds: string[];
              }> = [];
              const seen = new Set<string>();
              for (const d of typeDeliverables) {
                const key = d.storageUrl || d.id;
                if (seen.has(key)) {
                  // Find existing group and add item
                  const existing = fileGroups.find(fg => (fg.deliverable.storageUrl || fg.deliverable.id) === key);
                  if (existing && !existing.itemIds.includes(d.itemId)) {
                    existing.itemIds.push(d.itemId);
                  }
                  continue;
                }
                seen.add(key);
                fileGroups.push({ deliverable: d, itemIds: [d.itemId] });
              }

              return (
                <div
                  key={dt.value}
                  className={cn(
                    'bg-white rounded-xl border border-gray-200 overflow-hidden',
                    hasFiles && 'border-l-4',
                    hasFiles && colStat.covered === colStat.total ? 'border-l-green-500' : hasFiles ? 'border-l-amber-400' : ''
                  )}
                >
                  <button
                    onClick={() => toggleType(dt.value)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{dt.label}</span>
                          {isAuto && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                              <Zap className="w-3 h-3" />
                              Auto
                            </span>
                          )}
                          <span className="px-2 py-0.5 text-[11px] rounded-full bg-gray-100 text-gray-600">
                            {fileGroups.length} file{fileGroups.length !== 1 ? 's' : ''}
                          </span>
                          <span className={cn(
                            'px-2 py-0.5 text-[11px] rounded-full',
                            colStat.covered === colStat.total && colStat.total > 0 ? 'bg-green-100 text-green-700' :
                            colStat.covered > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                          )}>
                            {colStat.covered}/{colStat.total} items
                          </span>
                        </div>
                        {ragAspects && ragAspects.length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[11px] text-gray-400">RAG:</span>
                            {ragAspects.map(a => (
                              <span key={a.path} className="text-[11px] text-green-600">{a.label}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUploadForType(dt.value); }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                        title={`Upload ${dt.label}`}
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4 space-y-2">
                      {fileGroups.length === 0 ? (
                        <div className="text-center py-6">
                          {isAuto ? (
                            <>
                              <Clock className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                              <p className="text-sm text-gray-500">
                                Will be auto-generated when parts are fully defined
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-gray-500 mb-2">No {dt.label.toLowerCase()} files uploaded yet</p>
                              <button
                                onClick={() => handleUploadForType(dt.value)}
                                className="text-sm text-primary hover:underline"
                              >
                                Upload {dt.label}
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        fileGroups.map(({ deliverable, itemIds }) => {
                          const statusCfg = STATUS_CONFIG[deliverable.status] || STATUS_CONFIG.draft;
                          const isShared = itemIds.length > 1;

                          return (
                            <div
                              key={deliverable.id}
                              className="flex items-start justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg"
                            >
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0 mt-0.5">
                                  <FileText className="w-4 h-4 text-gray-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-gray-900 text-sm">{deliverable.name}</span>
                                    <span className={cn('px-2 py-0.5 text-[11px] rounded-full', statusCfg.bg, statusCfg.text)}>
                                      {statusCfg.label}
                                    </span>
                                    <span className="text-[11px] text-gray-500">v{deliverable.version}</span>
                                    {deliverable.isAutoGenerated && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                                        <Zap className="w-3 h-3" />
                                        Auto-generated
                                      </span>
                                    )}
                                    {isShared && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                        <Link2 className="w-3 h-3" />
                                        Shared ({itemIds.length} items)
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                    {deliverable.fileSize > 0 && <span>{formatFileSize(deliverable.fileSize)}</span>}
                                    {deliverable.fileType && <span>{deliverable.fileType.toUpperCase()}</span>}
                                    {deliverable.uploadedAt && <span>{formatDate(deliverable.uploadedAt)}</span>}
                                    {deliverable.coversTypes && deliverable.coversTypes.length > 0 && (
                                      <span className="text-green-600">
                                        Also covers: {deliverable.coversTypes.map(t => DELIVERABLE_TYPE_LABELS[t] || t).join(', ')}
                                      </span>
                                    )}
                                  </div>
                                  {/* Item badges */}
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {itemIds.map(id => {
                                      const item = itemById.get(id);
                                      return item ? <ItemBadge key={id} item={item} /> : null;
                                    })}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                {deliverable.storageUrl && (
                                  <a
                                    href={deliverable.storageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                                    title="View"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </a>
                                )}
                                {deliverable.storageUrl && (
                                  <a
                                    href={deliverable.storageUrl}
                                    download
                                    className="p-2 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                                    title="Download"
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading deliverables...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && totalFiles === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <h4 className="text-lg font-semibold text-gray-900 mb-1">No deliverables yet</h4>
            <p className="text-sm text-gray-500 mb-4">Upload design files to track deliverable requirements across all items</p>
            <button
              onClick={handleUploadAll}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1d1d1f] text-white text-sm font-medium rounded-lg hover:bg-[#2d2d2f] transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload First File
            </button>
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      {showUploadDialog && (
        <BulkFileUploadDialog
          open={showUploadDialog}
          onClose={() => {
            setShowUploadDialog(false);
            setUploadPreselection(new Set());
            setDefaultType(undefined);
          }}
          onComplete={handleUploadComplete}
          selectedIds={uploadPreselection}
          allItems={items}
          projectId={projectId}
          userId={userId}
          defaultDeliverableType={defaultType}
        />
      )}
    </TooltipProvider>
  );
}
