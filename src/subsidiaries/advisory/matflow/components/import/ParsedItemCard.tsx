/**
 * Parsed Item Card Component
 * Individual review card for a parsed BOQ item
 */

import React, { useState, useCallback } from 'react';
import {
  Check,
  X,
  Edit2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import {
  type ReviewableItem,
  type ReviewStatus,
  getCurrentItemState,
  validateItemForImport,
  hasModifications,
  ConstructionStage,
  MeasurementUnit,
} from '../../utils/reviewHelpers';

interface ParsedItemCardProps {
  item: ReviewableItem;
  onUpdateItem: (reviewId: string, updates: Partial<ReviewableItem>) => void;
  onApprove: (reviewId: string) => void;
  onReject: (reviewId: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (reviewId: string) => void;
}

export const ParsedItemCard: React.FC<ParsedItemCardProps> = ({
  item,
  onUpdateItem,
  onApprove,
  onReject,
  isSelected = false,
  onToggleSelect,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const currentState = getCurrentItemState(item);
  const validation = validateItemForImport(item);
  const modified = hasModifications(item);

  const handleFieldChange = useCallback((field: string, value: unknown) => {
    onUpdateItem(item.reviewId, {
      modifications: {
        ...item.modifications,
        [field]: value,
      },
      reviewStatus: 'modified',
    });
  }, [item, onUpdateItem]);

  const handleResetChanges = useCallback(() => {
    onUpdateItem(item.reviewId, {
      modifications: {},
      reviewStatus: 'pending',
    });
  }, [item.reviewId, onUpdateItem]);

  // Status indicator styles
  const statusStyles: Record<ReviewStatus, string> = {
    pending: 'border-gray-200 bg-white',
    approved: 'border-green-200 bg-green-50',
    rejected: 'border-red-200 bg-red-50',
    modified: 'border-amber-200 bg-amber-50',
  };

  return (
    <div
      className={`
        border-2 rounded-lg transition-all duration-200
        ${statusStyles[item.reviewStatus]}
        ${isSelected ? 'ring-2 ring-blue-500' : ''}
      `}
    >
      {/* Header Row */}
      <div className="flex items-center gap-3 p-4">
        {/* Selection checkbox */}
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(item.reviewId)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
        )}

        {/* Item code */}
        <div className="w-24">
          {isEditing ? (
            <input
              type="text"
              value={currentState.itemCode}
              onChange={(e) => handleFieldChange('itemCode', e.target.value)}
              className="w-full px-2 py-1 border rounded text-sm"
            />
          ) : (
            <span className="font-mono text-sm font-medium text-gray-700">
              {currentState.itemCode}
            </span>
          )}
        </div>

        {/* Description */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={currentState.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              className="w-full px-2 py-1 border rounded text-sm"
            />
          ) : (
            <p className="text-sm text-gray-900 truncate" title={currentState.description}>
              {currentState.description}
            </p>
          )}
        </div>

        {/* Quantity & Unit */}
        <div className="flex items-center gap-1 w-32">
          {isEditing ? (
            <>
              <input
                type="number"
                value={currentState.quantity}
                onChange={(e) => handleFieldChange('quantity', parseFloat(e.target.value))}
                className="w-16 px-2 py-1 border rounded text-sm text-right"
                step="0.01"
              />
              <select
                value={currentState.unit}
                onChange={(e) => handleFieldChange('unit', e.target.value)}
                className="w-16 px-1 py-1 border rounded text-sm"
              >
                {Object.values(MeasurementUnit).map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </>
          ) : (
            <span className="text-sm font-medium text-gray-700">
              {currentState.quantity?.toLocaleString()} {currentState.unit}
            </span>
          )}
        </div>

        {/* Confidence */}
        <ConfidenceIndicator
          score={currentState.confidence || 0}
          size="sm"
        />

        {/* Status badge */}
        <StatusBadge status={item.reviewStatus} modified={modified} />

        {/* Actions */}
        <div className="flex items-center gap-1">
          {item.reviewStatus !== 'approved' && (
            <>
              <button
                type="button"
                onClick={() => onApprove(item.reviewId)}
                disabled={!validation.isValid}
                className={`
                  p-1.5 rounded-lg transition-colors
                  ${validation.isValid
                    ? 'text-green-600 hover:bg-green-100'
                    : 'text-gray-300 cursor-not-allowed'
                  }
                `}
                title={validation.isValid ? 'Approve' : 'Fix errors to approve'}
              >
                <Check size={18} />
              </button>
              <button
                type="button"
                onClick={() => onReject(item.reviewId)}
                className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg"
                title="Reject"
              >
                <X size={18} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`
              p-1.5 rounded-lg transition-colors
              ${isEditing
                ? 'text-blue-600 bg-blue-100'
                : 'text-gray-400 hover:bg-gray-100'
              }
            `}
            title="Edit"
          >
            <Edit2 size={18} />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Validation Errors/Warnings */}
      {(!validation.isValid || validation.warnings.length > 0) && (
        <div className="px-4 pb-2">
          {validation.errors.map((error, idx) => (
            <div key={idx} className="flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle size={12} />
              {error}
            </div>
          ))}
          {validation.warnings.map((warning, idx) => (
            <div key={idx} className="flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle size={12} />
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 mt-2 pt-3 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Rate */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Rate (UGX)
              </label>
              {isEditing ? (
                <input
                  type="number"
                  value={currentState.rate || ''}
                  onChange={(e) => handleFieldChange('rate', parseFloat(e.target.value))}
                  className="w-full px-2 py-1 border rounded text-sm"
                />
              ) : (
                <span className="text-sm">
                  {currentState.rate?.toLocaleString() || '-'}
                </span>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Amount (UGX)
              </label>
              <span className="text-sm font-medium">
                {(currentState.amount || (currentState.quantity * (currentState.rate || 0)))?.toLocaleString()}
              </span>
            </div>

            {/* Stage */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Construction Stage
              </label>
              {isEditing ? (
                <select
                  value={currentState.stage || ''}
                  onChange={(e) => handleFieldChange('stage', e.target.value)}
                  className="w-full px-2 py-1 border rounded text-sm"
                >
                  <option value="">Select stage...</option>
                  {Object.values(ConstructionStage).map((stage) => (
                    <option key={stage} value={stage}>{stage.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm">{currentState.stage?.replace(/_/g, ' ') || '-'}</span>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Category
              </label>
              <span className="text-sm">{currentState.category || '-'}</span>
            </div>
          </div>

          {/* Formula */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Formula Code
            </label>
            {isEditing ? (
              <input
                type="text"
                value={currentState.suggestedFormulaCode || ''}
                onChange={(e) => handleFieldChange('suggestedFormulaCode', e.target.value)}
                className="w-full px-2 py-1 border rounded text-sm"
                placeholder="e.g., C25, BRICK_150"
              />
            ) : (
              <span className="text-sm">{currentState.suggestedFormulaCode || 'Not assigned'}</span>
            )}
          </div>

          {/* Raw text from document */}
          {currentState.rawText && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Original Text
              </label>
              <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded font-mono">
                {currentState.rawText}
              </p>
            </div>
          )}

          {/* AI Warnings */}
          {currentState.warnings && currentState.warnings.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                AI Notes
              </label>
              <ul className="text-xs text-amber-600 space-y-1">
                {currentState.warnings.map((warning, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          {modified && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={handleResetChanges}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                <RotateCcw size={12} />
                Reset changes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Status badge component
 */
const StatusBadge: React.FC<{ status: ReviewStatus; modified: boolean }> = ({
  status,
  modified,
}) => {
  const config = {
    pending: { label: 'Pending', bg: 'bg-gray-100', text: 'text-gray-600' },
    approved: { label: 'Approved', bg: 'bg-green-100', text: 'text-green-700' },
    rejected: { label: 'Rejected', bg: 'bg-red-100', text: 'text-red-700' },
    modified: { label: 'Modified', bg: 'bg-amber-100', text: 'text-amber-700' },
  };

  const { label, bg, text } = config[status];

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>
      {modified && status === 'pending' ? 'Modified' : label}
    </span>
  );
};

export default ParsedItemCard;
