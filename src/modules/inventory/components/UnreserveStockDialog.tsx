/**
 * UnreserveStockDialog Component
 * Allows admin users to manually release reserved stock from an inventory item
 * at a specific warehouse location, with quantity and reason inputs.
 */

import { useState } from 'react';
import { Unlock, AlertTriangle, Loader2, X, CheckCircle } from 'lucide-react';
import { manualUnreserveStock } from '../services/stockLevelService';
import { useAuth } from '@/contexts/AuthContext';

interface UnreserveStockDialogProps {
  open: boolean;
  onClose: () => void;
  inventoryItemId: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  currentReserved: number;
  onSuccess: () => void;
}

export function UnreserveStockDialog({
  open,
  onClose,
  inventoryItemId,
  itemName,
  warehouseId,
  warehouseName,
  currentReserved,
  onSuccess,
}: UnreserveStockDialogProps) {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState<number>(currentReserved);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!user) return;

    // Validate
    if (quantity <= 0) {
      setError('Quantity must be greater than zero');
      return;
    }
    if (quantity > currentReserved) {
      setError(`Cannot unreserve more than ${currentReserved} (currently reserved)`);
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for the unreserve action');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await manualUnreserveStock(
        inventoryItemId,
        warehouseId,
        quantity,
        user.uid,
        reason.trim(),
      );
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unreserve stock');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setQuantity(currentReserved);
    setReason('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-amber-50">
          <div className="flex items-center gap-2">
            <Unlock className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">Unreserve Stock</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Success state */}
          {success ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
              <p className="text-lg font-medium text-gray-900">Stock Unreserved</p>
              <p className="text-sm text-gray-500 mt-1">
                {quantity} units released at {warehouseName}
              </p>
            </div>
          ) : (
            <>
              {/* Item Info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{itemName}</p>
                  <p className="text-gray-500 mt-0.5">
                    Warehouse: <span className="font-medium">{warehouseName}</span>
                  </p>
                  <p className="text-amber-700 mt-0.5">
                    Currently reserved: <span className="font-bold">{currentReserved}</span> units
                  </p>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  This will release reserved materials back to available stock. Any linked
                  Manufacturing Orders may no longer have sufficient material allocation.
                </p>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity to Unreserve
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={currentReserved}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.min(Number(e.target.value), currentReserved))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(currentReserved)}
                    className="px-3 py-2 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200"
                  >
                    All ({currentReserved})
                  </button>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="e.g., MO was cancelled but reservations weren't released, incorrect reservation amount, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !reason.trim() || quantity <= 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Unlock className="w-4 h-4" />
              )}
              Unreserve {quantity > 0 ? `${quantity} units` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default UnreserveStockDialog;
