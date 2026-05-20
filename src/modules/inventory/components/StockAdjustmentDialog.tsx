/**
 * StockAdjustmentDialog Component
 * Dialog for manually increasing or decreasing stock quantities at a warehouse.
 * Supports both pre-filled (from stock row click) and fresh (global button) usage.
 */

import { useState, useEffect } from 'react';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  X,
  CheckCircle,
  AlertTriangle,
  Package,
} from 'lucide-react';
import { adjustStock } from '../services/stockLevelService';
import { useAuth } from '@/contexts/AuthContext';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { useWarehouses } from '../hooks/useWarehouses';
import type { StockLevel } from '../types/warehouse';

type AdjustmentType = 'increase' | 'decrease';

interface StockAdjustmentDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-filled from a stock level row */
  stockLevel?: StockLevel | null;
  onSuccess?: () => void;
}

export function StockAdjustmentDialog({
  open,
  onClose,
  stockLevel,
  onSuccess,
}: StockAdjustmentDialogProps) {
  const { user } = useAuth();
  const { currentSubsidiary } = useSubsidiary();
  const { warehouses } = useWarehouses(currentSubsidiary?.id || null);

  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('increase');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset form when dialog opens/closes or stockLevel changes
  useEffect(() => {
    if (open) {
      setAdjustmentType('increase');
      setQuantity('');
      setReason('');
      setError(null);
      setSuccess(false);
    }
  }, [open, stockLevel?.id]);

  if (!open) return null;

  const warehouseName = stockLevel
    ? warehouses.find((w) => w.id === stockLevel.warehouseId)?.name || stockLevel.warehouseId
    : '';

  const currentOnHand = stockLevel?.quantityOnHand ?? 0;
  const currentAvailable = stockLevel?.quantityAvailable ?? 0;
  const numQuantity = typeof quantity === 'number' ? quantity : 0;

  const newOnHand =
    adjustmentType === 'increase'
      ? currentOnHand + numQuantity
      : currentOnHand - numQuantity;

  const canSubmit =
    numQuantity > 0 &&
    reason.trim().length > 0 &&
    stockLevel != null &&
    (adjustmentType === 'increase' || numQuantity <= currentAvailable);

  const handleSubmit = async () => {
    if (!user || !stockLevel || !canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const delta = adjustmentType === 'increase' ? numQuantity : -numQuantity;
      await adjustStock(
        stockLevel.inventoryItemId,
        stockLevel.warehouseId,
        stockLevel.sku,
        stockLevel.itemName,
        delta,
        user.uid,
        `[${adjustmentType === 'increase' ? 'Stock In' : 'Stock Out'}] ${reason.trim()}`,
      );
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setQuantity('');
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-blue-50">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Stock Adjustment</h2>
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
              <p className="text-lg font-medium text-gray-900">Stock Adjusted</p>
              <p className="text-sm text-gray-500 mt-1">
                {adjustmentType === 'increase' ? '+' : '-'}{numQuantity} units at{' '}
                {warehouseName}
              </p>
            </div>
          ) : (
            <>
              {/* Item Info */}
              {stockLevel && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">{stockLevel.itemName}</p>
                    <p className="text-gray-500 mt-0.5 font-mono text-xs">{stockLevel.sku}</p>
                    <p className="text-gray-500 mt-0.5">
                      Warehouse: <span className="font-medium">{warehouseName}</span>
                    </p>
                    <div className="flex gap-4 mt-1.5 text-xs">
                      <span>
                        On Hand: <span className="font-bold text-gray-900">{currentOnHand}</span>
                      </span>
                      <span>
                        Reserved:{' '}
                        <span className="font-bold text-amber-600">
                          {stockLevel.quantityReserved}
                        </span>
                      </span>
                      <span>
                        Available:{' '}
                        <span className="font-bold text-green-600">{currentAvailable}</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Adjustment Type Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('increase')}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                      adjustmentType === 'increase'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    Stock In (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('decrease')}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                      adjustmentType === 'decrease'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <ArrowDownCircle className="w-4 h-4" />
                    Stock Out (-)
                  </button>
                </div>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  max={adjustmentType === 'decrease' ? currentAvailable : undefined}
                  value={quantity}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                    setQuantity(val);
                  }}
                  placeholder="Enter quantity"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                {adjustmentType === 'decrease' && numQuantity > currentAvailable && (
                  <p className="text-xs text-red-600 mt-1">
                    Cannot decrease more than available stock ({currentAvailable})
                  </p>
                )}
                {numQuantity > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    New on-hand will be: <span className="font-bold">{newOnHand}</span>
                  </p>
                )}
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
                  placeholder={
                    adjustmentType === 'increase'
                      ? 'e.g., Physical count correction, returned goods, opening balance...'
                      : 'e.g., Damaged/spoiled stock, physical count correction, sample taken...'
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Decrease warning */}
              {adjustmentType === 'decrease' && numQuantity > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    This will permanently remove {numQuantity} unit(s) from stock. This action is
                    recorded in the movement history for audit.
                  </p>
                </div>
              )}

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
              disabled={submitting || !canSubmit}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                adjustmentType === 'increase'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : adjustmentType === 'increase' ? (
                <ArrowUpCircle className="w-4 h-4" />
              ) : (
                <ArrowDownCircle className="w-4 h-4" />
              )}
              {adjustmentType === 'increase' ? 'Add' : 'Remove'}{' '}
              {numQuantity > 0 ? `${numQuantity} units` : 'Stock'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default StockAdjustmentDialog;
