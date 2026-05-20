/**
 * SupplierPricingManager Component
 * Manage multiple supplier pricing for an inventory item
 * Enhanced with supplier performance metrics from unified supplier module
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2, Star, StarOff, Edit2, Loader2, Building2, Clock, Package, TrendingUp, Award, Shield, Tag } from 'lucide-react';
import { SupplierPicker } from '@/modules/procurement/components/SupplierPicker';
import { getSupplier } from '@/modules/suppliers';
import type { Supplier } from '@/modules/suppliers';
import type { SupplierInventoryPricing, SupplierPricingFormData } from '../types';

interface SupplierPricingManagerProps {
  supplierPricing: SupplierInventoryPricing[];
  preferredSupplierId?: string;
  onAddSupplier: (pricing: SupplierPricingFormData, setPreferred: boolean) => Promise<void>;
  onRemoveSupplier: (supplierId: string) => Promise<void>;
  onSetPreferred: (supplierId: string) => Promise<void>;
  disabled?: boolean;
  currency?: string;
  subsidiaryId?: string;
}

const CURRENCIES = ['UGX', 'KES', 'USD'];

export function SupplierPricingManager({
  supplierPricing,
  preferredSupplierId: _preferredSupplierId, // Available for future use
  onAddSupplier,
  onRemoveSupplier,
  onSetPreferred,
  disabled = false,
  currency: defaultCurrency = 'UGX',
  subsidiaryId,
}: SupplierPricingManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Supplier performance data from unified module
  const [supplierDetails, setSupplierDetails] = useState<Record<string, Supplier | null>>({});

  // Fetch supplier details for performance metrics
  useEffect(() => {
    const fetchSupplierDetails = async () => {
      const details: Record<string, Supplier | null> = {};
      for (const sp of supplierPricing) {
        if (!supplierDetails[sp.supplierId]) {
          try {
            const supplier = await getSupplier(sp.supplierId);
            details[sp.supplierId] = supplier;
          } catch {
            details[sp.supplierId] = null;
          }
        }
      }
      if (Object.keys(details).length > 0) {
        setSupplierDetails((prev) => ({ ...prev, ...details }));
      }
    };
    fetchSupplierDetails();
  }, [supplierPricing]);

  // Form state
  const [supplierValue, setSupplierValue] = useState<{ supplierId: string; supplierName: string } | null>(null);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [minimumOrder, setMinimumOrder] = useState<number | ''>('');
  const [leadTimeDays, setLeadTimeDays] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [setAsPreferred, setSetAsPreferred] = useState(false);
  const [qualityTier, setQualityTier] = useState<'' | 'economy' | 'standard' | 'premium' | 'luxury'>('');
  const [supplierBrand, setSupplierBrand] = useState('');
  const [certifications, setCertifications] = useState('');
  const [bulkDiscountThreshold, setBulkDiscountThreshold] = useState<number | ''>('');
  const [bulkDiscountPrice, setBulkDiscountPrice] = useState<number | ''>('');

  const QUALITY_TIERS = [
    { value: '', label: 'Not specified' },
    { value: 'economy', label: 'Economy' },
    { value: 'standard', label: 'Standard' },
    { value: 'premium', label: 'Premium' },
    { value: 'luxury', label: 'Luxury' },
  ];

  const resetForm = () => {
    setSupplierValue(null);
    setUnitPrice(0);
    setCurrency(defaultCurrency);
    setMinimumOrder('');
    setLeadTimeDays('');
    setNotes('');
    setSetAsPreferred(false);
    setQualityTier('');
    setSupplierBrand('');
    setCertifications('');
    setBulkDiscountThreshold('');
    setBulkDiscountPrice('');
    setShowAddForm(false);
    setEditingId(null);
    setError(null);
  };

  const handleAddSupplier = async () => {
    if (!supplierValue) {
      setError('Please select a supplier');
      return;
    }

    if (unitPrice <= 0) {
      setError('Unit price must be greater than 0');
      return;
    }

    // Check if supplier already exists
    const existing = supplierPricing.find((sp) => sp.supplierId === supplierValue.supplierId);
    if (existing && !editingId) {
      setError('This supplier already exists. Use edit to update.');
      return;
    }

    setLoading('add');
    setError(null);

    try {
      await onAddSupplier(
        {
          supplierId: supplierValue.supplierId,
          supplierName: supplierValue.supplierName,
          unitPrice,
          currency,
          minimumOrder: minimumOrder || undefined,
          leadTimeDays: leadTimeDays || undefined,
          notes: notes.trim() || undefined,
          qualityTier: qualityTier || undefined,
          brand: supplierBrand.trim() || undefined,
          certifications: certifications.trim()
            ? certifications.split(',').map(c => c.trim()).filter(Boolean)
            : undefined,
          bulkDiscountThreshold: bulkDiscountThreshold || undefined,
          bulkDiscountPrice: bulkDiscountPrice || undefined,
        },
        setAsPreferred
      );
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add supplier');
    } finally {
      setLoading(null);
    }
  };

  const handleRemoveSupplier = async (supplierId: string) => {
    if (!confirm('Are you sure you want to remove this supplier?')) return;

    setLoading(supplierId);
    setError(null);

    try {
      await onRemoveSupplier(supplierId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove supplier');
    } finally {
      setLoading(null);
    }
  };

  const handleSetPreferred = async (supplierId: string) => {
    setLoading(supplierId);
    setError(null);

    try {
      await onSetPreferred(supplierId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set preferred supplier');
    } finally {
      setLoading(null);
    }
  };

  const handleEditSupplier = (supplier: SupplierInventoryPricing) => {
    setSupplierValue({ supplierId: supplier.supplierId, supplierName: supplier.supplierName });
    setUnitPrice(supplier.unitPrice);
    setCurrency(supplier.currency);
    setMinimumOrder(supplier.minimumOrder || '');
    setLeadTimeDays(supplier.leadTimeDays || '');
    setNotes(supplier.notes || '');
    setSetAsPreferred(supplier.isPreferred);
    setQualityTier(supplier.qualityTier || '');
    setSupplierBrand(supplier.brand || '');
    setCertifications(supplier.certifications?.join(', ') || '');
    setBulkDiscountThreshold(supplier.bulkDiscountThreshold || '');
    setBulkDiscountPrice(supplier.bulkDiscountPrice || '');
    setEditingId(supplier.supplierId);
    setShowAddForm(true);
  };

  const formatCurrency = (amount: number, curr: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr === 'UGX' ? 'UGX' : curr === 'KES' ? 'KES' : 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
          Supplier Pricing
        </h3>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            disabled={disabled}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Supplier
          </button>
        )}
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Supplier *
              </label>
              <SupplierPicker
                value={supplierValue}
                onChange={setSupplierValue}
                subsidiaryId={subsidiaryId}
                label=""
                disabled={!!editingId}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Unit Price *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Minimum Order
              </label>
              <input
                type="number"
                min="0"
                value={minimumOrder}
                onChange={(e) => setMinimumOrder(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Lead Time (days)
              </label>
              <input
                type="number"
                min="0"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                placeholder="Optional"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              placeholder="Optional notes about this supplier"
            />
          </div>

          {/* Enhanced Requirements */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Quality Tier
              </label>
              <select
                value={qualityTier}
                onChange={(e) => setQualityTier(e.target.value as '' | 'economy' | 'standard' | 'premium' | 'luxury')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              >
                {QUALITY_TIERS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Brand (from this supplier)
              </label>
              <input
                type="text"
                value={supplierBrand}
                onChange={(e) => setSupplierBrand(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                placeholder="e.g., Egger, Formica"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Certifications (comma-separated)
            </label>
            <input
              type="text"
              value={certifications}
              onChange={(e) => setCertifications(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              placeholder="e.g., FSC, CARB2, ISO-9001"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Bulk Discount Threshold (qty)
              </label>
              <input
                type="number"
                min="0"
                value={bulkDiscountThreshold}
                onChange={(e) => setBulkDiscountThreshold(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                placeholder="Min qty for discount"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Bulk Discount Price
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={bulkDiscountPrice}
                onChange={(e) => setBulkDiscountPrice(e.target.value ? parseFloat(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                placeholder="Discounted unit price"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={setAsPreferred}
              onChange={(e) => setSetAsPreferred(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            Set as preferred supplier
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddSupplier}
              disabled={loading === 'add'}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {loading === 'add' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              {editingId ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Supplier List */}
      {supplierPricing.length === 0 && !showAddForm ? (
        <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
          No suppliers added yet. Click "Add Supplier" to add pricing from different suppliers.
        </div>
      ) : (
        <div className="space-y-2">
          {supplierPricing.map((supplier) => (
            <div
              key={supplier.supplierId}
              className={`flex items-center justify-between p-3 border rounded-lg ${
                supplier.isPreferred
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Building2
                  className={`w-5 h-5 flex-shrink-0 ${
                    supplier.isPreferred ? 'text-amber-600' : 'text-gray-400'
                  }`}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 truncate">
                      {supplier.supplierName}
                    </span>
                    {supplier.isPreferred && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 rounded">
                        <Star className="w-3 h-3" />
                        Preferred
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(supplier.unitPrice, supplier.currency)}
                    </span>
                    {supplier.leadTimeDays && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {supplier.leadTimeDays}d
                      </span>
                    )}
                    {supplier.minimumOrder && (
                      <span className="flex items-center gap-0.5">
                        <Package className="w-3 h-3" />
                        Min: {supplier.minimumOrder}
                      </span>
                    )}
                    {supplier.qualityTier && (
                      <span className="flex items-center gap-0.5 text-indigo-600">
                        <Shield className="w-3 h-3" />
                        {supplier.qualityTier}
                      </span>
                    )}
                    {supplier.brand && (
                      <span className="flex items-center gap-0.5 text-gray-600">
                        <Tag className="w-3 h-3" />
                        {supplier.brand}
                      </span>
                    )}
                    {/* Performance metrics from unified supplier module */}
                    {supplierDetails[supplier.supplierId]?.rating && (
                      <span className="flex items-center gap-0.5 text-amber-600">
                        <Award className="w-3 h-3" />
                        {supplierDetails[supplier.supplierId]?.rating?.toFixed(1)}
                      </span>
                    )}
                    {supplierDetails[supplier.supplierId]?.onTimeDeliveryRate && (
                      <span className="flex items-center gap-0.5 text-green-600">
                        <TrendingUp className="w-3 h-3" />
                        {Math.round(supplierDetails[supplier.supplierId]?.onTimeDeliveryRate ?? 0)}% on-time
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {!supplier.isPreferred && (
                  <button
                    type="button"
                    onClick={() => handleSetPreferred(supplier.supplierId)}
                    disabled={disabled || loading === supplier.supplierId}
                    className="p-1.5 text-gray-400 hover:text-amber-600 rounded hover:bg-amber-50 disabled:opacity-50"
                    title="Set as preferred"
                  >
                    {loading === supplier.supplierId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <StarOff className="w-4 h-4" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleEditSupplier(supplier)}
                  disabled={disabled}
                  className="p-1.5 text-gray-400 hover:text-primary rounded hover:bg-gray-100 disabled:opacity-50"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveSupplier(supplier.supplierId)}
                  disabled={disabled || loading === supplier.supplierId}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                  title="Remove"
                >
                  {loading === supplier.supplierId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SupplierPricingManager;
