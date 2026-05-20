/**
 * Quality Check Dialog
 * Dialog for performing quality checks on deliveries
 */

import React, { useState } from 'react';
import { X, ClipboardCheck, Package, AlertCircle, Loader2 } from 'lucide-react';
import { useQualityCheck } from '../../hooks/useProcurement';
import type { ProcurementEntry, DeliveryCondition } from '../../types/procurement';

interface QualityCheckDialogProps {
  projectId: string;
  entry: ProcurementEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const QualityCheckDialog: React.FC<QualityCheckDialogProps> = ({
  projectId,
  entry,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { check, loading, error } = useQualityCheck(projectId);
  
  const [quantityAccepted, setQuantityAccepted] = useState(entry.quantityReceived);
  const [quantityRejected, setQuantityRejected] = useState(0);
  const [condition, setCondition] = useState<DeliveryCondition>('good');
  const [notes, setNotes] = useState('');

  const totalChecked = quantityAccepted + quantityRejected;
  const isOverChecked = totalChecked > entry.quantityReceived;
  const isUnderChecked = totalChecked < entry.quantityReceived;
  const uncheckedQty = entry.quantityReceived - totalChecked;
  const newTotalAmount = quantityAccepted * entry.unitPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isOverChecked) return;
    
    const success = await check(entry.id, {
      quantityAccepted,
      quantityRejected,
      condition,
      notes: notes || undefined,
    });
    
    if (success) {
      onSuccess?.();
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={() => onOpenChange(false)}
      />
      
      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">Quality Check</h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Entry Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-900">{entry.materialName}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Received:</span>
                <span className="ml-2 font-medium">{entry.quantityReceived} {entry.unit}</span>
              </div>
              <div>
                <span className="text-gray-500">Supplier:</span>
                <span className="ml-2">{entry.supplierName}</span>
              </div>
              <div>
                <span className="text-gray-500">Unit Price:</span>
                <span className="ml-2">UGX {entry.unitPrice.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500">Reference:</span>
                <span className="ml-2 font-mono text-xs">{entry.referenceNumber}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error.message}
            </div>
          )}

          {/* Quantities */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-green-700 mb-1">
                Quantity Accepted
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={quantityAccepted}
                onChange={(e) => setQuantityAccepted(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-red-700 mb-1">
                Quantity Rejected
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={quantityRejected}
                onChange={(e) => setQuantityRejected(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Validation Messages */}
          {isOverChecked && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={14} />
              Total checked ({totalChecked}) exceeds received ({entry.quantityReceived})
            </div>
          )}
          
          {isUnderChecked && uncheckedQty > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertCircle size={14} />
              {uncheckedQty} {entry.unit} not accounted for
            </div>
          )}

          {/* Condition */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Overall Condition
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as DeliveryCondition)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="good">Good - Full quantity, quality OK</option>
              <option value="partial">Partial - Incomplete delivery</option>
              <option value="damaged">Damaged - Some items damaged</option>
              <option value="rejected">Rejected - Full rejection</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quality Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe any quality issues, damage, etc."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>

          {/* New Total */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">New Total Amount</span>
              <span className="text-lg font-bold text-gray-900">
                UGX {newTotalAmount.toLocaleString()}
              </span>
            </div>
            {newTotalAmount !== entry.totalAmount && (
              <div className="text-xs text-gray-500 mt-1">
                Original: UGX {entry.totalAmount.toLocaleString()}
                <span className="mx-1">→</span>
                Change: UGX {(newTotalAmount - entry.totalAmount).toLocaleString()}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isOverChecked}
              className="flex items-center gap-2 px-6 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Complete Check
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QualityCheckDialog;
