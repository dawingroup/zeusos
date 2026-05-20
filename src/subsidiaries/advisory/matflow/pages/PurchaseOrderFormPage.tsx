/**
 * Purchase Order Form Page
 * Create a new purchase order
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Save,
  Send,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useActiveSuppliers, usePurchaseOrderMutations } from '../hooks/procurement-hooks';
import { useAuth } from '@/shared/hooks';
import type { PurchaseOrder } from '../types/procurement';

interface POItemInput {
  materialId: string;
  materialName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  boqItemIds: string[];
}

const COMMON_UNITS = ['bags', 'kg', 't', 'm³', 'm²', 'l.m', 'nr', 'l', 'pcs'];

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const PurchaseOrderFormPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { suppliers, loading: suppliersLoading } = useActiveSuppliers();
  const { createPO, submitPO, loading: saving } = usePurchaseOrderMutations();

  // Form state
  const [supplierName, setSupplierName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<POItemInput[]>([
    { materialId: '', materialName: '', unit: 'bags', quantity: 0, unitPrice: 0, boqItemIds: [] },
  ]);

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = Math.round(subtotal * 0.18); // 18% VAT
  const totalAmount = subtotal + taxAmount;

  const handleAddItem = () => {
    setItems([...items, { materialId: '', materialName: '', unit: 'bags', quantity: 0, unitPrice: 0, boqItemIds: [] }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof POItemInput, value: string | number) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    setItems(updated);
  };

  const handleSupplierSelect = (selectedSupplierId: string) => {
    setSupplierId(selectedSupplierId);
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (supplier) {
      setSupplierName(supplier.name);
    }
  };

  const isValid = (): boolean => {
    if (!supplierName.trim()) return false;
    if (items.length === 0) return false;
    return items.every(item =>
      item.materialName.trim() &&
      item.quantity > 0 &&
      item.unitPrice > 0
    );
  };

  const buildPOData = (): Omit<PurchaseOrder, 'id' | 'orderNumber' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt'> => ({
    projectId: projectId!,
    supplierId: supplierId || undefined,
    supplierName,
    items: items.map((item): any => ({
      materialId: item.materialId || item.materialName.toLowerCase().replace(/\s+/g, '_'),
      materialName: item.materialName,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.quantity * item.unitPrice,
      boqItemIds: item.boqItemIds,
      deliveredQuantity: 0,
      acceptedQuantity: 0,
    })),
    subtotal,
    taxAmount,
    totalAmount,
    currency: 'UGX' as const,
    deliveryAddress: deliveryAddress || undefined,
    expectedDeliveryDate: expectedDeliveryDate ? Timestamp.fromDate(new Date(expectedDeliveryDate)) : undefined,
    notes: notes || undefined,
  });

  const handleSaveDraft = async () => {
    if (!user || !projectId) return;
    try {
      await createPO(buildPOData(), user.uid);
      navigate(`/advisory/delivery/projects/${projectId}/purchase-orders`);
    } catch (err) {
      console.error('Failed to create PO:', err);
      alert('Failed to save purchase order.');
    }
  };

  const handleSaveAndSubmit = async () => {
    if (!user || !projectId) return;
    try {
      const poId = await createPO(buildPOData(), user.uid);
      if (poId) {
        await submitPO(poId, user.uid);
      }
      navigate(`/advisory/delivery/projects/${projectId}/purchase-orders`);
    } catch (err) {
      console.error('Failed to create & submit PO:', err);
      alert('Failed to submit purchase order.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Purchase Order</h1>
          <p className="text-muted-foreground">Create a purchase order for materials</p>
        </div>
      </div>

      {/* Supplier Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4">Supplier</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Supplier
            </label>
            {suppliersLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading suppliers...
              </div>
            ) : suppliers.length > 0 ? (
              <select
                value={supplierId}
                onChange={e => handleSupplierSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Or Enter Supplier Name
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={e => setSupplierName(e.target.value)}
              placeholder="Supplier name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-semibold text-gray-900">Order Items</h3>
          <button
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-4">
                {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Material</label>}
                <input
                  type="text"
                  value={item.materialName}
                  onChange={e => handleItemChange(index, 'materialName', e.target.value)}
                  placeholder="Material name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>}
                <input
                  type="number"
                  value={item.quantity || ''}
                  onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="col-span-1">
                {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>}
                <select
                  value={item.unit}
                  onChange={e => handleItemChange(index, 'unit', e.target.value)}
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {COMMON_UNITS.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Unit Price (UGX)</label>}
                <input
                  type="number"
                  value={item.unitPrice || ''}
                  onChange={e => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="col-span-2 text-right">
                {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Amount</label>}
                <p className="py-2 text-sm font-medium text-gray-900">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </p>
              </div>
              <div className="col-span-1">
                {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">&nbsp;</label>}
                <button
                  onClick={() => handleRemoveItem(index)}
                  disabled={items.length <= 1}
                  className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">VAT (18%):</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <hr className="border-gray-200" />
              <div className="flex justify-between font-semibold">
                <span>Total:</span>
                <span className="text-blue-600">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4">Delivery Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Address
            </label>
            <input
              type="text"
              value={deliveryAddress}
              onChange={e => setDeliveryAddress(e.target.value)}
              placeholder="Site address"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expected Delivery Date
            </label>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={e => setExpectedDeliveryDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveDraft}
          disabled={!isValid() || saving}
          className="inline-flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Draft
        </button>
        <button
          onClick={handleSaveAndSubmit}
          disabled={!isValid() || saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Save & Submit
        </button>
      </div>
    </div>
  );
};

export default PurchaseOrderFormPage;
