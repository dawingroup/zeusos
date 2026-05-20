/**
 * VendorSourceManager Component
 * Manages vendor sources (MPN-decoupled) for an inventory item.
 * Each vendor source has its own MPN, pricing, and lead time.
 */

import { useState } from 'react';
import {
  Plus,
  Trash2,
  Star,
  StarOff,
  Loader2,
  Building2,
  Clock,
  Package,
  Shield,
  Tag,
  ExternalLink,
  Hash,
} from 'lucide-react';
import { SupplierPicker } from '@/modules/procurement/components/SupplierPicker';
import type { VendorSource, InventoryUnit } from '../types';

interface VendorSourceManagerProps {
  vendorSources: VendorSource[];
  onAdd: (source: Omit<VendorSource, 'id' | 'addedAt' | 'addedBy'>) => Promise<void>;
  onRemove: (sourceId: string) => Promise<void>;
  onSetPreferred: (sourceId: string) => Promise<void>;
  disabled?: boolean;
  defaultCurrency?: string;
  defaultUnit?: InventoryUnit;
}

const CURRENCIES = ['UGX', 'KES', 'USD', 'EUR', 'GBP', 'AED', 'ZAR'];

export function VendorSourceManager({
  vendorSources,
  onAdd,
  onRemove,
  onSetPreferred,
  disabled = false,
  defaultCurrency = 'UGX',
  defaultUnit = 'ea',
}: VendorSourceManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [supplierValue, setSupplierValue] = useState<{ supplierId: string; supplierName: string } | null>(null);
  const [mpn, setMpn] = useState('');
  const [supplierSku, setSupplierSku] = useState('');
  const [brandName, setBrandName] = useState('');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [minimumOrder, setMinimumOrder] = useState<number | ''>('');
  const [leadTimeDays, setLeadTimeDays] = useState<number | ''>('');
  const [qualityTier, setQualityTier] = useState<'' | 'economy' | 'standard' | 'premium' | 'luxury'>('');
  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');
  const [setAsPreferred, setSetAsPreferred] = useState(false);

  const resetForm = () => {
    setSupplierValue(null);
    setMpn('');
    setSupplierSku('');
    setBrandName('');
    setUnitPrice(0);
    setCurrency(defaultCurrency);
    setMinimumOrder('');
    setLeadTimeDays('');
    setQualityTier('');
    setNotes('');
    setUrl('');
    setSetAsPreferred(false);
    setShowAddForm(false);
    setError(null);
  };

  const handleAdd = async () => {
    if (!supplierValue) {
      setError('Please select a supplier');
      return;
    }
    if (!mpn.trim()) {
      setError('Manufacturer Part Number (MPN) is required');
      return;
    }
    if (unitPrice <= 0) {
      setError('Unit price must be greater than 0');
      return;
    }

    setLoading('add');
    setError(null);

    try {
      await onAdd({
        supplierId: supplierValue.supplierId,
        supplierName: supplierValue.supplierName,
        mpn: mpn.trim(),
        supplierSku: supplierSku.trim() || undefined,
        brandName: brandName.trim() || undefined,
        unitPrice,
        currency,
        unit: defaultUnit,
        minimumOrder: minimumOrder || undefined,
        leadTimeDays: leadTimeDays || undefined,
        qualityTier: qualityTier || undefined,
        notes: notes.trim() || undefined,
        url: url.trim() || undefined,
        isPreferred: setAsPreferred,
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add vendor source');
    } finally {
      setLoading(null);
    }
  };

  const handleRemove = async (sourceId: string) => {
    setLoading(sourceId);
    setError(null);
    try {
      await onRemove(sourceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove vendor source');
    } finally {
      setLoading(null);
    }
  };

  const handleSetPreferred = async (sourceId: string) => {
    setLoading(sourceId);
    setError(null);
    try {
      await onSetPreferred(sourceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set preferred');
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return null;
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
          Vendor Sources (MPN)
        </h3>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            disabled={disabled}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Vendor
          </button>
        )}
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Add Form */}
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
                label=""
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                MPN (Manufacturer Part Number) *
              </label>
              <input
                type="text"
                value={mpn}
                onChange={(e) => setMpn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                placeholder="e.g., 71B3550"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Supplier SKU
              </label>
              <input
                type="text"
                value={supplierSku}
                onChange={(e) => setSupplierSku(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                placeholder="Supplier's catalogue code"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Brand Name
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                placeholder="e.g., Blum, Salice"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Quality Tier
              </label>
              <select
                value={qualityTier}
                onChange={(e) => setQualityTier(e.target.value as typeof qualityTier)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              >
                <option value="">Not specified</option>
                <option value="economy">Economy</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="luxury">Luxury</option>
              </select>
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
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Min Order Qty
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
              Product URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              placeholder="Supplier product page link"
            />
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
              placeholder="Optional notes"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={setAsPreferred}
              onChange={(e) => setSetAsPreferred(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            Set as preferred vendor
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
              onClick={handleAdd}
              disabled={loading === 'add'}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {loading === 'add' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Add
            </button>
          </div>
        </div>
      )}

      {/* Vendor Source List */}
      {vendorSources.length === 0 && !showAddForm ? (
        <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
          <Hash className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p>No vendor sources added yet.</p>
          <p className="text-xs mt-1">Add vendors with their MPNs to decouple internal SKUs from supplier part numbers.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vendorSources.map((source) => (
            <div
              key={source.id}
              className={`border rounded-lg p-3 ${
                source.isPreferred
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Building2
                      className={`w-4 h-4 flex-shrink-0 ${
                        source.isPreferred ? 'text-amber-600' : 'text-gray-400'
                      }`}
                    />
                    <span className="font-medium text-sm text-gray-900">
                      {source.supplierName}
                    </span>
                    {source.isPreferred && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 rounded">
                        <Star className="w-3 h-3" />
                        Preferred
                      </span>
                    )}
                  </div>

                  {/* MPN + Supplier SKU */}
                  <div className="flex items-center gap-3 mt-1.5 text-xs">
                    <span className="flex items-center gap-1 font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-800">
                      <Hash className="w-3 h-3 text-gray-400" />
                      MPN: {source.mpn}
                    </span>
                    {source.supplierSku && (
                      <span className="font-mono text-gray-500">
                        Supplier SKU: {source.supplierSku}
                      </span>
                    )}
                  </div>

                  {/* Price + Details row */}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                    <span className="font-semibold text-gray-900">
                      {source.currency} {source.unitPrice.toLocaleString()}
                    </span>
                    {source.brandName && (
                      <span className="flex items-center gap-0.5">
                        <Tag className="w-3 h-3" />
                        {source.brandName}
                      </span>
                    )}
                    {source.leadTimeDays != null && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {source.leadTimeDays}d lead
                      </span>
                    )}
                    {source.minimumOrder != null && (
                      <span className="flex items-center gap-0.5">
                        <Package className="w-3 h-3" />
                        Min: {source.minimumOrder}
                      </span>
                    )}
                    {source.qualityTier && (
                      <span className="flex items-center gap-0.5 text-indigo-600">
                        <Shield className="w-3 h-3" />
                        {source.qualityTier}
                      </span>
                    )}
                  </div>

                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Product page
                    </a>
                  )}

                  {source.lastQuotedAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Quoted: {formatDate(source.lastQuotedAt)}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!source.isPreferred && (
                    <button
                      type="button"
                      onClick={() => handleSetPreferred(source.id)}
                      disabled={disabled || loading === source.id}
                      className="p-1.5 text-gray-400 hover:text-amber-600 rounded hover:bg-amber-50 disabled:opacity-50"
                      title="Set as preferred"
                    >
                      {loading === source.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <StarOff className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(source.id)}
                    disabled={disabled || loading === source.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                    title="Remove"
                  >
                    {loading === source.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
