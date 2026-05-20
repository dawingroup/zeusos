/**
 * DELIVERY RECORDING FORM WITH PO LINKING
 *
 * Allows users to:
 * - Record material deliveries
 * - Link deliveries to purchase order items
 * - View PO fulfillment progress
 * - Track accepted/rejected quantities
 */

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { procurementService } from '../../services/procurement-service';
import type { PurchaseOrder, PurchaseOrderItem, DeliveryCondition } from '../../types/procurement';

// ============================================================================
// TYPES
// ============================================================================

interface DeliveryFormData {
  // PO Selection
  purchaseOrderId: string;
  poItemId: string;

  // Delivery Details
  quantityReceived: number;
  quantityAccepted: number;
  quantityRejected: number;
  deliveryDate: Date;
  deliveryCondition: DeliveryCondition;

  // Supplier Info (auto-filled from PO)
  supplierName: string;
  supplierContact?: string;

  // Additional Info
  externalReference?: string;
  deliveryLocation?: string;
  notes?: string;

  // Attachments
  attachmentFiles?: File[];
}

interface DeliveryRecordingFormProps {
  projectId: string;
  userId: string;
  onSuccess?: (deliveryId: string) => void;
  onCancel?: () => void;
  preselectedPOId?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const DeliveryRecordingForm: React.FC<DeliveryRecordingFormProps> = ({
  projectId,
  userId,
  onSuccess,
  onCancel,
  preselectedPOId
}) => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [selectedPOItem, setSelectedPOItem] = useState<PurchaseOrderItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<DeliveryFormData>({
    defaultValues: {
      deliveryDate: new Date(),
      deliveryCondition: 'good',
      quantityRejected: 0
    }
  });

  const watchPOId = watch('purchaseOrderId');
  const watchPOItemId = watch('poItemId');
  const watchQuantityReceived = watch('quantityReceived');
  const watchQuantityAccepted = watch('quantityAccepted');
  const watchQuantityRejected = watch('quantityRejected');

  // Load purchase orders on mount
  useEffect(() => {
    loadPurchaseOrders();
  }, [projectId]);

  // Set preselected PO
  useEffect(() => {
    if (preselectedPOId && purchaseOrders.length > 0) {
      setValue('purchaseOrderId', preselectedPOId);
    }
  }, [preselectedPOId, purchaseOrders]);

  // Load selected PO details
  useEffect(() => {
    if (watchPOId) {
      const po = purchaseOrders.find(p => p.id === watchPOId);
      setSelectedPO(po || null);

      if (po) {
        setValue('supplierName', po.supplierName);
      }
    } else {
      setSelectedPO(null);
    }
  }, [watchPOId, purchaseOrders]);

  // Load selected PO item details
  useEffect(() => {
    if (selectedPO && watchPOItemId) {
      const item = selectedPO.items.find(i => i.materialId === watchPOItemId);
      setSelectedPOItem(item || null);
    } else {
      setSelectedPOItem(null);
    }
  }, [watchPOItemId, selectedPO]);

  // Auto-calculate quantities
  useEffect(() => {
    if (watchQuantityReceived !== undefined && watchQuantityRejected !== undefined) {
      const accepted = watchQuantityReceived - watchQuantityRejected;
      if (accepted >= 0 && accepted !== watchQuantityAccepted) {
        setValue('quantityAccepted', accepted);
      }
    }
  }, [watchQuantityReceived, watchQuantityRejected]);

  /**
   * Load purchase orders for project
   */
  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      const pos = await procurementService.getPurchaseOrdersByProject(projectId);

      // Filter to approved POs only
      const approvedPOs = pos.filter((po: { status: string }) =>
        po.status === 'approved' ||
        po.status === 'partially_fulfilled'
      );

      setPurchaseOrders(approvedPOs);
    } catch (err) {
      console.error('Failed to load purchase orders:', err);
      setError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Submit delivery form
   */
  const onSubmit = async (data: DeliveryFormData) => {
    if (!selectedPO || !selectedPOItem) {
      setError('Please select a purchase order and item');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create procurement entry
      const deliveryId = await procurementService.createProcurementEntry(projectId, {
        type: 'delivery',
        materialId: selectedPOItem.materialId,
        materialName: selectedPOItem.materialName,
        unit: selectedPOItem.unit,
        quantityReceived: data.quantityReceived,
        quantityAccepted: data.quantityAccepted,
        quantityRejected: data.quantityRejected,
        unitPrice: selectedPOItem.unitPrice,
        supplierName: data.supplierName,
        supplierContact: data.supplierContact,
        deliveryDate: data.deliveryDate,
        deliveryCondition: data.deliveryCondition,
        boqItemIds: selectedPOItem.boqItemIds,
        externalReference: data.externalReference,
        deliveryLocation: data.deliveryLocation,
        notes: data.notes
      }, userId, userId);

      // Link delivery to PO
      await procurementService.linkDeliveryToPO(
        deliveryId,
        data.purchaseOrderId,
        data.poItemId,
        userId
      );

      // Success
      onSuccess?.(deliveryId);
    } catch (err) {
      console.error('Failed to record delivery:', err);
      setError(err instanceof Error ? err.message : 'Failed to record delivery');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calculate remaining quantity to deliver
   */
  const getRemainingQuantity = (item: PurchaseOrderItem): number => {
    return item.quantity - (item.deliveredQuantity || 0);
  };

  /**
   * Calculate fulfillment percentage
   */
  const getFulfillmentPercentage = (item: PurchaseOrderItem): number => {
    if (item.quantity === 0) return 0;
    return ((item.deliveredQuantity || 0) / item.quantity) * 100;
  };

  return (
    <div className="delivery-recording-form">
      <h2 className="text-2xl font-bold mb-6">Record Material Delivery</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Purchase Order Selection */}
        <div className="bg-white border rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold">Purchase Order Details</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purchase Order *
            </label>
            <select
              {...register('purchaseOrderId', { required: 'Purchase order is required' })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={loading}
            >
              <option value="">Select a purchase order</option>
              {purchaseOrders.map(po => (
                <option key={po.id} value={po.id}>
                  {po.orderNumber} - {po.supplierName} ({po.status})
                </option>
              ))}
            </select>
            {errors.purchaseOrderId && (
              <p className="text-red-600 text-sm mt-1">{errors.purchaseOrderId.message}</p>
            )}
          </div>

          {selectedPO && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Supplier:</span> {selectedPO.supplierName}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> {selectedPO.status}
                  </div>
                  <div>
                    <span className="font-medium">Total Amount:</span> {selectedPO.totalAmount.toLocaleString()} {selectedPO.currency}
                  </div>
                  <div>
                    <span className="font-medium">Items:</span> {selectedPO.items.length}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PO Item *
                </label>
                <select
                  {...register('poItemId', { required: 'PO item is required' })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select an item</option>
                  {selectedPO.items.map(item => (
                    <option key={item.materialId} value={item.materialId}>
                      {item.materialName} - {getRemainingQuantity(item)} {item.unit} remaining
                    </option>
                  ))}
                </select>
                {errors.poItemId && (
                  <p className="text-red-600 text-sm mt-1">{errors.poItemId.message}</p>
                )}
              </div>

              {selectedPOItem && (
                <div className="bg-gray-50 border border-gray-200 rounded p-4">
                  <h4 className="font-medium mb-3">Item Details</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Ordered:</span>
                      <span className="ml-2 font-medium">{selectedPOItem.quantity} {selectedPOItem.unit}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Unit Price:</span>
                      <span className="ml-2 font-medium">{selectedPOItem.unitPrice.toLocaleString()} {selectedPO.currency}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Delivered:</span>
                      <span className="ml-2 font-medium">{selectedPOItem.deliveredQuantity || 0} {selectedPOItem.unit}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Remaining:</span>
                      <span className="ml-2 font-medium">{getRemainingQuantity(selectedPOItem)} {selectedPOItem.unit}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600">Fulfillment:</span>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all"
                            style={{ width: `${getFulfillmentPercentage(selectedPOItem)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">
                          {getFulfillmentPercentage(selectedPOItem).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Delivery Quantities */}
        {selectedPOItem && (
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">Delivery Quantities</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity Received *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('quantityReceived', {
                    required: 'Quantity received is required',
                    min: { value: 0.01, message: 'Must be greater than 0' }
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="0"
                />
                {errors.quantityReceived && (
                  <p className="text-red-600 text-sm mt-1">{errors.quantityReceived.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity Rejected
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('quantityRejected', {
                    min: { value: 0, message: 'Cannot be negative' }
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="0"
                />
                {errors.quantityRejected && (
                  <p className="text-red-600 text-sm mt-1">{errors.quantityRejected.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity Accepted
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('quantityAccepted', {
                    required: 'Quantity accepted is required',
                    min: { value: 0, message: 'Cannot be negative' }
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">Auto-calculated</p>
              </div>
            </div>

            {watchQuantityReceived > getRemainingQuantity(selectedPOItem) && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded text-sm">
                ⚠️ Warning: Delivery quantity ({watchQuantityReceived}) exceeds remaining quantity ({getRemainingQuantity(selectedPOItem)})
              </div>
            )}
          </div>
        )}

        {/* Delivery Details */}
        {selectedPOItem && (
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">Delivery Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Date *
                </label>
                <input
                  type="date"
                  {...register('deliveryDate', { required: 'Delivery date is required' })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
                {errors.deliveryDate && (
                  <p className="text-red-600 text-sm mt-1">{errors.deliveryDate.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Condition *
                </label>
                <select
                  {...register('deliveryCondition', { required: 'Delivery condition is required' })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="good">Good</option>
                  <option value="partial">Partial</option>
                  <option value="damaged">Damaged</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  External Reference (e.g., Delivery Note #)
                </label>
                <input
                  type="text"
                  {...register('externalReference')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="DN-2026-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Location
                </label>
                <input
                  type="text"
                  {...register('deliveryLocation')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Site warehouse"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Additional delivery notes..."
              />
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={loading || !selectedPOItem}
          >
            {loading ? 'Recording...' : 'Record Delivery'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DeliveryRecordingForm;
