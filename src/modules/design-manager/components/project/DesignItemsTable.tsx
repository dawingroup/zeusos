/**
 * DesignItemsTable Component
 * Table-based view of design items with stages as columns
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronUp, ChevronDown, Package, ShoppingCart, Edit2, FileText, HardHat, Printer, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { EditDesignItemDialog } from '../design-item/EditDesignItemDialog';
import { DesignItemsBulkToolbar } from './DesignItemsBulkToolbar';
import { MergeItemsDialog } from './MergeItemsDialog';
import { BulkStageAdvanceDialog } from './BulkStageAdvanceDialog';
import { BulkFileUploadDialog } from './BulkFileUploadDialog';
import { cn } from '@/shared/lib/utils';
import type { DesignItem, DesignStage } from '../../types';
import type { DesignItemCORef } from '../../services/changeOrderContextService';
import DesignItemCOBadge from './DesignItemCOBadge';
import { STAGE_LABELS } from '../../utils/formatting';
import {
  MANUFACTURING_STAGE_ORDER,
  PROCUREMENT_STAGE_ORDER,
  ARCHITECTURAL_STAGE_ORDER,
  getStageOrderForItem
} from '../../utils/stage-gate';
import { CONSTRUCTION_STAGES, normalizeSourcingType } from '../../types/deliverables';
import { updateDesignItemOrder } from '../../services/firestore';
import { computeProjectPriorities, syncProjectPriorityToCRM, type PriorityScore } from '../../services/priorityService';

interface DesignItemsTableProps {
  items: DesignItem[];
  projectId: string;
  /**
   * Optional map from designItemId → change-order refs, sourced from
   * `useDesignProjectChangeOrders`. When provided, each row renders a
   * compact CO badge next to the item name. Absent map = no badges.
   */
  coItemMap?: Record<string, DesignItemCORef[]>;
  /** Linked SalesOrderId — enables badge click-through to CO detail. */
  coSalesOrderId?: string | null;
}

type SortField = 'custom' | 'name' | 'category' | 'readiness' | 'stage' | 'priority';
type SortDirection = 'asc' | 'desc';

// Stage status for display
type StageStatus = 'completed' | 'current' | 'current-delayed' | 'pending' | 'not-applicable';

// Expected duration for each stage in days
const STAGE_TIMELINE_DAYS: Record<DesignStage, number> = {
  // Manufacturing stages
  'concept': 2,
  'preliminary': 5,
  'technical': 3,
  'pre-production': 2,
  'production-ready': 0,
  // Procurement stages
  'procure-identify': 2,
  'procure-quote': 3,
  'procure-approve': 2,
  'procure-order': 1,
  'procure-received': 7,
  // Architectural stages
  'arch-brief': 5,
  'arch-schematic': 10,
  'arch-development': 15,
  'arch-construction-docs': 10,
  'arch-approved': 0,
  // Construction stages
  'const-scope': 3,
  'const-spec': 5,
  'const-quote': 5,
  'const-approve': 3,
  'const-in-progress': 14,
  'const-inspection': 2,
  'const-complete': 0,
};

function getStageStatus(item: DesignItem, stage: DesignStage): StageStatus {
  const stageOrder = getStageOrderForItem(item);
  const currentIndex = stageOrder.indexOf(item.currentStage);
  const stageIndex = stageOrder.indexOf(stage);
  
  if (stageIndex === -1) return 'not-applicable';
  if (stageIndex < currentIndex) return 'completed';
  if (stageIndex === currentIndex) {
    // Check if delayed based on stageEnteredAt timestamp
    const stageEnteredAt = (item as any).stageEnteredAt;
    if (stageEnteredAt) {
      const enteredDate = stageEnteredAt.toDate ? stageEnteredAt.toDate() : new Date(stageEnteredAt.seconds * 1000);
      const now = new Date();
      const daysInStage = Math.floor((now.getTime() - enteredDate.getTime()) / (1000 * 60 * 60 * 24));
      const expectedDays = STAGE_TIMELINE_DAYS[stage] || 3;
      
      if (daysInStage > expectedDays) {
        return 'current-delayed';
      }
    }
    return 'current';
  }
  return 'pending';
}

// Stage cell colors - full cell background
const STAGE_CELL_CONFIG: Record<StageStatus, { bg: string; text: string; label: string; title: string }> = {
  'completed': { 
    bg: 'bg-green-500', 
    text: 'text-white font-medium',
    label: '✓',
    title: 'Completed'
  },
  'current': { 
    bg: 'bg-amber-500', 
    text: 'text-white font-medium',
    label: '●',
    title: 'In Progress'
  },
  'current-delayed': { 
    bg: 'bg-red-500', 
    text: 'text-white font-medium',
    label: '!',
    title: 'Delayed - exceeds expected timeline'
  },
  'pending': { 
    bg: 'bg-gray-100', 
    text: 'text-gray-400',
    label: '○',
    title: 'Pending'
  },
  'not-applicable': { 
    bg: 'bg-gray-50', 
    text: 'text-gray-300',
    label: '—',
    title: 'Not applicable'
  },
};

function ReadinessBadge({ readiness }: { readiness: number }) {
  let bg = 'bg-red-100 text-red-700';
  if (readiness >= 80) {
    bg = 'bg-green-100 text-green-700';
  } else if (readiness >= 50) {
    bg = 'bg-amber-100 text-amber-700';
  }

  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', bg)}>
      {readiness}%
    </span>
  );
}

export function DesignItemsTable({ items, projectId, coItemMap, coSalesOrderId }: DesignItemsTableProps) {
  const { user } = useAuth();
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<DesignItem | null>(null);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [priorityMap, setPriorityMap] = useState<Map<string, PriorityScore>>(new Map());
  const [travelerLoadingItem, setTravelerLoadingItem] = useState<string | null>(null);
  const priorityTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleGenerateItemTraveler = useCallback(async (item: DesignItem) => {
    if (!user?.email) return;
    setTravelerLoadingItem(item.id);
    try {
      const { autoGenerateItemShopTraveler } = await import(
        '../../services/deliverableAutoGenService'
      );
      await autoGenerateItemShopTraveler(projectId, item.id, user.email);
      // Simple user feedback — matches the codebase's existing pattern of
      // lightweight toasts/alerts for deliverable actions.
      // eslint-disable-next-line no-alert
      alert(`Shop Traveler generated for "${item.name}" and attached as a deliverable.`);
    } catch (err) {
      console.error('[DesignItemsTable] Per-item traveler failed:', err);
      // eslint-disable-next-line no-alert
      alert(
        `Failed to generate Shop Traveler for "${item.name}":\n` +
        (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setTravelerLoadingItem(null);
    }
  }, [projectId, user?.email]);

  // Compute priorities when items change (debounced)
  useEffect(() => {
    if (priorityTimer.current) clearTimeout(priorityTimer.current);
    if (items.length === 0) { setPriorityMap(new Map()); return; }

    priorityTimer.current = setTimeout(() => {
      computeProjectPriorities(projectId)
        .then(setPriorityMap)
        .catch(() => setPriorityMap(new Map()));
    }, 500);

    return () => { if (priorityTimer.current) clearTimeout(priorityTimer.current); };
  }, [items, projectId]);

  const handleMoveItem = useCallback(async (itemList: DesignItem[], index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= itemList.length) return;

    // Recompute sortOrder for all items in this group
    const reordered = [...itemList];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const updates = reordered.map((item, i) => ({ id: item.id, sortOrder: i }));
    await updateDesignItemOrder(projectId, updates);

    // Fire-and-forget: sync priority to linked CRM deal
    syncProjectPriorityToCRM(projectId, user?.email || '').catch(console.error);
  }, [projectId, user?.email]);

  // Separate items by normalized type
  const manufacturedItems = useMemo(() =>
    items.filter(i => {
      const normalizedType = normalizeSourcingType((i as any).sourcingType);
      return normalizedType === 'CUSTOM_FURNITURE_MILLWORK';
    }),
    [items]
  );

  const procuredItems = useMemo(() =>
    items.filter(i => normalizeSourcingType((i as any).sourcingType) === 'PROCURED'),
    [items]
  );

  const architecturalItems = useMemo(() =>
    items.filter(i => normalizeSourcingType((i as any).sourcingType) === 'DESIGN_DOCUMENT'),
    [items]
  );

  const constructionItems = useMemo(() =>
    items.filter(i => normalizeSourcingType((i as any).sourcingType) === 'CONSTRUCTION'),
    [items]
  );

  // Generic sort function
  const sortItems = useCallback((itemList: DesignItem[], stageOrder: readonly DesignStage[]) => {
    return [...itemList].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'custom':
          comparison = (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity);
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
        case 'readiness':
          comparison = a.overallReadiness - b.overallReadiness;
          break;
        case 'stage': {
          const aIndex = stageOrder.indexOf(a.currentStage);
          const bIndex = stageOrder.indexOf(b.currentStage);
          comparison = aIndex - bIndex;
          break;
        }
        case 'priority': {
          const aScore = priorityMap.get(a.id)?.score ?? 0;
          const bScore = priorityMap.get(b.id)?.score ?? 0;
          comparison = bScore - aScore; // Higher score first by default
          break;
        }
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [sortField, sortDirection, priorityMap]);

  const sortedManufactured = useMemo(() =>
    sortItems(manufacturedItems, MANUFACTURING_STAGE_ORDER),
    [manufacturedItems, sortItems]
  );
  const sortedProcured = useMemo(() =>
    sortItems(procuredItems, PROCUREMENT_STAGE_ORDER),
    [procuredItems, sortItems]
  );
  const sortedArchitectural = useMemo(() =>
    sortItems(architecturalItems, ARCHITECTURAL_STAGE_ORDER),
    [architecturalItems, sortItems]
  );
  const sortedConstruction = useMemo(() =>
    sortItems(constructionItems, CONSTRUCTION_STAGES),
    [constructionItems, sortItems]
  );

  // Track which selected items are manufactured (for merge eligibility)
  const selectedManufacturedIds = useMemo(() => {
    const mfgSet = new Set(manufacturedItems.map(i => i.id));
    return new Set(Array.from(selectedItems).filter(id => mfgSet.has(id)));
  }, [selectedItems, manufacturedItems]);

  const canMerge = selectedManufacturedIds.size >= 2 &&
    selectedItems.size === selectedManufacturedIds.size;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleSelectAll = (itemList: DesignItem[]) => {
    const allSelected = itemList.every(i => selectedItems.has(i.id));
    const newSelected = new Set(selectedItems);
    if (allSelected) {
      itemList.forEach(i => newSelected.delete(i.id));
    } else {
      itemList.forEach(i => newSelected.add(i.id));
    }
    setSelectedItems(newSelected);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        )}
      </div>
    </th>
  );

  const isCustomSort = sortField === 'custom';

  const renderTable = (
    title: string,
    icon: React.ReactNode,
    itemList: DesignItem[],
    stageOrder: DesignStage[]
  ) => {
    if (itemList.length === 0) return null;

    const allSelected = itemList.every(i => selectedItems.has(i.id));
    const someSelected = itemList.some(i => selectedItems.has(i.id)) && !allSelected;

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Table Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
            {itemList.length}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-sticky-first-two-col">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={input => {
                      if (input) input.indeterminate = someSelected;
                    }}
                    onChange={() => toggleSelectAll(itemList)}
                    className="h-4 w-4 text-[#0A7C8E] border-gray-300 rounded focus:ring-[#0A7C8E]"
                  />
                </th>
                <SortHeader field="name">Item</SortHeader>
                <SortHeader field="priority">Priority</SortHeader>
                <SortHeader field="category">Category</SortHeader>
                <SortHeader field="readiness">Readiness</SortHeader>
                {/* Stage columns - share 60% of table width equally */}
                {stageOrder.map((stage, idx) => (
                  <th
                    key={stage}
                    style={{ width: `${60 / (stageOrder.length + 1)}%` }}
                    className={cn(
                      "px-1 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider",
                      idx === 0 ? "border-l-2 border-l-gray-300" : "border-l border-l-gray-200"
                    )}
                  >
                    {STAGE_LABELS[stage]?.replace('Procure: ', '').replace('Procure:', '') || stage}
                  </th>
                ))}
                <th 
                  style={{ width: `${60 / (stageOrder.length + 1)}%` }}
                  className="px-1 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-l-gray-200"
                >
                  Costing
                </th>
                <th className="w-16 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {itemList.map((item, idx) => {
                const isSelected = selectedItems.has(item.id);
                const hasCosting = (item as any).manufacturing?.totalCost || (item as any).procurement?.totalLandedCost;
                
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      'hover:bg-gray-50 transition-colors',
                      isSelected && 'bg-blue-50',
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    )}
                  >
                    <td className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        className="h-4 w-4 text-[#0A7C8E] border-gray-300 rounded focus:ring-[#0A7C8E]"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`item/${item.id}`}
                          className="text-sm font-medium text-[#0A7C8E] hover:underline"
                        >
                          {item.name}
                        </Link>
                        {coItemMap && (
                          <DesignItemCOBadge
                            refs={coItemMap[item.id]}
                            salesOrderId={coSalesOrderId ?? null}
                          />
                        )}
                      </div>
                      {(item as any).code && (
                        <p className="text-xs text-gray-500">{(item as any).code}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      {(() => {
                        const ps = priorityMap.get(item.id);
                        if (!ps) return <span className="text-xs text-gray-400">—</span>;
                        return (
                          <span
                            className={cn(
                              'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                              ps.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                              ps.urgency === 'high' ? 'bg-orange-100 text-orange-700' :
                              ps.urgency === 'medium' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            )}
                            title={ps.signals.join(' · ')}
                          >
                            P{ps.score}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 max-w-[120px] truncate">
                      {item.category || '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      <ReadinessBadge readiness={item.overallReadiness} />
                    </td>
                    {/* Stage status columns - colored cells */}
                    {stageOrder.map((stage, stageIdx) => {
                      const status = getStageStatus(item, stage);
                      const config = STAGE_CELL_CONFIG[status];
                      return (
                        <td 
                          key={stage} 
                          title={config.title}
                          className={cn(
                            "px-1 py-2 text-center whitespace-nowrap cursor-default",
                            config.bg,
                            config.text,
                            stageIdx === 0 ? "border-l-2 border-l-gray-300" : "border-l border-l-gray-200"
                          )}
                        >
                          <span className="text-sm">{config.label}</span>
                        </td>
                      );
                    })}
                    <td 
                      title={hasCosting ? 'Costed' : 'Pending costing'}
                      className={cn(
                        "px-1 py-2 text-center whitespace-nowrap cursor-default border-l border-l-gray-200",
                        hasCosting ? "bg-green-500 text-white font-medium" : "bg-amber-500 text-white font-medium"
                      )}
                    >
                      <span className="text-sm">{hasCosting ? '✓' : '○'}</span>
                    </td>
                    <td className="w-24 px-2 py-2 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        {isCustomSort && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMoveItem(itemList, idx, 'up'); }}
                              disabled={idx === 0}
                              className={cn(
                                "p-1 rounded transition-colors",
                                idx === 0
                                  ? "text-gray-300 cursor-not-allowed"
                                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                              )}
                              title="Move up"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMoveItem(itemList, idx, 'down'); }}
                              disabled={idx === itemList.length - 1}
                              className={cn(
                                "p-1 rounded transition-colors",
                                idx === itemList.length - 1
                                  ? "text-gray-300 cursor-not-allowed"
                                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                              )}
                              title="Move down"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingItem(item);
                          }}
                          className="p-1.5 text-gray-500 hover:text-[#0A7C8E] hover:bg-gray-100 rounded transition-colors"
                          title="Edit item"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {normalizeSourcingType(item.sourcingType) === 'CUSTOM_FURNITURE_MILLWORK' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateItemTraveler(item);
                            }}
                            disabled={travelerLoadingItem !== null}
                            className="p-1.5 text-gray-500 hover:text-[#0A7C8E] hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Generate Shop Traveler for this item"
                          >
                            {travelerLoadingItem === item.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Printer className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Manufacturing Items Table */}
      {renderTable(
        'Manufacturing Items',
        <Package className="w-4 h-4 text-blue-600" />,
        sortedManufactured,
        MANUFACTURING_STAGE_ORDER
      )}

      {/* Procurement Items Table */}
      {renderTable(
        'Procurement Items',
        <ShoppingCart className="w-4 h-4 text-purple-600" />,
        sortedProcured,
        PROCUREMENT_STAGE_ORDER
      )}

      {/* Design Documents Table */}
      {renderTable(
        'Design Documents',
        <FileText className="w-4 h-4 text-indigo-600" />,
        sortedArchitectural,
        ARCHITECTURAL_STAGE_ORDER
      )}

      {/* Construction Items Table */}
      {renderTable(
        'Construction Items',
        <HardHat className="w-4 h-4 text-amber-600" />,
        sortedConstruction,
        CONSTRUCTION_STAGES
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No design items</h3>
          <p className="text-gray-500 mt-1">Add design items to see them here.</p>
        </div>
      )}

      {/* Edit Design Item Dialog */}
      {editingItem && (
        <EditDesignItemDialog
          open={!!editingItem}
          onClose={() => setEditingItem(null)}
          item={editingItem}
          projectId={projectId}
          userId={user?.email || ''}
        />
      )}

      {/* Bulk Actions Toolbar — appears when items are selected */}
      {selectedItems.size >= 1 && (
        <DesignItemsBulkToolbar
          selectedCount={selectedItems.size}
          onMerge={() => setShowMergeDialog(true)}
          onAdvanceStage={() => setShowAdvanceDialog(true)}
          onUploadFiles={() => setShowBulkUploadDialog(true)}
          onClearSelection={() => setSelectedItems(new Set())}
          canMerge={canMerge}
        />
      )}

      {/* Merge Items Dialog */}
      {showMergeDialog && (
        <MergeItemsDialog
          open={showMergeDialog}
          selectedIds={selectedManufacturedIds}
          allItems={items}
          onClose={() => setShowMergeDialog(false)}
          onComplete={() => {
            setShowMergeDialog(false);
            setSelectedItems(new Set());
          }}
          projectId={projectId}
          userId={user?.email || ''}
        />
      )}

      {/* Bulk Stage Advance Dialog */}
      {showAdvanceDialog && (
        <BulkStageAdvanceDialog
          open={showAdvanceDialog}
          selectedIds={selectedItems}
          allItems={items}
          onClose={() => setShowAdvanceDialog(false)}
          onComplete={() => {
            setShowAdvanceDialog(false);
            setSelectedItems(new Set());
          }}
          projectId={projectId}
          userId={user?.email || ''}
        />
      )}

      {/* Bulk File Upload Dialog */}
      {showBulkUploadDialog && (
        <BulkFileUploadDialog
          open={showBulkUploadDialog}
          selectedIds={selectedItems}
          allItems={items}
          onClose={() => setShowBulkUploadDialog(false)}
          onComplete={() => {
            setShowBulkUploadDialog(false);
            setSelectedItems(new Set());
          }}
          projectId={projectId}
          userId={user?.email || ''}
        />
      )}
    </div>
  );
}
