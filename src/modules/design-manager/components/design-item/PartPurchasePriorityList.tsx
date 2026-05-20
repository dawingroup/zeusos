/**
 * PartPurchasePriorityList
 * Drag-to-reorder list for setting purchase priority across all part types.
 * Priority flows downstream to manufacturing BOM and procurement.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Sparkles, Package, Wrench, ArrowUpDown, Loader2, Lightbulb } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { computePartPriorityHints, type PartPriorityHint } from '../../services/partPriorityHintService';
import type {
  DesignItem,
  StandardPartEntry,
  SpecialPartEntry,
  PartEntry,
} from '../../types';
import { updateDesignItem } from '../../services/firestore';

/** Unified part item for the priority list */
interface PriorityListItem {
  id: string;
  name: string;
  materialOrCategory: string;
  quantity: number;
  type: 'sheet' | 'bar' | 'standard' | 'special';
  purchasePriority?: number;
}

interface PartPurchasePriorityListProps {
  item: DesignItem;
  projectId: string;
  parts: PartEntry[];
}

/** Build a unified list from all part types, sorted by purchasePriority */
function buildPriorityList(item: DesignItem, parts: PartEntry[]): PriorityListItem[] {
  const list: PriorityListItem[] = [];

  // Sheet + bar parts
  if (parts) {
    for (const p of parts) {
      list.push({
        id: p.id,
        name: p.name,
        materialOrCategory: p.materialName,
        quantity: p.quantity,
        // Timber shares linear/bar purchasing semantics (priced per linear meter, no sheet yield).
        type: (p.partType === 'bar' || p.partType === 'timber') ? 'bar' : 'sheet',
        purchasePriority: p.purchasePriority,
      });
    }
  }

  // Standard parts
  const manufacturing = (item as any).manufacturing;
  if (manufacturing?.standardParts) {
    for (const p of manufacturing.standardParts as StandardPartEntry[]) {
      list.push({
        id: `std-${p.id}`,
        name: p.name,
        materialOrCategory: p.category,
        quantity: p.quantity,
        type: 'standard',
        purchasePriority: p.purchasePriority,
      });
    }
  }

  // Special parts
  if (manufacturing?.specialParts) {
    for (const p of manufacturing.specialParts as SpecialPartEntry[]) {
      list.push({
        id: `spl-${p.id}`,
        name: p.name,
        materialOrCategory: p.category,
        quantity: p.quantity,
        type: 'special',
        purchasePriority: p.purchasePriority,
      });
    }
  }

  // Sort: ranked items first (by priority ASC), unranked last
  list.sort((a, b) => {
    const aPri = a.purchasePriority ?? Infinity;
    const bPri = b.purchasePriority ?? Infinity;
    return aPri - bPri;
  });

  return list;
}

const TYPE_BADGES: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
  sheet: { icon: <Package className="w-3 h-3" />, bg: 'bg-blue-100', text: 'text-blue-700' },
  bar: { icon: <Wrench className="w-3 h-3" />, bg: 'bg-teal-100', text: 'text-teal-700' },
  standard: { icon: <Wrench className="w-3 h-3" />, bg: 'bg-orange-100', text: 'text-orange-700' },
  special: { icon: <Sparkles className="w-3 h-3" />, bg: 'bg-purple-100', text: 'text-purple-700' },
};

function SortableRow({ item, index, hint }: { item: PriorityListItem; index: number; hint?: PartPriorityHint }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const badge = TYPE_BADGES[item.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2 bg-white border border-gray-200 rounded-lg ${
        isDragging ? 'shadow-lg z-10' : 'hover:border-gray-300'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        tabIndex={-1}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
        {index + 1}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${badge.bg} ${badge.text}`}>
            {badge.icon}
            {item.type}
          </span>
        </div>
        <div className="text-xs text-gray-500 truncate">
          {item.materialOrCategory} &middot; Qty: {item.quantity}
        </div>
      </div>

      {hint && (
        <div className="flex items-center gap-1 shrink-0" title={hint.signals.join(', ')}>
          {hint.stockStatus === 'out_of_stock' && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">No stock</span>
          )}
          {hint.stockStatus === 'low_stock' && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Low stock</span>
          )}
          <span className="text-xs text-gray-400">{hint.score}pt</span>
        </div>
      )}
    </div>
  );
}

export function PartPurchasePriorityList({ item, projectId, parts }: PartPurchasePriorityListProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [hints, setHints] = useState<Map<string, PartPriorityHint>>(new Map());
  const [orderedItems, setOrderedItems] = useState<PriorityListItem[]>(() => buildPriorityList(item, parts));

  // Rebuild list when item/parts change (external edits)
  useMemo(() => {
    setOrderedItems(buildPriorityList(item, parts));
  }, [parts, (item as any).manufacturing?.standardParts, (item as any).manufacturing?.specialParts]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persistPriorities = useCallback(
    async (newOrder: PriorityListItem[]) => {
      setSaving(true);
      try {
        // Build update payload: update purchasePriority on each part type
        const updatedParts = [...(parts || [])];
        const manufacturing = { ...((item as any).manufacturing || {}) };
        const updatedStandard = [...(manufacturing.standardParts || [])];
        const updatedSpecial = [...(manufacturing.specialParts || [])];

        for (let i = 0; i < newOrder.length; i++) {
          const pItem = newOrder[i];
          const rank = i; // 0-based

          if (pItem.type === 'sheet' || pItem.type === 'bar') {
            const idx = updatedParts.findIndex((p) => p.id === pItem.id);
            if (idx >= 0) updatedParts[idx] = { ...updatedParts[idx], purchasePriority: rank };
          } else if (pItem.type === 'standard') {
            const realId = pItem.id.replace('std-', '');
            const idx = updatedStandard.findIndex((p: StandardPartEntry) => p.id === realId);
            if (idx >= 0) updatedStandard[idx] = { ...updatedStandard[idx], purchasePriority: rank };
          } else if (pItem.type === 'special') {
            const realId = pItem.id.replace('spl-', '');
            const idx = updatedSpecial.findIndex((p: SpecialPartEntry) => p.id === realId);
            if (idx >= 0) updatedSpecial[idx] = { ...updatedSpecial[idx], purchasePriority: rank };
          }
        }

        manufacturing.standardParts = updatedStandard;
        manufacturing.specialParts = updatedSpecial;

        await updateDesignItem(projectId, item.id, {
          parts: updatedParts as any,
          manufacturing,
        } as any, user?.email || 'system');
      } finally {
        setSaving(false);
      }
    },
    [item, projectId],
  );

  const handleAutoSuggest = useCallback(async () => {
    setSuggesting(true);
    try {
      const hintResults = await computePartPriorityHints(item, parts);
      const hintMap = new Map(hintResults.map((h) => [h.partId, h]));
      setHints(hintMap);

      // Reorder by hint score descending (highest urgency first)
      const reordered = [...orderedItems].sort((a, b) => {
        const aScore = hintMap.get(a.id)?.score ?? 0;
        const bScore = hintMap.get(b.id)?.score ?? 0;
        return bScore - aScore;
      });
      setOrderedItems(reordered);
      await persistPriorities(reordered);
    } finally {
      setSuggesting(false);
    }
  }, [item, orderedItems, persistPriorities]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setOrderedItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === active.id);
        const newIndex = prev.findIndex((i) => i.id === over.id);
        const reordered = arrayMove(prev, oldIndex, newIndex);
        // Persist asynchronously
        persistPriorities(reordered);
        return reordered;
      });
    },
    [persistPriorities],
  );

  if (orderedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <Package className="w-8 h-8 mb-2" />
        <p className="text-sm">No parts to prioritize</p>
        <p className="text-xs mt-1">Add sheet, standard, or special parts first</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            Drag to set purchase order ({orderedItems.length} parts)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </span>
          )}
          <button
            onClick={handleAutoSuggest}
            disabled={suggesting || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50"
          >
            {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
            Auto-suggest order
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {orderedItems.map((pItem, idx) => (
              <SortableRow key={pItem.id} item={pItem} index={idx} hint={hints.get(pItem.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p className="text-xs text-gray-400 text-center">
        Priority #1 = buy first. Flows to manufacturing BOM and procurement queue.
      </p>
    </div>
  );
}

export default PartPurchasePriorityList;
