/**
 * BOQ Table Component
 */

import React, { useState, useMemo } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Edit2, 
  Trash2, 
  Link as LinkIcon,
  CheckCircle,
} from 'lucide-react';
import type { BOQItem, ConstructionStage } from '../../types';

interface BOQTableProps {
  items: BOQItem[];
  onEdit?: (item: BOQItem) => void;
  onDelete?: (item: BOQItem) => void;
  onAssignFormula?: (item: BOQItem) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

export const BOQTable: React.FC<BOQTableProps> = ({
  items,
  onEdit,
  onDelete,
  onAssignFormula,
  selectedIds = [],
  onSelectionChange,
}) => {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  
  // Group items by stage
  const groupedItems = useMemo(() => {
    const groups = new Map<ConstructionStage, BOQItem[]>();
    
    for (const item of items) {
      const existing = groups.get(item.stage as ConstructionStage) || [];
      groups.set(item.stage as ConstructionStage, [...existing, item]);
    }
    
    return groups;
  }, [items]);
  
  const toggleStage = (stage: ConstructionStage) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stage)) {
        next.delete(stage);
      } else {
        next.add(stage);
      }
      return next;
    });
  };
  
  const toggleSelect = (itemId: string) => {
    if (!onSelectionChange) return;
    
    const newSelection = selectedIds.includes(itemId)
      ? selectedIds.filter(id => id !== itemId)
      : [...selectedIds, itemId];
    
    onSelectionChange(newSelection);
  };
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(value);
  };
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full table-sticky-first-col">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {onSelectionChange && <th className="w-10 px-3 py-3"></th>}
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Description</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Qty</th>
            <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Unit</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Rate</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Amount</th>
            <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Formula</th>
            <th className="w-24 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {Array.from(groupedItems.entries()).map(([stage, stageItems]) => (
            <React.Fragment key={stage}>
              {/* Stage Header */}
              <tr 
                className="bg-amber-50 cursor-pointer hover:bg-amber-100"
                onClick={() => toggleStage(stage)}
              >
                <td colSpan={onSelectionChange ? 9 : 8} className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {expandedStages.has(stage) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <span className="font-medium text-amber-900">
                      {stage.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="text-sm text-amber-700">
                      ({stageItems.length} items)
                    </span>
                  </div>
                </td>
              </tr>
              
              {/* Stage Items */}
              {expandedStages.has(stage) && stageItems.map(item => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  {onSelectionChange && (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono text-sm">{item.itemCode}</td>
                  <td className="px-4 py-3 text-sm max-w-md truncate">{item.description}</td>
                  <td className="px-4 py-3 text-sm text-right">{item.quantityContract}</td>
                  <td className="px-4 py-3 text-sm text-center">{item.unit}</td>
                  <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.rate ?? 0)}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(item.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    {item.formulaCode ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                        <CheckCircle className="w-3 h-3" />
                        {item.formulaCode}
                      </span>
                    ) : (
                      <button
                        onClick={() => onAssignFormula?.(item)}
                        className="text-amber-600 hover:text-amber-700"
                      >
                        <LinkIcon className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEdit?.(item)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete?.(item)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      
      {items.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No BOQ items yet. Add items manually or import from a file.
        </div>
      )}
    </div>
  );
};
