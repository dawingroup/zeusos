/**
 * Bulk Actions Bar Component
 * Actions for multiple selected review items
 */

import React, { useState } from 'react';
import {
  Check,
  X,
  Calculator,
  Tag,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import type { ReviewableItem, ReviewStatus } from '../../utils/reviewHelpers';
import { ConstructionStage } from '../../types';

interface BulkActionsBarProps {
  selectedItems: ReviewableItem[];
  totalItems: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  onBulkAssignFormula: (formulaCode: string) => void;
  onBulkSetStage: (stage: ConstructionStage) => void;
  onBulkDelete: () => void;
  isAllSelected: boolean;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedItems,
  totalItems,
  onSelectAll,
  onDeselectAll,
  onBulkApprove,
  onBulkReject,
  onBulkAssignFormula,
  onBulkSetStage,
  onBulkDelete,
  isAllSelected,
}) => {
  const selectedCount = selectedItems.length;
  const hasSelection = selectedCount > 0;

  // Count items by status
  const statusCounts = selectedItems.reduce<Record<ReviewStatus, number>>(
    (acc, item) => {
      acc[item.reviewStatus]++;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0, modified: 0 }
  );

  // Can approve if any selected items are not already approved
  const canApprove = statusCounts.pending > 0 || statusCounts.modified > 0;
  const canReject = statusCounts.pending > 0 || statusCounts.modified > 0 || statusCounts.approved > 0;

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Selection info */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={isAllSelected ? onDeselectAll : onSelectAll}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">
            {hasSelection ? (
              <>
                <span className="font-medium">{selectedCount}</span> of {totalItems} selected
              </>
            ) : (
              'Select all'
            )}
          </span>
        </label>

        {hasSelection && (
          <button
            type="button"
            onClick={onDeselectAll}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Bulk actions */}
      {hasSelection && (
        <div className="flex items-center gap-2">
          {/* Approve */}
          <button
            type="button"
            onClick={onBulkApprove}
            disabled={!canApprove}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              ${canApprove
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            <Check size={16} />
            Approve
            {statusCounts.pending + statusCounts.modified > 0 && (
              <span className="ml-1 text-xs">
                ({statusCounts.pending + statusCounts.modified})
              </span>
            )}
          </button>

          {/* Reject */}
          <button
            type="button"
            onClick={onBulkReject}
            disabled={!canReject}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              ${canReject
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            <X size={16} />
            Reject
          </button>

          {/* Assign Formula Dropdown */}
          <FormulaDropdownButton onSelect={onBulkAssignFormula} />

          {/* Set Stage Dropdown */}
          <StageDropdownButton onSelect={onBulkSetStage} />

          {/* Delete */}
          <button
            type="button"
            onClick={onBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium"
          >
            <Trash2 size={16} />
            Remove
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Formula dropdown for bulk assignment
 */
const FormulaDropdownButton: React.FC<{
  onSelect: (formulaCode: string) => void;
}> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  const commonFormulas = [
    { code: 'C20', name: 'Concrete C20' },
    { code: 'C25', name: 'Concrete C25' },
    { code: 'BRICK_150', name: 'Brick Wall 150mm' },
    { code: 'PLASTER_12', name: 'Plaster 12mm' },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-medium"
      >
        <Calculator size={16} />
        Formula
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
            {commonFormulas.map((formula) => (
              <button
                key={formula.code}
                type="button"
                onClick={() => {
                  onSelect(formula.code);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
              >
                <div className="font-medium">{formula.name}</div>
                <div className="text-xs text-gray-500">{formula.code}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * Stage dropdown for bulk assignment
 */
const StageDropdownButton: React.FC<{
  onSelect: (stage: ConstructionStage) => void;
}> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg text-sm font-medium"
      >
        <Tag size={16} />
        Stage
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
            {Object.values(ConstructionStage).map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => {
                  onSelect(stage);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
              >
                {stage.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BulkActionsBar;
