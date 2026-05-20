/**
 * Delivery Log Form Component
 * Form for logging material deliveries
 */

import React, { useState } from 'react';
import { X, Truck, Loader2, Package, Calendar } from 'lucide-react';
import { useCreateProcurement } from '../../hooks/useProcurement';
import type { CreateProcurementInput, DeliveryCondition, ProcurementType } from '../../types/procurement';

interface DeliveryLogFormProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const DeliveryLogForm: React.FC<DeliveryLogFormProps> = ({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { create, loading, error } = useCreateProcurement(projectId);
  
  const [formData, setFormData] = useState<Partial<CreateProcurementInput>>({
    type: 'delivery',
    materialId: '',
    materialName: '',
    unit: 'm³',
    quantityReceived: 0,
    quantityAccepted: 0,
    quantityRejected: 0,
    unitPrice: 0,
    supplierName: '',
    supplierContact: '',
    deliveryDate: new Date(),
    deliveryCondition: 'good',
    deliveryLocation: '',
    boqItemIds: [],
    externalReference: '',
    notes: '',
  });

  const handleInputChange = (field: keyof CreateProcurementInput, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-sync accepted to received
    if (field === 'quantityReceived') {
      setFormData(prev => ({ ...prev, quantityAccepted: value as number }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.materialName || !formData.supplierName || !formData.quantityReceived) {
      return;
    }

    const input: CreateProcurementInput = {
      type: formData.type as ProcurementType,
      materialId: formData.materialId || `mat-${Date.now()}`,
      materialName: formData.materialName!,
      unit: formData.unit || 'm³',
      quantityReceived: formData.quantityReceived!,
      quantityAccepted: formData.quantityAccepted || formData.quantityReceived!,
      quantityRejected: formData.quantityRejected || 0,
      unitPrice: formData.unitPrice || 0,
      supplierName: formData.supplierName!,
      supplierContact: formData.supplierContact,
      deliveryDate: formData.deliveryDate || new Date(),
      deliveryCondition: formData.deliveryCondition as DeliveryCondition,
      deliveryLocation: formData.deliveryLocation,
      boqItemIds: formData.boqItemIds || [],
      stageId: formData.stageId,
      externalReference: formData.externalReference,
      notes: formData.notes,
    };

    const result = await create(input);
    if (result) {
      onSuccess?.();
      onOpenChange(false);
      // Reset form
      setFormData({
        type: 'delivery',
        materialId: '',
        materialName: '',
        unit: 'm³',
        quantityReceived: 0,
        quantityAccepted: 0,
        quantityRejected: 0,
        unitPrice: 0,
        supplierName: '',
        deliveryDate: new Date(),
        deliveryCondition: 'good',
        boqItemIds: [],
      });
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
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">Log Material Delivery</h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error.message}
            </div>
          )}

          {/* Entry Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entry Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="delivery">Delivery</option>
              <option value="purchase_order">Purchase Order</option>
              <option value="stock_adjustment">Stock Adjustment</option>
              <option value="return">Return</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          {/* Material */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Material Name *
              </label>
              <div className="relative">
                <Package size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={formData.materialName}
                  onChange={(e) => handleInputChange('materialName', e.target.value)}
                  placeholder="e.g., Cement, Sand, Gravel"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit
              </label>
              <select
                value={formData.unit}
                onChange={(e) => handleInputChange('unit', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="m³">m³ (Cubic Meters)</option>
                <option value="m²">m² (Square Meters)</option>
                <option value="kg">kg (Kilograms)</option>
                <option value="t">t (Tonnes)</option>
                <option value="bags">bags</option>
                <option value="nr">nr (Number)</option>
                <option value="l.m">l.m (Linear Meters)</option>
              </select>
            </div>
          </div>

          {/* Quantities */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qty Received *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.quantityReceived || ''}
                onChange={(e) => handleInputChange('quantityReceived', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qty Accepted
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.quantityAccepted || ''}
                onChange={(e) => handleInputChange('quantityAccepted', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qty Rejected
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.quantityRejected || ''}
                onChange={(e) => handleInputChange('quantityRejected', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Price and Condition */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit Price (UGX) *
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={formData.unitPrice || ''}
                onChange={(e) => handleInputChange('unitPrice', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Condition
              </label>
              <select
                value={formData.deliveryCondition}
                onChange={(e) => handleInputChange('deliveryCondition', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="good">Good - Full & Quality OK</option>
                <option value="partial">Partial Delivery</option>
                <option value="damaged">Some Items Damaged</option>
                <option value="rejected">Full Rejection</option>
              </select>
            </div>
          </div>

          {/* Supplier */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier Name *
              </label>
              <input
                type="text"
                value={formData.supplierName}
                onChange={(e) => handleInputChange('supplierName', e.target.value)}
                placeholder="e.g., Hima Cement Ltd"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier Contact
              </label>
              <input
                type="text"
                value={formData.supplierContact}
                onChange={(e) => handleInputChange('supplierContact', e.target.value)}
                placeholder="Phone or email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Date and Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Date *
              </label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={formData.deliveryDate instanceof Date 
                    ? formData.deliveryDate.toISOString().split('T')[0] 
                    : new Date().toISOString().split('T')[0]}
                  onChange={(e) => handleInputChange('deliveryDate', new Date(e.target.value))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Location
              </label>
              <input
                type="text"
                value={formData.deliveryLocation}
                onChange={(e) => handleInputChange('deliveryLocation', e.target.value)}
                placeholder="e.g., Site A, Block 2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* External Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              External Reference (Invoice/DO Number)
            </label>
            <input
              type="text"
              value={formData.externalReference}
              onChange={(e) => handleInputChange('externalReference', e.target.value)}
              placeholder="Supplier invoice or delivery order number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes about this delivery..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>

          {/* Total Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Amount</span>
              <span className="text-lg font-bold text-gray-900">
                UGX {((formData.quantityAccepted || 0) * (formData.unitPrice || 0)).toLocaleString()}
              </span>
            </div>
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
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Log Delivery
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeliveryLogForm;
